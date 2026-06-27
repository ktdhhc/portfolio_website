import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { onRequestPost as chat } from '../functions/api/chat';
import { onRequestPost as track } from '../functions/api/track';

function loadDotEnv() {
  if (!existsSync('.env')) return;

  const envText = readFileSync('.env', 'utf-8');
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function contentType(filePath: string): string {
  switch (extname(filePath)) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

async function readRequestBody(req: import('node:http').IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

async function writeFetchResponse(res: import('node:http').ServerResponse, response: Response) {
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  if (!response.body) {
    res.end();
    return;
  }

  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

function resolveStaticFile(pathname: string): string | undefined {
  const cleanPath = normalize(decodeURIComponent(pathname)).replace(/^([.][.][\\/])+/, '');
  const basePath = join(process.cwd(), 'dist', cleanPath);
  const candidates = pathname === '/'
    ? [join(process.cwd(), 'dist', 'index.html')]
    : [basePath, join(basePath, 'index.html'), `${basePath}.html`];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

loadDotEnv();

const startPort = Number(process.env.PORT || '4321');
const explicitPort = Boolean(process.env.PORT);

const server = createServer(async (req, res) => {
  try {
    const address = server.address();
    const currentPort = address && typeof address === 'object' ? address.port : startPort;
    const host = req.headers.host || `127.0.0.1:${currentPort}`;
    const url = new URL(req.url || '/', `http://${host}`);

    if (url.pathname === '/api/chat' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let requestBody: ArrayBuffer | undefined;
      if (body) {
        requestBody = new ArrayBuffer(body.byteLength);
        new Uint8Array(requestBody).set(body);
      }
      const request = new Request(url, {
        method: 'POST',
        headers: req.headers as HeadersInit,
        body: requestBody,
      });
      const response = await chat({ request, env: process.env } as never);
      await writeFetchResponse(res, response);
      return;
    }

    if (url.pathname === '/api/track' && req.method === 'POST') {
      const body = await readRequestBody(req);
      let requestBody: ArrayBuffer | undefined;
      if (body) {
        requestBody = new ArrayBuffer(body.byteLength);
        new Uint8Array(requestBody).set(body);
      }
      const request = new Request(url, {
        method: 'POST',
        headers: req.headers as HeadersInit,
        body: requestBody,
      });
      const response = await track({ request, env: process.env } as never);
      await writeFetchResponse(res, response);
      return;
    }

    const filePath = resolveStaticFile(url.pathname);
    if (!filePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    res.end(readFileSync(filePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: message }));
  }
});

function listen(port: number) {
  server.once('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE' && !explicitPort && port < startPort + 20) {
      listen(port + 1);
      return;
    }

    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use. Set PORT to another value, e.g. PORT=4331 npm run dev.`);
      process.exit(1);
      return;
    }

    throw error;
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Local Pages dev server running at http://127.0.0.1:${port}`);
  });
}

listen(startPort);

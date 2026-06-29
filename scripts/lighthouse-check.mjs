import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const HOST = '127.0.0.1';
const PERFORMANCE_THRESHOLD = 90;
const PAGES = [
  '/',
  '/resume/',
  '/projects/',
  '/projects/aindexer/',
  '/projects/character-memory/',
  '/projects/human-like-agent/',
  '/projects/memory-system-testing/',
];

const tempDir = mkdtempSync(join(tmpdir(), 'portfolio-lighthouse-'));
const astroCli = join(process.cwd(), 'node_modules', 'astro', 'bin', 'astro.mjs');
const lighthouseCli = join(process.cwd(), 'node_modules', 'lighthouse', 'cli', 'index.js');

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep polling
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview server did not become ready within ${timeoutMs}ms`);
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Failed to obtain an ephemeral port'));
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve(port);
        }
      });
    });
  });
}

function startPreviewServer(port) {
  const child = spawn(process.execPath, [astroCli, 'preview', '--host', HOST, '--port', String(port)], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  child.on('error', (error) => {
    console.error('Failed to start preview server:', error);
  });

  return child;
}

async function stopPreviewServer(child) {
  if (!child || child.killed || child.exitCode !== null) return;

  const waitForExit = new Promise((resolve) => {
    child.once('exit', resolve);
  });

  child.kill('SIGTERM');

  const didExit = await Promise.race([
    waitForExit.then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ]);

  if (!didExit && process.platform === 'win32' && child.pid) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        shell: false,
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
  }
}

async function runLighthouse(url, outputPath) {
  await runCommand(process.execPath, [
    lighthouseCli,
    url,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    `--output-path=${outputPath}`,
    '--quiet',
    '--chrome-flags=--headless --no-sandbox',
  ]);

  const report = JSON.parse(readFileSync(outputPath, 'utf8'));
  return {
    performance: Math.round((report.categories.performance.score ?? 0) * 100),
    accessibility: Math.round((report.categories.accessibility.score ?? 0) * 100),
    bestPractices: Math.round((report.categories['best-practices'].score ?? 0) * 100),
    seo: Math.round((report.categories.seo.score ?? 0) * 100),
  };
}

function printResults(results) {
  console.log('\nLighthouse results');
  console.log('-------------------------------');
  for (const result of results) {
    console.log(
      `${result.path}\n  Performance: ${result.performance}\n  Accessibility: ${result.accessibility}\n  Best Practices: ${result.bestPractices}\n  SEO: ${result.seo}`,
    );
  }
}

async function main() {
  let previewProcess;

  try {
    await runCommand(process.execPath, [astroCli, 'build']);

    const port = await getAvailablePort();
    const baseUrl = `http://${HOST}:${port}`;

    previewProcess = startPreviewServer(port);
    await waitForServer(`${baseUrl}/`);

    const results = [];

    for (const path of PAGES) {
      const outputPath = join(tempDir, `${path.replace(/[^a-z0-9]/gi, '_') || 'root'}.json`);
      const scores = await runLighthouse(`${baseUrl}${path}`, outputPath);
      results.push({ path, ...scores });
    }

    printResults(results);

    const failed = results.filter((result) => result.performance < PERFORMANCE_THRESHOLD);
    if (failed.length > 0) {
      throw new Error(
        `Performance below ${PERFORMANCE_THRESHOLD} for: ${failed.map((result) => result.path).join(', ')}`,
      );
    }

    console.log(`\nAll audited pages meet Performance >= ${PERFORMANCE_THRESHOLD}.`);
  } finally {
    await stopPreviewServer(previewProcess);
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('\nLighthouse check failed.');
  console.error(error);
  process.exitCode = 1;
});

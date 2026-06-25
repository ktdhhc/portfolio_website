import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const resumePdfPath = fileURLToPath(new URL('../../public/resume.pdf', import.meta.url));

export function hasResumePdf() {
  return existsSync(resumePdfPath);
}

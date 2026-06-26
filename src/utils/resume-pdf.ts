import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// 多路径兜底：import.meta.url 在不同构建工具下指向不同位置
function findResumePdf(): boolean {
  const candidates = [
    // 源码位置：src/utils/ → ../../public/resume.pdf
    fileURLToPath(new URL('../../public/resume.pdf', import.meta.url)),
    // 构建产物位置兜底
    resolve(process.cwd(), 'public/resume.pdf'),
    resolve(process.cwd(), 'dist/resume.pdf'),
  ];
  return candidates.some((p) => {
    try { return existsSync(p); } catch { return false; }
  });
}

export function hasResumePdf() {
  return findResumePdf();
}

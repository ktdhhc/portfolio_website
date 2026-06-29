// Regression: project-page Markdown table must not leave blank space on the right.
// Guards against the `display: block` + `min-width: 100%` regression where the
// anonymous inner table box shrinks to max-content while the outer block fills
// the container, producing a gap on the right.
import { test, expect } from '@playwright/test';

test('项目详情页表格右侧不应有空白 (blank <= 2px)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/projects/aindexer/');

  const metrics = await page.evaluate(() => {
    const table = document.querySelector('.project-body table') as HTMLTableElement | null;
    if (!table) return { found: false };

    const cs = window.getComputedStyle(table);
    const rect = table.getBoundingClientRect();
    const cells = Array.from(table.querySelectorAll('th, td'));
    let maxCellRight = 0;
    for (const c of cells) {
      maxCellRight = Math.max(maxCellRight, c.getBoundingClientRect().right);
    }
    return {
      found: true,
      display: cs.display,
      width: cs.width,
      tableRight: rect.right,
      tableWidth: rect.width,
      maxCellRight,
      blank: rect.right - maxCellRight,
      cellCount: cells.length,
    };
  });

  expect(metrics.found).toBe(true);
  // Table layout algorithm must stretch columns to fill the container, so the
  // rightmost cell edge should align with the table's right edge.
  expect(metrics.blank, '表格右侧空白应 <= 2px').toBeLessThanOrEqual(2);
  // Sanity: the fix relies on display: table, not display: block.
  expect(metrics.display).toBe('table');
});

import { test, expect, type Locator, type Page } from '@playwright/test';

async function expectGridChildToSpanParent(page: Page, childSelector: string) {
  const child = page.locator(childSelector).first();

  await expect(child).toBeVisible();

  const gridBox = await getParentBox(child);
  const childBox = await child.boundingBox();

  expect(gridBox).not.toBeNull();
  expect(childBox).not.toBeNull();

  const leftDelta = Math.abs(childBox!.x - gridBox!.x);
  const rightDelta = Math.abs(gridBox!.x + gridBox!.width - (childBox!.x + childBox!.width));

  expect(leftDelta).toBeLessThanOrEqual(2);
  expect(rightDelta).toBeLessThanOrEqual(2);
  expect(childBox!.width).toBeGreaterThan(gridBox!.width * 0.9);
}

async function getParentBox(locator: Locator) {
  return locator.evaluate((element) => {
    const parentBox = element.parentElement?.getBoundingClientRect();
    const parentStyle = element.parentElement ? window.getComputedStyle(element.parentElement) : null;

    if (!parentBox || !parentStyle) {
      return null;
    }

    const paddingLeft = Number.parseFloat(parentStyle.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(parentStyle.paddingRight) || 0;

    return {
      x: parentBox.x + paddingLeft,
      y: parentBox.y,
      width: parentBox.width - paddingLeft - paddingRight,
      height: parentBox.height,
    };
  });
}

test('/resume 页头与首个 section 根布局不会塌缩到单列', async ({ page }) => {
  await page.goto('/resume/');

  await expectGridChildToSpanParent(page, '.resume-header-shell .page-header');
  await expectGridChildToSpanParent(page, '#education .section-label');
});

test('/ 首页 section 根布局不会塌缩到单列', async ({ page }) => {
  await page.goto('/');

  await expectGridChildToSpanParent(page, '#about .section-label');
  await expectGridChildToSpanParent(page, '#experience .section-label');
  await expectGridChildToSpanParent(page, '#projects .section-label');
});

test('/projects 页头根布局不会塌缩到单列', async ({ page }) => {
  await page.goto('/projects/');

  await expectGridChildToSpanParent(page, '.projects-header-shell .page-header');
});

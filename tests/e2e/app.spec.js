import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    /* quiet the network for deterministic tests */
    window.__e2e = true;
  });
});

test('landing page renders with hero and search', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Repodest/i);
  await expect(page.locator('.hero h1')).toBeVisible();
  await expect(page.locator('#inp')).toBeVisible();
  await expect(page.locator('.searchbox .btn')).toBeVisible();
});

test('command palette opens with Ctrl+K and lists actions', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  const input = page.locator('#cmdInput');
  await expect(input).toBeVisible();
  await expect(page.locator('#cmdList .cmd-item').first()).toBeVisible();
  await input.fill('battle');
  await expect(page.locator('#cmdList .cmd-item').first()).toContainText(/battle/i);
});

test('language menu opens and switches to Farsi', async ({ page }) => {
  await page.goto('/');
  await page.click('#langBtn');
  await expect(page.locator('.lang-menu')).toBeVisible();
  const items = page.locator('.lang-item');
  await expect(items).toHaveCount(7);
  await page.click('.lang-item[data-lang="fa"]');
  await expect(page.locator('#langBtn span')).toHaveText('FA');
  await expect(page.locator('body')).toHaveClass(/rtl/);
  /* back to english via menu */
  await page.click('#langBtn');
  await page.click('.lang-item[data-lang="en"]');
  await expect(page.locator('body')).not.toHaveClass(/rtl/);
});

test('help chips open popovers with content', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  /* dashboard loads after API calls; the health help chip is inside it */
  const chip = page.locator('.help-chip[data-help="health"]');
  await chip.waitFor({ state: 'visible', timeout: 20000 });
  await chip.click();
  await expect(page.locator('.help-popover')).toBeVisible();
  await expect(page.locator('.help-popover')).toContainText(/health score/i);
});

test('dashboard renders for a real repo with tabs', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  await expect(page.locator('#repoHero')).toContainText(/repodest/i, { timeout: 30000 });
  await expect(page.locator('#tabs .tab')).toHaveCount(8);
  /* switch to Files tab and check the tree rendered */
  await page.click('[data-tab="files"]');
  await expect(page.locator('#tree .trow').first()).toBeVisible();
});

test('digest tab exposes presets and generate button', async ({ page }) => {
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  await page.click('[data-tab="digest"]');
  await expect(page.locator('.rec-btn[data-preset]')).toHaveCount(6);
  await expect(page.locator('#genBtn')).toBeVisible();
  await page.click('.rec-btn[data-preset="review"]');
  await expect(page.locator('.rec-btn[data-preset="review"]')).toHaveClass(/preset-sel/);
});

test('toolbar more-tools tray toggles on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?repo=mohsen-niksirat/Repodest');
  const moreBtn = page.locator('#moreBtn');
  await moreBtn.waitFor({ state: 'visible', timeout: 20000 });
  await moreBtn.click();
  await expect(page.locator('#moreTools')).toHaveClass(/open/);
  await expect(page.locator('#moreTools .btn').first()).toBeVisible();
});

import { test, expect } from '@playwright/test';

test.describe('Bucket Match', () => {
  test('a tile can be placed into a bucket via real pointer events (drag), not a synthetic drop', async ({ page }) => {
    await page.goto('/#/session/bucketMatch');

    const pool = page.getByTestId('tile-pool');
    await expect(pool).toBeVisible({ timeout: 15000 });

    const tile = pool.locator('[data-testid^="tile-"]').first();
    await expect(tile).toBeVisible();
    const tileTestId = await tile.getAttribute('data-testid');

    const bucket = page.locator('[data-testid^="bucket-"]').first();
    await expect(bucket).toBeVisible();

    const tileBox = await tile.boundingBox();
    const bucketBox = await bucket.boundingBox();
    if (!tileBox || !bucketBox) throw new Error('could not measure tile/bucket bounding boxes');

    // Real pointer sequence: down on the tile, move in steps (crossing the
    // dnd-kit activation distance), up over the bucket. Not page.dragTo(),
    // which synthesizes a single drop event and would not exercise dnd-kit's
    // pointer sensor the way a real touch/mouse drag does.
    await page.mouse.move(tileBox.x + tileBox.width / 2, tileBox.y + tileBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(tileBox.x + tileBox.width / 2 + 20, tileBox.y + tileBox.height / 2 + 20, { steps: 5 });
    await page.mouse.move(bucketBox.x + bucketBox.width / 2, bucketBox.y + bucketBox.height / 2, { steps: 15 });
    await page.mouse.up();

    // The same tile element now renders inside a bucket (disabled, with
    // correct/incorrect feedback) instead of the pool.
    const placedTile = page.locator(`[data-testid="${tileTestId}"]`);
    await expect(placedTile).toBeDisabled();
    await expect(pool.locator(`[data-testid="${tileTestId}"]`)).toHaveCount(0);
  });

  test('the same placement works via the tap fallback (tap tile, then tap bucket)', async ({ page }) => {
    await page.goto('/#/session/bucketMatch');

    const pool = page.getByTestId('tile-pool');
    await expect(pool).toBeVisible({ timeout: 15000 });

    const tile = pool.locator('[data-testid^="tile-"]').first();
    await expect(tile).toBeVisible();
    const tileTestId = await tile.getAttribute('data-testid');

    await tile.click();
    await expect(tile).toHaveAttribute('data-selected', 'true');

    const bucket = page.locator('[data-testid^="bucket-"]').first();
    await bucket.click();

    const placedTile = page.locator(`[data-testid="${tileTestId}"]`);
    await expect(placedTile).toBeDisabled();
    await expect(pool.locator(`[data-testid="${tileTestId}"]`)).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';

test('the app keeps working after the service worker has cached it and the network goes offline', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByText('Cardiology')).toBeVisible({ timeout: 15000 });

  // Wait for the service worker to actually take control before going offline.
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 }).catch(() => {
    // Some environments register but don't claim on first load; give it one more tick via reload.
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 });

  await context.setOffline(true);

  await page.reload();
  await expect(page.getByText('Cardiology')).toBeVisible({ timeout: 15000 });

  await page.goto('/#/session/mcq');
  await expect(page.getByTestId('question-card')).toBeVisible({ timeout: 15000 });

  await context.setOffline(false);
});

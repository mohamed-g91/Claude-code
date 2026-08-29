import { test, expect, type Page } from '@playwright/test';

async function readIndexedDb(page: Page, storeName: string): Promise<unknown[]> {
  return page.evaluate((store) => {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('mrcp-cardio-revision');
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(store)) {
          resolve([]);
          return;
        }
        const tx = db.transaction(store, 'readonly');
        const getAllReq = tx.objectStore(store).getAll();
        getAllReq.onsuccess = () => resolve(getAllReq.result);
        getAllReq.onerror = () => reject(getAllReq.error);
      };
    });
  }, storeName);
}

test('answering an MCQ persists an attempt and an SRS card state, surviving a reload', async ({ page }) => {
  await page.goto('/#/session/mcq');

  const questionCard = page.getByTestId('question-card');
  await expect(questionCard).toBeVisible({ timeout: 15000 });

  // Answer the first question with option A (whether it's right or wrong
  // doesn't matter for this test — persistence must happen either way).
  await page.getByTestId('option-A').click();
  await expect(page.getByTestId('explanation-panel')).toBeVisible();

  const attemptsBeforeReload = await readIndexedDb(page, 'attempts');
  expect(attemptsBeforeReload.length).toBeGreaterThan(0);

  const cardStatesBeforeReload = await readIndexedDb(page, 'cardStates');
  expect(cardStatesBeforeReload.length).toBeGreaterThan(0);

  await page.reload();
  await page.waitForTimeout(500);

  const attemptsAfterReload = await readIndexedDb(page, 'attempts');
  const cardStatesAfterReload = await readIndexedDb(page, 'cardStates');

  expect(attemptsAfterReload.length).toBe(attemptsBeforeReload.length);
  expect(attemptsAfterReload.length).toBeGreaterThan(0);
  expect(cardStatesAfterReload.length).toBe(cardStatesBeforeReload.length);
  expect(cardStatesAfterReload.length).toBeGreaterThan(0);
});

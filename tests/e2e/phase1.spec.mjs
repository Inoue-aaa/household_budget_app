import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const authFile = process.env.PLAYWRIGHT_AUTH_FILE;
const authReady = Boolean(authFile && existsSync(authFile));
const receiptFixturePath = path.resolve(process.cwd(), "tests/fixtures/receipt-sample.svg");
const creditFixturePath = path.resolve(process.cwd(), "tests/fixtures/credit-sample.svg");

async function acceptNextDialog(page) {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

async function deleteAttentionRows(page) {
  const rows = page.locator('article[data-testid^="review-row-"]');

  while (true) {
    const count = await rows.count();
    let deleted = false;

    for (let index = 0; index < count; index += 1) {
      const row = rows.nth(index);
      const badgeText = (await row.locator(".pill").first().textContent()) ?? "";

      if (badgeText.includes("確認が必要")) {
        await row.locator('button[data-testid$="-delete"]').click();
        await page.waitForLoadState("networkidle");
        deleted = true;
        break;
      }
    }

    if (!deleted) {
      return;
    }
  }
}

test.describe("phase1 major flows", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!authReady, "認証済み storage state がないため E2E をスキップします。");

  test("manual entry saves and appears in expenses", async ({ page }) => {
    const title = `E2E manual ${Date.now()}`;

    await page.goto("/register/manual");
    await page.getByTestId("manual-title").fill(title);
    await page.getByTestId("manual-amount").fill("1280");
    await page.getByTestId("manual-note").fill("phase1 e2e");
    await page.getByTestId("manual-submit").click();

    await expect(page).toHaveURL(/\/expenses\?created=1/);
    await expect(page.getByText(title)).toBeVisible();
  });

  test("receipt upload can go through review and confirm", async ({ page }) => {
    await page.goto("/register/receipt");
    await page.getByTestId("receipt-images").setInputFiles([receiptFixturePath]);
    await page.getByTestId("receipt-upload-submit").click();

    await expect(page).toHaveURL(/\/register\/review\//);
    await deleteAttentionRows(page);
    await page.getByTestId("review-confirm-submit").click();

    await expect(page).toHaveURL(/\/expenses\?created=1/);
    await expect(page.getByText("卵 Mサイズ")).toBeVisible();
  });

  test("credit upload can go through review and confirm", async ({ page }) => {
    await page.goto("/register/credit");
    await page.getByTestId("credit-images").setInputFiles([creditFixturePath]);
    await page.getByTestId("credit-upload-submit").click();

    await expect(page).toHaveURL(/\/register\/review\//);
    await deleteAttentionRows(page);
    await page.getByTestId("review-confirm-submit").click();

    await expect(page).toHaveURL(/\/expenses\?created=1/);
    await expect(page.getByText("JR東日本 利用分")).toBeVisible();
  });

  test("draft import group can be discarded from review", async ({ page }) => {
    await page.goto("/register/receipt");
    await page.getByTestId("receipt-images").setInputFiles([receiptFixturePath]);
    await page.getByTestId("receipt-upload-submit").click();

    await expect(page).toHaveURL(/\/register\/review\//);
    await acceptNextDialog(page);
    await page.getByTestId("review-discard-import-group").click();

    await expect(page).toHaveURL(/\/register\?notice=group-discarded/);
    await expect(page.getByText("取り込みを破棄しました")).toBeVisible();
  });

  test("confirmed import group can be deleted from expenses", async ({ page }) => {
    const title = `E2E delete ${Date.now()}`;

    await page.goto("/register/manual");
    await page.getByTestId("manual-title").fill(title);
    await page.getByTestId("manual-amount").fill("980");
    await page.getByTestId("manual-submit").click();

    await expect(page).toHaveURL(/\/expenses\?created=1/);
    const targetGroup = page.locator('[data-testid="expenses-group"]').filter({
      has: page.getByText(title)
    });

    await expect(targetGroup).toHaveCount(1);
    await acceptNextDialog(page);
    await targetGroup.getByTestId("expenses-group-delete").click();

    await expect(page).toHaveURL(/\/expenses\?deleted=1/);
    await expect(page.getByText(title)).toHaveCount(0);
  });
});

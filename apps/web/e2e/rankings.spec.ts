import { expect, test } from "@playwright/test";

test("rankings page renders the chart and filters series through the url", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await expect(page.getByText("Keyword positions over time")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  await expect(page.getByRole("button", { name: "5 selected" })).toBeVisible();
  await page.getByRole("button", { name: "focus timer" }).click();

  await expect(page).toHaveURL(/keywords=/);
  await expect(page.getByRole("button", { name: "4 selected" })).toBeVisible();
});

test("a range preset writes to the url", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page.getByRole("tab", { name: "7d" }).click();

  await expect(page).toHaveURL(/range=7d/);
});

test("the ranking tooltip shows the over-100 marker for unranked keywords", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page.locator(".recharts-surface").first().hover();

  await expect(page.getByText(">100").first()).toBeVisible();
});

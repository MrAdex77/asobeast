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

  await page
    .getByRole("tablist", { name: "Date range" })
    .getByRole("tab", { name: "7d" })
    .click();

  await expect(page).toHaveURL(/range=7d/);
});

test("the serp movers card lists entrants with badges and a track action", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await expect(
    page.getByText("New entrants in your keywords' top 10"),
  ).toBeVisible();

  const competitorRow = page.getByRole("listitem").filter({ hasText: "Rival Focus" });
  await expect(competitorRow.getByText("Competitor")).toBeVisible();
  await expect(competitorRow).toContainText("entered the top 10 for");
  await expect(competitorRow).toContainText("at #4");

  const unknownRow = page.getByRole("listitem").filter({ hasText: "Newcomer Timer" });
  await expect(unknownRow.getByRole("button", { name: "Track" })).toBeVisible();

  await page.getByRole("tab", { name: "14d" }).click();
  await expect(page).toHaveURL(/movers=14/);
});

test("the ranking tooltip shows the over-100 marker for unranked keywords", async ({ page }) => {
  await page.goto("/apps/app-1/rankings");

  await page.locator(".recharts-surface").first().hover();

  await expect(page.getByText(">100").first()).toBeVisible();
});

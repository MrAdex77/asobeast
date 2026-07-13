import { expect, test } from "@playwright/test";
import { PORTFOLIO } from "./fixtures.mts";

test("home renders the portfolio grid with totals and per-app cards", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Apps", level: 1 })).toBeVisible();

  const [first, second] = PORTFOLIO.apps;
  await expect(page.getByRole("link", { name: first.name ?? "" })).toBeVisible();
  await expect(page.getByRole("link", { name: second.name ?? "" })).toBeVisible();

  await expect(
    page.getByText(`${first.trackedKeywords} keywords`),
  ).toBeVisible();

  await expect(page.getByText("Changes this week")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "visibility, last 30 days" }).first(),
  ).toBeVisible();
});

test("health badge reflects the mocked health endpoint", async ({ page }) => {
  await page.goto("/");

  const badge = page.getByRole("banner").getByText("api", { exact: true });
  await expect(badge).toBeVisible();
  await badge.hover();
  await expect(page.getByText("API healthy · database up")).toBeVisible();
});

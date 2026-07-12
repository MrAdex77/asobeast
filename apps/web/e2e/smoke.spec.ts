import { expect, test } from "@playwright/test";
import { APP_1, APP_2 } from "./fixtures.ts";

test("home lists fixture apps with names and keyword counts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Apps", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: APP_1.name ?? "" })).toBeVisible();
  await expect(page.getByRole("link", { name: APP_2.name ?? "" })).toBeVisible();
  await expect(
    page.getByText(`${APP_1.trackedKeywordCount} keywords`),
  ).toBeVisible();
});

test("health badge reflects the mocked health endpoint", async ({ page }) => {
  await page.goto("/");

  const badge = page.getByRole("banner").getByText("api", { exact: true });
  await expect(badge).toBeVisible();
  await badge.hover();
  await expect(page.getByText("API healthy · database up")).toBeVisible();
});

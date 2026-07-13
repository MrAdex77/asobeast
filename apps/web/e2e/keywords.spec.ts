import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("table renders fixture keywords and distinguishes a paused row", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  await expect(page.getByText("Tracking 5 keywords · 4 active")).toBeVisible();
  for (const text of ["focus timer", "pomodoro", "study timer", "productivity app"]) {
    await expect(page.getByRole("cell", { name: text, exact: true })).toBeVisible();
  }

  const pausedRow = page.getByRole("row", { name: /time blocking/ });
  await expect(pausedRow).toBeVisible();
  await expect(pausedRow.getByText("Paused")).toBeVisible();
});

test("clicking a sort header updates the url and reorders rows", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  await expect(page.locator("tbody tr").first()).toContainText("focus timer");

  await page.getByRole("button", { name: "Traffic" }).click();

  await expect(page).toHaveURL(/sort=traffic/);
  await expect(page.locator("tbody tr").first()).toContainText("pomodoro");
});

test("position deltas render arrows, a bare position and the over-100 marker", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  await expect(page.getByLabel("up 2 since yesterday")).toBeVisible();
  await expect(page.getByLabel("down 3 since yesterday")).toBeVisible();

  const unchangedRow = page.getByRole("row", { name: /study timer/ });
  await expect(unchangedRow).toContainText("7");
  await expect(unchangedRow.getByLabel(/since yesterday/)).toHaveCount(0);

  const unrankedRow = page.getByRole("row", { name: /productivity app/ });
  await expect(unrankedRow).toContainText(">100");
});

test("exporting keywords downloads a bom-prefixed csv", async ({ page }) => {
  await page.goto("/apps/app-1/keywords");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export keywords to CSV" }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/^keywords-app-1-\d{4}-\d{2}-\d{2}\.csv$/);
  const content = readFileSync(await download.path(), "utf8");
  expect(content.startsWith("﻿keyword,source,active,position")).toBe(true);
});

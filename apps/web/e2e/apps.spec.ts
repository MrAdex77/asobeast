import { expect, test } from "@playwright/test";
import { APP_1_SUMMARY, IMPORTED_APP } from "./fixtures.ts";

const utcDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});

test("importing an app posts to the api and shows the new app", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Import app" }).click();
  await page
    .getByLabel("App Store URL")
    .fill("https://apps.apple.com/us/app/focus-timer/id123456789");
  await page.getByRole("button", { name: "Import", exact: true }).click();

  await expect(
    page.getByText(`Imported ${IMPORTED_APP.name}`),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: IMPORTED_APP.name ?? "" }),
  ).toBeVisible();
});

test("app overview renders summary numbers and a utc refresh date", async ({ page }) => {
  await page.goto("/apps/app-1");

  await expect(page.getByText("+5 7d")).toBeVisible();
  await expect(page.getByText("3 in top 10")).toBeVisible();

  await expect(page.getByText("Where your keywords rank")).toBeVisible();

  await expect(page.getByText("Keyword movers")).toBeVisible();
  await expect(page.getByRole("link", { name: /focus timer/ })).toBeVisible();

  await expect(page.getByText("Metadata coverage")).toBeVisible();
  await expect(page.getByText("productivity app")).toBeVisible();

  const refreshDate = utcDateFormatter.format(
    new Date(APP_1_SUMMARY.lastRefreshAt ?? ""),
  );
  await expect(page.getByText("Last refresh")).toBeVisible();
  await expect(page.getByText(refreshDate, { exact: true })).toBeVisible();
});

test("an api error renders the error boundary with a retry control", async ({ page }) => {
  await page.goto("/apps/err-app");

  await expect(page.getByText("Something went wrong")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("an unknown app renders the not-found boundary", async ({ page }) => {
  await page.goto("/apps/does-not-exist");

  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("This page could not be found.")).toBeVisible();
});

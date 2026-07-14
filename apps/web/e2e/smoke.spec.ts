import { expect, test } from "@playwright/test";
import { EMAIL_ALERTS, PORTFOLIO } from "./fixtures.mts";

test("home renders the portfolio grid with totals and per-app cards", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Apps", level: 1 })).toBeVisible();

  const [first, second] = PORTFOLIO.apps;
  await expect(
    page.getByRole("link", { name: first.name ?? "", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: second.name ?? "", exact: true }),
  ).toBeVisible();

  await expect(
    page.getByText(`${first.trackedKeywords} keywords`),
  ).toBeVisible();

  await expect(
    page.getByText(first.country.toUpperCase(), { exact: true }).first(),
  ).toBeVisible();

  await expect(page.getByText("Changes this week")).toBeVisible();
  await expect(
    page.getByRole("img", { name: "visibility, last 30 days" }).first(),
  ).toBeVisible();
});

test("recent changes feed renders fixture events on the dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Across your portfolio")).toBeVisible();
  await expect(page.getByText("Focus Timer Pro")).toBeVisible();
});

test("settings exposes the weekly digest event", async ({ page }) => {
  await page.goto("/settings");

  await expect(
    page.getByText("Daily request budget", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add webhook" }).first().click();
  await expect(
    page.getByRole("button", { name: "Weekly digest" }),
  ).toBeVisible();
});

test("settings lists email alerts and expands their delivery log", async ({
  page,
}) => {
  await page.goto("/settings");

  const [alert] = EMAIL_ALERTS;
  await expect(page.getByText(alert.email, { exact: true })).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Add email alert" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Recent deliveries" })
    .last()
    .click();

  await expect(page.getByText("Failed").first()).toBeVisible();
  await expect(page.getByText("Success").first()).toBeVisible();
});

test("health badge reflects the mocked health endpoint", async ({ page }) => {
  await page.goto("/");

  const badge = page.getByRole("banner").getByText("api", { exact: true });
  await expect(badge).toBeVisible();
  await badge.hover();
  await expect(page.getByText("API healthy · database up")).toBeVisible();
});

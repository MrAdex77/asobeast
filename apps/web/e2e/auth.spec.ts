import { expect, test, type Page } from "@playwright/test";
import type { ApiTokenItem, AuthStatus, AuthUser } from "@asobeast/shared";

const TRIAL_USER: AuthUser = {
  id: "u1",
  email: "owner@example.com",
  name: "Owner",
  role: "owner",
  plan: "free",
  trialEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  planExpiresAt: null,
  entitled: true,
};

function fulfillJson(status: number, body: unknown) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  };
}

async function routeStatus(page: Page, status: AuthStatus) {
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(fulfillJson(200, status)),
  );
}

test("login form renders when auth is disabled", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: "Sign in" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});

test("guarded pages redirect to login when unauthenticated", async ({
  page,
}) => {
  await routeStatus(page, {
    enabled: true,
    billing: false,
    registrationOpen: true,
    authenticated: false,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Sign in" }),
  ).toBeVisible();
});

test("login flow signs in and reveals the account menu", async ({ page }) => {
  let authenticated = false;
  await page.route("**/api/backend/auth/status", (route) =>
    route.fulfill(
      fulfillJson(200, {
        enabled: true,
        billing: false,
        registrationOpen: true,
        authenticated,
      }),
    ),
  );
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );
  await page.route("**/api/backend/auth/login", (route) => {
    authenticated = true;
    return route.fulfill(fulfillJson(200, TRIAL_USER));
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill("owner@example.com");
  await page.getByLabel("Password").fill("supersecret1");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
});

test("an active trial shows the upgrade banner", async ({ page }) => {
  await routeStatus(page, {
    enabled: true,
    billing: true,
    registrationOpen: true,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );

  await page.goto("/");
  await expect(page.getByText(/Trial ends in 5 days/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Upgrade" })).toBeVisible();
});

test("settings creates, reveals and revokes an api token", async ({ page }) => {
  await routeStatus(page, {
    enabled: true,
    billing: false,
    registrationOpen: true,
    authenticated: true,
  });
  await page.route("**/api/backend/auth/me", (route) =>
    route.fulfill(fulfillJson(200, TRIAL_USER)),
  );

  let tokens: ApiTokenItem[] = [];
  await page.route("**/api/backend/auth/tokens", (route) => {
    if (route.request().method() === "POST") {
      const item: ApiTokenItem = {
        id: "t1",
        name: "ci",
        prefix: "asob_1234567",
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      };
      tokens = [item];
      return route.fulfill(
        fulfillJson(201, { ...item, token: `asob_${"a".repeat(48)}` }),
      );
    }
    return route.fulfill(fulfillJson(200, tokens));
  });
  await page.route("**/api/backend/auth/tokens/*", (route) => {
    tokens = [];
    return route.fulfill({ status: 204, body: "" });
  });

  await page.goto("/settings");
  await expect(page.getByText("API tokens")).toBeVisible();

  await page.getByRole("button", { name: "New token" }).click();
  await page.getByLabel("Name").fill("ci");
  await page.getByRole("button", { name: "Create token" }).click();

  await expect(page.getByText("Copy your token")).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "New api token" }),
  ).toHaveValue(`asob_${"a".repeat(48)}`);
  await page.getByRole("button", { name: "Done" }).click();

  await expect(page.getByRole("cell", { name: "ci", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Revoke ci" }).click();
  await page.getByRole("button", { name: "Revoke", exact: true }).click();

  await expect(page.getByRole("cell", { name: "ci", exact: true })).toBeHidden();
});

test("a 402 response redirects to the upgrade page", async ({ page }) => {
  await page.route("**/api/backend/health", (route) =>
    route.fulfill(
      fulfillJson(402, {
        statusCode: 402,
        error: "Payment Required",
        message: "Trial expired — upgrade to keep using asobeast",
        path: "/health",
        timestamp: new Date().toISOString(),
      }),
    ),
  );

  await page.goto("/");
  await expect(page).toHaveURL(/\/upgrade$/);
  await expect(
    page.getByText("Keep optimizing without limits"),
  ).toBeVisible();
});

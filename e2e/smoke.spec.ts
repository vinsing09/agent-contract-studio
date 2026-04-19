import { test, expect } from "@playwright/test";

test("app shell loads with Agents heading and New Agent link", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Agents" })).toBeVisible();
  await expect(page.getByRole("link", { name: /New Agent/ })).toBeVisible();
});

test("unknown route renders 404 page", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page.getByText(/404/)).toBeVisible();
});

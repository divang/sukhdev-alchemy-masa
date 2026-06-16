import { expect, test, type Page } from "@playwright/test"

async function openAccountView(page: Page) {
  await page.goto("/")
  await page.context().clearCookies()
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.reload()

  await page
    .getByRole("button", { name: /^Account$/i })
    .filter({ hasText: /^Account$/ })
    .first()
    .click()
}

test("auth drawer exposes Google and email/password entry points", async ({ page }) => {
  await openAccountView(page)

  await expect(page.getByRole("heading", { name: /your account/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  await expect(page.getByRole("button", { name: /use email\/password instead/i })).toBeVisible()
})

test("Google auth button starts the OAuth redirect path", async ({ page }) => {
  await openAccountView(page)

  const googleButton = page.getByRole("button", { name: /continue with google/i })
  await googleButton.click()

  await expect(page).toHaveURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/oauth\/authorize|supabase\.co\/auth\/v1\/callback/i)
})

# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-smoke.spec.ts >> Google auth button starts the OAuth redirect path
- Location: tests/auth-smoke.spec.ts:27:1

# Error details

```
Error: locator.click: Target page, context or browser has been closed
Call log:
  - waiting for getByRole('button', { name: /^Account$/i }).filter({ hasText: /^Account$/ }).first()

```

```
Error: write EPIPE
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test"
  2  | 
  3  | async function openAccountView(page: Page) {
  4  |   await page.goto("/")
  5  |   await page.context().clearCookies()
  6  |   await page.evaluate(() => {
  7  |     localStorage.clear()
  8  |     sessionStorage.clear()
  9  |   })
  10 |   await page.reload()
  11 | 
> 12 |   await page
     |   ^ Error: write EPIPE
  13 |     .getByRole("button", { name: /^Account$/i })
  14 |     .filter({ hasText: /^Account$/ })
  15 |     .first()
  16 |     .click()
  17 | }
  18 | 
  19 | test("auth drawer exposes Google and email/password entry points", async ({ page }) => {
  20 |   await openAccountView(page)
  21 | 
  22 |   await expect(page.getByRole("heading", { name: /your account/i })).toBeVisible()
  23 |   await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible()
  24 |   await expect(page.getByRole("button", { name: /use email\/password instead/i })).toBeVisible()
  25 | })
  26 | 
  27 | test("Google auth button starts the OAuth redirect path", async ({ page }) => {
  28 |   await openAccountView(page)
  29 | 
  30 |   const googleButton = page.getByRole("button", { name: /continue with google/i })
  31 |   await googleButton.click()
  32 | 
  33 |   await expect(page).toHaveURL(/accounts\.google\.com|supabase\.co\/auth\/v1\/oauth\/authorize|supabase\.co\/auth\/v1\/callback/i)
  34 | })
  35 | 
```
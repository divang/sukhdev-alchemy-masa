# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth-smoke.spec.ts >> auth drawer exposes Google and email/password entry points
- Location: tests/auth-smoke.spec.ts:19:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /your account/i })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('heading', { name: /your account/i })

```

```yaml
- banner:
  - button "Back to Store":
    - img
    - text: Back to Store
- img "Sukhdevi Alchemy logo"
- text: Your Account Create an account before payment so customers can view only their own orders and receive updates or review requests. If email confirmation is enabled in Supabase, confirm the email before signing in.
- tablist:
  - tab "Sign In" [selected]
  - tab "Create Account"
- tabpanel "Sign In":
  - button "Continue with Google"
  - paragraph: Or continue with phone OTP
  - text: Phone Number
  - textbox "Phone Number":
    - /placeholder: +91XXXXXXXXXX
  - button "Continue with Phone OTP"
  - button "Use email/password instead"
- region "Notifications alt+T"
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
  12 |   await page
  13 |     .getByRole("button", { name: /^Account$/i })
  14 |     .filter({ hasText: /^Account$/ })
  15 |     .first()
  16 |     .click()
  17 | }
  18 | 
  19 | test("auth drawer exposes Google and email/password entry points", async ({ page }) => {
  20 |   await openAccountView(page)
  21 | 
> 22 |   await expect(page.getByRole("heading", { name: /your account/i })).toBeVisible()
     |                                                                      ^ Error: expect(locator).toBeVisible() failed
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
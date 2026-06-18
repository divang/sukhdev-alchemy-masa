import { expect, type Page } from "@playwright/test"

export class AdminPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /admin panel/i })).toBeVisible()
    await expect(this.page.getByText(/dev mode/i)).toBeVisible()
  }

  async openBackToStore() {
    await this.page.getByRole("button", { name: /back to store/i }).click()
  }
}

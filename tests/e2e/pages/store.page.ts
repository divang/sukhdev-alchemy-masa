import { expect, type Locator, type Page } from "@playwright/test"

export class StorePage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async goto() {
    await this.page.goto("/")
  }

  productCard(name: string): Locator {
    return this.page.getByRole("heading", { name, exact: true }).first()
  }

  async addProductToCart(name: string) {
    await this.page.getByRole("button", { name: new RegExp(`^Add ${name} to cart$`, "i") }).first().click()
  }

  async search(keyword: string) {
    await this.page.getByRole("searchbox", { name: /search products/i }).fill(keyword)
  }

  async openAccount() {
    await this.page.getByRole("button", { name: /^Account$/i }).first().click()
  }

  async openCartFromBottomNav() {
    await this.page.getByRole("button", { name: /^Cart$/i }).first().click()
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /all products/i })).toBeVisible()
  }
}

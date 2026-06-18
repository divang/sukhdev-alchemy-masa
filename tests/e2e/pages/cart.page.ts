import { expect, type Page } from "@playwright/test"

export class CartPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async expectLineItemVisible(productName: string) {
    await expect(this.page.getByText(productName, { exact: false })).toBeVisible()
  }

  async openCheckout() {
    await this.page.getByRole("button", { name: /checkout|proceed to checkout/i }).first().click()
  }

  async expectItemCountAtLeast(count: number) {
    const itemRows = this.page.locator('[data-testid="cart-item"], [class*="cart-item"], [aria-label*="cart item" i]')
    const rowCount = await itemRows.count()
    expect(rowCount).toBeGreaterThanOrEqual(count)
  }
}

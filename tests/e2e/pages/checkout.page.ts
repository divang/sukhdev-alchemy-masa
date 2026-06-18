import { expect, type Page } from "@playwright/test"

export class CheckoutPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  async expectLoaded() {
    await expect(this.page.getByRole("heading", { name: /checkout/i })).toBeVisible()
  }

  async fillCustomerDetails(input: {
    name: string
    email: string
    phone: string
    address: string
    city: string
    pincode: string
  }) {
    await this.page.getByLabel(/name/i).fill(input.name)
    await this.page.getByLabel(/email/i).fill(input.email)
    await this.page.getByLabel(/phone/i).fill(input.phone)
    await this.page.getByLabel(/address/i).fill(input.address)
    await this.page.getByLabel(/city/i).fill(input.city)
    await this.page.getByLabel(/pincode/i).fill(input.pincode)
  }

  async placeOrder() {
    await this.page.getByRole("button", { name: /place order|continue to payment/i }).first().click()
  }
}

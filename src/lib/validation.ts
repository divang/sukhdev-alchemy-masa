const PASSWORD_MIN_LENGTH = 12
const PASSWORD_MAX_LENGTH = 128

const ADDRESS_MIN_LENGTH = 8
const ADDRESS_MAX_LENGTH = 160
const CITY_MIN_LENGTH = 2
const CITY_MAX_LENGTH = 60
const COUNTRY_ALLOWED = "india"

export function getPasswordPolicyMessage() {
  return "Use 12+ characters with uppercase, lowercase, number, and special character."
}

export function validateStrongPassword(password: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password cannot exceed ${PASSWORD_MAX_LENGTH} characters.`
  }

  if (/\s/.test(password)) {
    return "Password cannot contain spaces."
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter."
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter."
  }

  if (!/\d/.test(password)) {
    return "Password must include at least one number."
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character."
  }

  return undefined
}

type ShippingAddressInput = {
  address: string
  city: string
  pincode: string
  country: string
}

export function validateIndianShippingAddress(input: ShippingAddressInput): string | undefined {
  const address = input.address.trim()
  const city = input.city.trim()
  const pincode = input.pincode.trim()
  const country = input.country.trim().toLowerCase()

  if (country !== COUNTRY_ALLOWED) {
    return "We currently serve orders only within India."
  }

  if (address.length < ADDRESS_MIN_LENGTH || address.length > ADDRESS_MAX_LENGTH) {
    return `Address must be between ${ADDRESS_MIN_LENGTH} and ${ADDRESS_MAX_LENGTH} characters.`
  }

  if (!/^[-#/,().A-Za-z0-9\s]+$/.test(address)) {
    return "Address contains invalid characters."
  }

  if (!/\d/.test(address)) {
    return "Address must include house or building number."
  }

  if (!/[A-Za-z]/.test(address)) {
    return "Address must include street or locality details."
  }

  if (city.length < CITY_MIN_LENGTH || city.length > CITY_MAX_LENGTH) {
    return `City must be between ${CITY_MIN_LENGTH} and ${CITY_MAX_LENGTH} characters.`
  }

  if (!/^[A-Za-z][A-Za-z\s.'-]+$/.test(city)) {
    return "City must contain letters only."
  }

  if (!/^[1-9]\d{5}$/.test(pincode)) {
    return "Enter a valid 6-digit Indian pincode."
  }

  return undefined
}

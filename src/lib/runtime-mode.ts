import type { UserProfile } from "@/lib/types"

export type RuntimeMode = "prod" | "dev"

const DEFAULT_DEV_ADMIN_EMAIL = "divang.s@gmail.com"

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase()
}

export function getDevAdminEmail() {
  const configured = (import.meta.env.VITE_DEV_MODE_ADMIN_EMAIL as string | undefined)?.trim()
  return normalizeEmail(configured || DEFAULT_DEV_ADMIN_EMAIL)
}

export function getRequestedRuntimeModeFromSearch(search: string): RuntimeMode {
  const params = new URLSearchParams(search)
  const mode = params.get("mode")?.trim().toLowerCase()
  return mode === "dev" ? "dev" : "prod"
}

export function isDevModeAllowed(profile: UserProfile | null) {
  if (!profile) {
    return false
  }

  return profile.role === "admin" && normalizeEmail(profile.email) === getDevAdminEmail()
}

export function resolveRuntimeMode(requestedMode: RuntimeMode, profile: UserProfile | null): RuntimeMode {
  if (requestedMode !== "dev") {
    return "prod"
  }

  return isDevModeAllowed(profile) ? "dev" : "prod"
}

import type { Session, User } from "@supabase/supabase-js"
import type { UserProfile } from "@/lib/types"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

type AuthState = {
  user: User | null
  profile: UserProfile | null
}

type AuthResult = AuthState & {
  error?: string
  requiresEmailConfirmation?: boolean
  notice?: string
}

type SignUpInput = {
  fullName: string
  email: string
  phone: string
  password: string
  reviewOptIn: boolean
  marketingOptIn: boolean
}

type SignInInput = {
  email: string
  password: string
}

type PhoneOtpInput = {
  phone: string
}

type VerifyPhoneOtpInput = {
  phone: string
  otp: string
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function maskEmail(email: string | undefined) {
  if (!email) {
    return "unknown"
  }

  const [name, domain] = email.split("@")
  if (!domain) {
    return "invalid"
  }

  if (name.length <= 2) {
    return `${name[0] ?? "*"}*@${domain}`
  }

  return `${name.slice(0, 2)}***@${domain}`
}

function authDebug(message: string, details?: Record<string, unknown>) {
  const ts = new Date().toISOString()
  if (details) {
    console.log(`[auth ${ts}] ${message}`, details)
    return
  }

  console.log(`[auth ${ts}] ${message}`)
}

async function logAuthStage(
  stage: string,
  status: "info" | "success" | "failure",
  details?: {
    email?: string
    userId?: string
    errorMessage?: string
    metadata?: Record<string, unknown>
  }
) {
  if (!supabase || !isSupabaseConfigured) {
    return
  }

  try {
    await supabase.rpc("log_auth_audit", {
      p_kind: "client",
      p_stage: stage,
      p_status: status,
      p_email: details?.email,
      p_user_id: details?.userId,
      p_metadata: details?.metadata ?? {},
      p_error_message: details?.errorMessage,
    })
  } catch (rpcError) {
    authDebug("logAuthStage skipped/failure", {
      stage,
      status,
      rpcError: rpcError instanceof Error ? rpcError.message : String(rpcError),
    })
  }
}

function networkDiagnostics(): Record<string, unknown> {
  if (typeof navigator === "undefined") {
    return { network: "unavailable" }
  }

  const conn = (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number; rtt?: number } }).connection
  return {
    online: navigator.onLine,
    effectiveType: conn?.effectiveType ?? "unknown",
    downlink: conn?.downlink ?? "unknown",
    rtt: conn?.rtt ?? "unknown",
  }
}

function classifySupabaseError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("rate limit") || m.includes("too many requests") || m.includes("429")) return "rate_limit"
  if (m.includes("timed out") || m.includes("timeout") || m.includes("network")) return "timeout_or_network"
  if (m.includes("email") && m.includes("confirmation")) return "smtp_confirmation_failure"
  if (m.includes("invalid login credentials") || m.includes("invalid password")) return "bad_credentials"
  if (m.includes("user already registered")) return "duplicate_signup"
  if (m.includes("email not confirmed")) return "email_not_confirmed"
  if (m.includes("pgrst") || m.includes("postgrest")) return "db_rls_or_schema"
  return "unknown"
}

function mapSignupErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("429")) {
    return "Too many auth requests from this device or IP. Please wait a minute and retry. If this continues during pre-launch traffic, increase Supabase Auth rate limits in project settings."
  }

  if (message.toLowerCase().includes("error sending confirmation email")) {
    return "We could not send the confirmation email right now. Please retry after 60 seconds, verify SMTP settings/sender domain, or use another recipient inbox."
  }

  return message
}

function mapAuthErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  if (normalized.includes("rate limit") || normalized.includes("too many requests") || normalized.includes("429")) {
    return "Too many auth requests from this device or IP. Please wait a minute and retry."
  }

  if (normalized.includes("timed out") || normalized.includes("timeout")) {
    return "Auth request timed out. Please retry. If this keeps happening, check Supabase region/network latency."
  }

  return message
}

const PRODUCTION_ORIGIN = "https://sukhdevialchemy.com"

function isAllowedAuthRedirect(urlValue: string) {
  try {
    const parsed = new URL(urlValue)
    const hostname = parsed.hostname.toLowerCase()
    return hostname === "sukhdevialchemy.com" || hostname === "www.sukhdevialchemy.com"
  } catch {
    return false
  }
}

function getEmailRedirectTo() {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  if (configured && configured.trim()) {
    const trimmed = configured.trim()
    if (isAllowedAuthRedirect(trimmed)) {
      return trimmed
    }

    authDebug("Ignoring non-production VITE_AUTH_REDIRECT_URL; using production origin", {
      configured: trimmed,
      fallback: `${PRODUCTION_ORIGIN}/`,
    })
  }

  // Never derive the redirect from window.location — in dev/preview environments
  // (Codespaces, GitHub Pages preview URLs) this would embed a non-production URL
  // in confirmation emails. Always fall back to the canonical production origin.
  return `${PRODUCTION_ORIGIN}/`
}

function buildProfileFromMetadata(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
    phone: typeof user.user_metadata.phone === "string" ? user.user_metadata.phone : (user.phone ?? ""),
    role: user.user_metadata.role === "admin" ? "admin" : "customer",
    reviewOptIn: user.user_metadata.review_opt_in === true,
    marketingOptIn: user.user_metadata.marketing_opt_in === true,
  }
}

function mapProfileRow(row: Record<string, unknown>, fallbackUser?: User): UserProfile {
  return {
    id: String(row.id ?? fallbackUser?.id ?? ""),
    email: String(row.email ?? fallbackUser?.email ?? ""),
    fullName: String(row.full_name ?? fallbackUser?.user_metadata.full_name ?? ""),
    phone: String(row.phone ?? fallbackUser?.user_metadata.phone ?? fallbackUser?.phone ?? ""),
    role: row.role === "admin" ? "admin" : "customer",
    reviewOptIn: Boolean(row.review_opt_in ?? fallbackUser?.user_metadata.review_opt_in),
    marketingOptIn: Boolean(row.marketing_opt_in ?? fallbackUser?.user_metadata.marketing_opt_in),
  }
}

function normalizePhone(rawPhone: string) {
  const compact = rawPhone.trim().replace(/\s+/g, "")
  if (!compact) {
    return ""
  }

  if (compact.startsWith("+")) {
    return compact
  }

  return `+91${compact}`
}

async function saveProfile(profile: UserProfile): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  const saveStart = Date.now()
  authDebug("saveProfile started", {
    userId: profile.id,
    email: maskEmail(profile.email),
    role: profile.role,
    ...networkDiagnostics(),
  })
  await logAuthStage("profile_upsert_started", "info", {
    email: profile.email,
    userId: profile.id,
    metadata: { role: profile.role },
  })

  const { error } = await supabase.from("profiles").upsert(
    {
      id: profile.id,
      email: profile.email,
      full_name: profile.fullName,
      phone: profile.phone,
      role: profile.role,
      review_opt_in: profile.reviewOptIn,
      marketing_opt_in: profile.marketingOptIn,
    },
    { onConflict: "id" }
  )

  if (error) {
    authDebug("saveProfile FAILED", {
      userId: profile.id,
      error: error.message,
      errorCode: (error as { code?: string }).code,
      errorHint: (error as { hint?: string }).hint,
      rcaCategory: classifySupabaseError(error.message),
      durationMs: Date.now() - saveStart,
    })
    await logAuthStage("profile_upsert_failed", "failure", {
      email: profile.email,
      userId: profile.id,
      errorMessage: error.message,
      metadata: {
        errorCode: (error as { code?: string }).code,
        errorHint: (error as { hint?: string }).hint,
      },
    })
    return error.message
  }

  authDebug("saveProfile succeeded", { userId: profile.id, durationMs: Date.now() - saveStart })
  await logAuthStage("profile_upsert_succeeded", "success", {
    email: profile.email,
    userId: profile.id,
  })
  return undefined
}

export async function fetchProfile(user: User): Promise<UserProfile | null> {
  if (!supabase || !isSupabaseConfigured) {
    authDebug("fetchProfile skipped: Supabase not configured", { userId: user.id })
    return null
  }

  const fetchStart = Date.now()
  authDebug("fetchProfile started", {
    userId: user.id,
    email: maskEmail(user.email),
    ...networkDiagnostics(),
  })

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, review_opt_in, marketing_opt_in")
    .eq("id", user.id)
    .maybeSingle()

  authDebug("fetchProfile query completed", {
    userId: user.id,
    durationMs: Date.now() - fetchStart,
    hasData: Boolean(data),
    hasError: Boolean(error),
    errorMessage: error?.message,
    rcaCategory: error ? classifySupabaseError(error.message) : "none",
  })

  if (error) {
    authDebug("fetchProfile FAILED — using metadata fallback", {
      userId: user.id,
      email: maskEmail(user.email),
      error: error.message,
      errorCode: (error as { code?: string }).code,
      rcaCategory: classifySupabaseError(error.message),
    })
    console.error("[auth] fetchProfile error", error)
    return buildProfileFromMetadata(user)
  }

  if (!data) {
    authDebug("fetchProfile: no row found — attempting backfill", {
      userId: user.id,
      email: maskEmail(user.email),
    })
    const fallback = buildProfileFromMetadata(user)
    const saveError = await saveProfile(fallback)
    if (saveError) {
      authDebug("fetchProfile backfill FAILED", { userId: user.id, saveError })
      console.error("[auth] fetchProfile backfill failed", saveError)
    } else {
      authDebug("fetchProfile backfill succeeded", { userId: user.id })
    }
    return fallback
  }

  authDebug("fetchProfile row loaded", {
    userId: user.id,
    role: data.role,
    durationMs: Date.now() - fetchStart,
  })
  return mapProfileRow(data, user)
}

async function buildAuthState(session: Session | null): Promise<AuthState> {
  const user = session?.user ?? null
  if (!user) {
    return { user: null, profile: null }
  }

  let profile: UserProfile | null = null

  try {
    profile = await withTimeout(fetchProfile(user), 10000, "buildAuthState profile timed out")
  } catch (error) {
    authDebug("buildAuthState profile timed out; using metadata fallback", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })
    profile = buildProfileFromMetadata(user)
  }

  return {
    user,
    profile,
  }
}

export async function getCurrentAuthState(): Promise<AuthState> {
  if (!supabase || !isSupabaseConfigured) {
    authDebug("getCurrentAuthState skipped: Supabase not configured")
    return { user: null, profile: null }
  }

  const start = Date.now()
  authDebug("getCurrentAuthState started", networkDiagnostics())

  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      10000,
      "getSession timed out"
    )
    authDebug("getCurrentAuthState getSession completed", {
      durationMs: Date.now() - start,
      hasSession: Boolean(data.session),
      userId: data.session?.user?.id ?? null,
    })
    return buildAuthState(data.session)
  } catch (error) {
    authDebug("getCurrentAuthState FAILED", {
      error: error instanceof Error ? error.message : String(error),
      rcaCategory: error instanceof Error ? classifySupabaseError(error.message) : "unknown",
      durationMs: Date.now() - start,
      ...networkDiagnostics(),
    })
    return { user: null, profile: null }
  }
}

export function subscribeToAuthStateChanges(callback: (state: AuthState) => void) {
  if (!supabase || !isSupabaseConfigured) {
    return { unsubscribe() {} }
  }

  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    authDebug("onAuthStateChange fired", {
      event: _event,
      hasSession: Boolean(session),
      userId: session?.user?.id ?? null,
    })
    try {
      callback(await buildAuthState(session))
    } catch (error) {
      authDebug("onAuthStateChange buildAuthState FAILED", {
        error: error instanceof Error ? error.message : String(error),
        rcaCategory: error instanceof Error ? classifySupabaseError(error.message) : "unknown",
        ...networkDiagnostics(),
      })
      callback({ user: null, profile: null })
    }
  })

  return data.subscription
}

export async function signUpCustomer(input: SignUpInput): Promise<AuthResult> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("[auth] signUpCustomer blocked: Supabase auth is not configured.")
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  authDebug("signUpCustomer started", {
    email: maskEmail(input.email),
    redirectTo: getEmailRedirectTo() ?? "none",
  })
  await logAuthStage("signup_started", "info", {
    email: input.email,
    metadata: {
      redirectTo: getEmailRedirectTo() ?? "none",
    },
  })

  let data: Awaited<ReturnType<typeof supabase.auth.signUp>>["data"] | undefined
  let error: Awaited<ReturnType<typeof supabase.auth.signUp>>["error"] | undefined

  try {
    const result = await withTimeout(
      supabase.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: getEmailRedirectTo(),
          data: {
            full_name: input.fullName,
            phone: input.phone,
            role: "customer",
            review_opt_in: input.reviewOptIn,
            marketing_opt_in: input.marketingOptIn,
          },
        },
      }),
      12000,
      "Sign up request timed out"
    )

    data = result.data
    error = result.error
  } catch (exception) {
    const mappedError = mapAuthErrorMessage(exception instanceof Error ? exception.message : String(exception))
    authDebug("signUpCustomer failed unexpectedly", {
      email: maskEmail(input.email),
      error: mappedError,
    })
    await logAuthStage("signup_failed_unexpected", "failure", {
      email: input.email,
      errorMessage: mappedError,
    })
    return { user: null, profile: null, error: mappedError }
  }

  if (error) {
    const mappedError = mapSignupErrorMessage(error.message)
    authDebug("signUpCustomer failed", {
      email: maskEmail(input.email),
      error: mappedError,
    })
    await logAuthStage("signup_failed", "failure", {
      email: input.email,
      errorMessage: mappedError,
      metadata: {
        originalError: error.message,
      },
    })
    return { user: null, profile: null, error: mappedError }
  }

  if (!data) {
    return {
      user: null,
      profile: null,
      error: "Sign up failed without a response payload.",
    }
  }

  const user = data.user
  if (!user) {
    authDebug("signUpCustomer returned no user", {
      email: maskEmail(input.email),
      sessionReturned: Boolean(data.session),
    })
    await logAuthStage("signup_missing_user_payload", "failure", {
      email: input.email,
      metadata: {
        sessionReturned: Boolean(data.session),
      },
    })
    return {
      user: null,
      profile: null,
      error: "Account created, but the session is not active yet. Check your email verification settings.",
    }
  }

  if (!data.session) {
    authDebug("signUpCustomer requires email confirmation", {
      userId: user.id,
      email: maskEmail(user.email ?? input.email),
    })
    await logAuthStage("signup_requires_email_confirmation", "success", {
      email: user.email ?? input.email,
      userId: user.id,
    })
    return {
      user,
      profile: null,
      requiresEmailConfirmation: true,
      error: "Account created. Check your email and confirm the account before signing in.",
    }
  }

  const profile: UserProfile = {
    id: user.id,
    email: user.email ?? input.email,
    fullName: input.fullName,
    phone: input.phone,
    role: "customer",
    reviewOptIn: input.reviewOptIn,
    marketingOptIn: input.marketingOptIn,
  }

  let saveError: string | undefined
  try {
    saveError = await withTimeout(saveProfile(profile), 8000, "Profile save timed out")
  } catch (error) {
    authDebug("signUpCustomer profile save timed out", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      user,
      profile,
      notice: "Account created and signed in. Profile sync is still running in background.",
    }
  }

  if (saveError) {
    authDebug("signUpCustomer completed with profile sync error", {
      userId: user.id,
      error: saveError,
    })
    await logAuthStage("signup_profile_sync_failed", "failure", {
      email: user.email ?? input.email,
      userId: user.id,
      errorMessage: saveError,
    })
    return { user, profile, error: `Account created but profile sync failed: ${saveError}` }
  }

  authDebug("signUpCustomer succeeded with active session", {
    userId: user.id,
    email: maskEmail(user.email ?? input.email),
  })
  await logAuthStage("signup_completed", "success", {
    email: user.email ?? input.email,
    userId: user.id,
  })

  return { user, profile }
}

export async function signInCustomer(input: SignInInput): Promise<AuthResult> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("[auth] signInCustomer blocked: Supabase auth is not configured.")
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  authDebug("signInCustomer started", {
    email: maskEmail(input.email),
  })

  try {
    const signInStart = Date.now()
    // Use a generous timeout: HTTP round-trip is fast (~500ms), but the Supabase JS
    // client may spend extra time persisting the session, which delays Promise resolution
    // even after onAuthStateChange fires.  30 s catches most mobile/slow networks.
    const { data, error } = await withTimeout(
      supabase.auth.signInWithPassword(input),
      30000,
      "Sign in request timed out"
    )
    authDebug("signInCustomer auth request completed", {
      email: maskEmail(input.email),
      durationMs: Date.now() - signInStart,
      hasError: Boolean(error),
      hasUser: Boolean(data?.user),
    })

    if (error) {
      const mappedError = mapAuthErrorMessage(error.message)
      authDebug("signInCustomer failed", {
        email: maskEmail(input.email),
        error: mappedError,
      })
      return { user: null, profile: null, error: mappedError }
    }

    const user = data.user
    if (!user) {
      authDebug("signInCustomer returned no user", {
        email: maskEmail(input.email),
      })
      return { user: null, profile: null, error: "Sign in completed without an active user." }
    }

    const profileStart = Date.now()
    let profile: UserProfile | null = null
    let notice: string | undefined

    try {
      profile = await withTimeout(fetchProfile(user), 10000, "Profile sync timed out")
      authDebug("signInCustomer profile load completed", {
        userId: user.id,
        durationMs: Date.now() - profileStart,
        hasProfile: Boolean(profile),
      })
    } catch (profileError) {
      const fallbackProfile = buildProfileFromMetadata(user)
      authDebug("signInCustomer profile load failed after auth success; using metadata fallback", {
        userId: user.id,
        durationMs: Date.now() - profileStart,
        profileError: profileError instanceof Error ? profileError.message : String(profileError),
      })
      notice = "Signed in successfully. We are syncing your profile in the background due to a temporary network delay."

      // Best-effort profile backfill so future sign-ins don't need fallback.
      try {
        const saveError = await withTimeout(saveProfile(fallbackProfile), 5000, "Fallback profile backfill timed out")
        if (saveError) {
          authDebug("signInCustomer metadata fallback backfill failed", {
            userId: user.id,
            saveError,
          })
        }
      } catch (saveException) {
        authDebug("signInCustomer metadata fallback backfill timed out", {
          userId: user.id,
          error: saveException instanceof Error ? saveException.message : String(saveException),
        })
      }

      profile = fallbackProfile
    }

    if (!profile) {
      profile = buildProfileFromMetadata(user)
      authDebug("signInCustomer profile empty; using metadata fallback", {
        userId: user.id,
      })
      notice = "Signed in successfully. Profile details will finish syncing shortly."
    }

    authDebug("signInCustomer succeeded", {
      userId: user.id,
      email: maskEmail(user.email ?? input.email),
    })

    return {
      user,
      profile,
      notice,
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Sign in failed unexpectedly."

    // If signInWithPassword timed out on the client but auth actually succeeded
    // (onAuthStateChange already fired SIGNED_IN), recover using the active session
    // rather than showing an error to the user.
    if (rawMessage.includes("timed out") && supabase) {
      authDebug("signInCustomer signInWithPassword timed out — checking for active session", {
        email: maskEmail(input.email),
      })

      try {
        const { data: sessionData } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "getSession recovery timed out"
        )
        const recoveredUser = sessionData?.session?.user ?? null

        if (recoveredUser) {
          authDebug("signInCustomer: recovered active session after timeout — continuing", {
            userId: recoveredUser.id,
          })

          let recoveredProfile: UserProfile | null = null
          try {
            recoveredProfile = await withTimeout(fetchProfile(recoveredUser), 8000, "Recovery fetchProfile timed out")
          } catch {
            recoveredProfile = buildProfileFromMetadata(recoveredUser)
          }

          return {
            user: recoveredUser,
            profile: recoveredProfile ?? buildProfileFromMetadata(recoveredUser),
            notice: "Signed in. Your connection is a bit slow — profile synced from session.",
          }
        }
      } catch (recoveryError) {
        authDebug("signInCustomer session recovery also failed", {
          email: maskEmail(input.email),
          error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        })
      }
    }

    const message = mapAuthErrorMessage(rawMessage)
    authDebug("signInCustomer unexpected failure", {
      email: maskEmail(input.email),
      error: message,
    })
    return { user: null, profile: null, error: message }
  }
}

export async function signInAdmin(input: SignInInput): Promise<AuthResult> {
  const result = await signInCustomer(input)
  if (result.error || !result.user || !result.profile) {
    return result
  }

  if (!supabase || !isSupabaseConfigured) {
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  // Resolve role from the profiles table at admin login time so stale metadata fallback
  // does not incorrectly block valid admins.
  const { data: adminProfile, error: adminProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", result.user.id)
    .maybeSingle()

  if (adminProfileError) {
    await signOutUser()
    return {
      user: null,
      profile: null,
      error: `Unable to validate admin role: ${adminProfileError.message}`,
    }
  }

  if (adminProfile?.role === "admin") {
    return {
      ...result,
      profile: {
        ...result.profile,
        role: "admin",
      },
    }
  }

  if (result.profile.role !== "admin") {
    await signOutUser()
    return {
      user: null,
      profile: null,
      error: "This account does not have admin access.",
    }
  }

  return result
}

export async function sendPhoneOtp(input: PhoneOtpInput): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  const normalizedPhone = normalizePhone(input.phone)
  if (!normalizedPhone) {
    return "Enter a valid phone number."
  }

  authDebug("sendPhoneOtp started", { phone: normalizedPhone })
  await logAuthStage("phone_otp_send_started", "info", {
    metadata: { phone: normalizedPhone },
  })

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      shouldCreateUser: true,
      data: {
        role: "customer",
        phone: normalizedPhone,
      },
    },
  })

  if (error) {
    const mapped = mapAuthErrorMessage(error.message)
    await logAuthStage("phone_otp_send_failed", "failure", {
      errorMessage: mapped,
      metadata: { phone: normalizedPhone, originalError: error.message },
    })
    return mapped
  }

  await logAuthStage("phone_otp_sent", "success", {
    metadata: { phone: normalizedPhone },
  })
  return undefined
}

export async function verifyPhoneOtp(input: VerifyPhoneOtpInput): Promise<AuthResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  const normalizedPhone = normalizePhone(input.phone)
  if (!normalizedPhone) {
    return { user: null, profile: null, error: "Enter a valid phone number." }
  }

  authDebug("verifyPhoneOtp started", { phone: normalizedPhone })
  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: input.otp.trim(),
    type: "sms",
  })

  if (error) {
    const mapped = mapAuthErrorMessage(error.message)
    await logAuthStage("phone_otp_verify_failed", "failure", {
      errorMessage: mapped,
      metadata: { phone: normalizedPhone, originalError: error.message },
    })
    return { user: null, profile: null, error: mapped }
  }

  const user = data.user
  if (!user) {
    return { user: null, profile: null, error: "OTP verified but no active user found." }
  }

  let profile: UserProfile | null = null
  try {
    profile = await withTimeout(fetchProfile(user), 10000, "Phone OTP profile fetch timed out")
  } catch {
    profile = buildProfileFromMetadata(user)
  }

  await logAuthStage("phone_otp_verify_success", "success", {
    userId: user.id,
    metadata: { phone: normalizedPhone },
  })

  return {
    user,
    profile: profile ?? buildProfileFromMetadata(user),
  }
}

export async function signInWithGoogle(): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  const redirectTo = getEmailRedirectTo()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  })

  if (error) {
    return mapAuthErrorMessage(error.message)
  }

  return undefined
}

export async function requestPasswordReset(email: string): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
    return "Please enter your email first."
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
    redirectTo: getEmailRedirectTo(),
  })

  if (error) {
    return mapAuthErrorMessage(error.message)
  }

  return undefined
}

export function hasRecoveryParamsInUrl() {
  if (typeof window === "undefined") {
    return false
  }

  const hash = window.location.hash
  return hash.includes("type=recovery") && hash.includes("access_token=")
}

export async function updateCurrentUserPassword(newPassword: string): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  if (newPassword.trim().length < 8) {
    return "Password must be at least 8 characters long."
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return mapAuthErrorMessage(error.message)
  }

  return undefined
}

export async function signOutUser() {
  if (!supabase || !isSupabaseConfigured) {
    return
  }

  authDebug("signOutUser started")
  await supabase.auth.signOut()
  authDebug("signOutUser completed")
}

export async function resendSignupConfirmation(email: string): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    console.error("[auth] resendSignupConfirmation blocked: Supabase auth is not configured.")
    return "Supabase auth is not configured."
  }

  const trimmedEmail = email.trim()
  if (!trimmedEmail) {
    return "Please enter an email address first."
  }

  authDebug("resendSignupConfirmation started", {
    email: maskEmail(trimmedEmail),
    redirectTo: getEmailRedirectTo() ?? "none",
  })

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: trimmedEmail,
    options: {
      emailRedirectTo: getEmailRedirectTo(),
    },
  })

  if (error) {
    authDebug("resendSignupConfirmation failed", {
      email: maskEmail(trimmedEmail),
      error: error.message,
    })
    return error.message
  }

  authDebug("resendSignupConfirmation succeeded", {
    email: maskEmail(trimmedEmail),
  })
  return undefined
}
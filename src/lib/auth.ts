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
  if (details) {
    console.log(`[auth] ${message}`, details)
    return
  }

  console.log(`[auth] ${message}`)
}

function mapSignupErrorMessage(message: string) {
  if (message.toLowerCase().includes("error sending confirmation email")) {
    return "We could not send the confirmation email right now. Please retry after 60 seconds, verify SMTP settings/sender domain, or use another recipient inbox."
  }

  return message
}

function getEmailRedirectTo() {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL as string | undefined
  if (configured && configured.trim()) {
    return configured.trim()
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/`
  }

  return undefined
}

function buildProfileFromMetadata(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
    phone: typeof user.user_metadata.phone === "string" ? user.user_metadata.phone : "",
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
    phone: String(row.phone ?? fallbackUser?.user_metadata.phone ?? ""),
    role: row.role === "admin" ? "admin" : "customer",
    reviewOptIn: Boolean(row.review_opt_in ?? fallbackUser?.user_metadata.review_opt_in),
    marketingOptIn: Boolean(row.marketing_opt_in ?? fallbackUser?.user_metadata.marketing_opt_in),
  }
}

async function saveProfile(profile: UserProfile): Promise<string | undefined> {
  if (!supabase || !isSupabaseConfigured) {
    return "Supabase auth is not configured."
  }

  authDebug("saveProfile started", {
    userId: profile.id,
    email: maskEmail(profile.email),
    role: profile.role,
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
    authDebug("saveProfile failed", {
      userId: profile.id,
      error: error.message,
    })
    return error.message
  }

  authDebug("saveProfile succeeded", { userId: profile.id })
  return undefined
}

export async function fetchProfile(user: User): Promise<UserProfile | null> {
  if (!supabase || !isSupabaseConfigured) {
    return null
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, role, review_opt_in, marketing_opt_in")
    .eq("id", user.id)
    .maybeSingle()

  if (error) {
    authDebug("fetchProfile query failed, using metadata fallback", {
      userId: user.id,
      email: maskEmail(user.email),
      error: error.message,
    })
    console.error("Failed to load profile", error)
    return buildProfileFromMetadata(user)
  }

  if (!data) {
    authDebug("fetchProfile no row found, attempting backfill", {
      userId: user.id,
      email: maskEmail(user.email),
    })
    const fallback = buildProfileFromMetadata(user)
    const saveError = await saveProfile(fallback)
    if (saveError) {
      console.error("Failed to backfill profile", saveError)
    }
    return fallback
  }

  return mapProfileRow(data, user)
}

async function buildAuthState(session: Session | null): Promise<AuthState> {
  const user = session?.user ?? null
  if (!user) {
    return { user: null, profile: null }
  }

  return {
    user,
    profile: await fetchProfile(user),
  }
}

export async function getCurrentAuthState(): Promise<AuthState> {
  if (!supabase || !isSupabaseConfigured) {
    return { user: null, profile: null }
  }

  const { data } = await supabase.auth.getSession()
  return buildAuthState(data.session)
}

export function subscribeToAuthStateChanges(callback: (state: AuthState) => void) {
  if (!supabase || !isSupabaseConfigured) {
    return { unsubscribe() {} }
  }

  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    callback(await buildAuthState(session))
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

  const { data, error } = await supabase.auth.signUp({
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
  })

  if (error) {
    const mappedError = mapSignupErrorMessage(error.message)
    authDebug("signUpCustomer failed", {
      email: maskEmail(input.email),
      error: mappedError,
    })
    return { user: null, profile: null, error: mappedError }
  }

  const user = data.user
  if (!user) {
    authDebug("signUpCustomer returned no user", {
      email: maskEmail(input.email),
      sessionReturned: Boolean(data.session),
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

  const saveError = await saveProfile(profile)
  if (saveError) {
    authDebug("signUpCustomer completed with profile sync error", {
      userId: user.id,
      error: saveError,
    })
    return { user, profile, error: `Account created but profile sync failed: ${saveError}` }
  }

  authDebug("signUpCustomer succeeded with active session", {
    userId: user.id,
    email: maskEmail(user.email ?? input.email),
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

  const { data, error } = await supabase.auth.signInWithPassword(input)
  if (error) {
    authDebug("signInCustomer failed", {
      email: maskEmail(input.email),
      error: error.message,
    })
    return { user: null, profile: null, error: error.message }
  }

  const user = data.user
  if (!user) {
    authDebug("signInCustomer returned no user", {
      email: maskEmail(input.email),
    })
    return { user: null, profile: null, error: "Sign in completed without an active user." }
  }

  authDebug("signInCustomer succeeded", {
    userId: user.id,
    email: maskEmail(user.email ?? input.email),
  })

  return {
    user,
    profile: await fetchProfile(user),
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
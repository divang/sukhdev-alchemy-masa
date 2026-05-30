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

  return error?.message
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
    console.error("Failed to load profile", error)
    return buildProfileFromMetadata(user)
  }

  if (!data) {
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
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
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
    return { user: null, profile: null, error: error.message }
  }

  const user = data.user
  if (!user) {
    return {
      user: null,
      profile: null,
      error: "Account created, but the session is not active yet. Check your email verification settings.",
    }
  }

  if (!data.session) {
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
    return { user, profile, error: `Account created but profile sync failed: ${saveError}` }
  }

  return { user, profile }
}

export async function signInCustomer(input: SignInInput): Promise<AuthResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { user: null, profile: null, error: "Supabase auth is not configured." }
  }

  const { data, error } = await supabase.auth.signInWithPassword(input)
  if (error) {
    return { user: null, profile: null, error: error.message }
  }

  const user = data.user
  if (!user) {
    return { user: null, profile: null, error: "Sign in completed without an active user." }
  }

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

  await supabase.auth.signOut()
}
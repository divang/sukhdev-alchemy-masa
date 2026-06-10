import { createClient } from "@supabase/supabase-js"

// Fallbacks keep production auth functional if deploy env vars are absent during build.
// Supabase anon key is public by design and safe to ship in client bundles.
const PROD_SUPABASE_URL = "https://ndjztlhfhupvydozuski.supabase.co"
const PROD_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kanp0bGhmaHVwdnlkb3p1c2tpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNDc4OTcsImV4cCI6MjA5NTcyMzg5N30.lsQ3Tp3I1utBXKT8aB2VWUYuYjTKs3RWUPykCnCgDGA"

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? PROD_SUPABASE_URL).trim()
const supabaseAnonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? PROD_SUPABASE_ANON_KEY).trim()

export const supabaseProjectUrl = supabaseUrl.replace(/\/$/, "")

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

console.log("[auth] supabase module initialized", {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  isSupabaseConfigured,
})

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
      // OAuth callback exchange is handled explicitly in auth.ts.
      // Leaving this enabled causes double-processing of the auth code.
      detectSessionInUrl: false,
      storageKey: "sukhdevi-auth-token",
    },
  })
  : null

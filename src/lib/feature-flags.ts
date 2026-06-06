import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export type FeatureFlags = {
  enableSocialExperimentSection: boolean
  enableSocialIcons: boolean
  enableRestaurantToHomeReels: boolean
  enableChefSampleCta: boolean
  enableShiprocketIntegration: boolean
}

type FeatureFlagRow = {
  key: string
  enabled: boolean
}

const keyMap: Record<string, keyof FeatureFlags> = {
  enable_social_experiment_section: "enableSocialExperimentSection",
  enable_social_icons: "enableSocialIcons",
  enable_restaurant_to_home_reels: "enableRestaurantToHomeReels",
  enable_chef_sample_cta: "enableChefSampleCta",
  enable_shiprocket_integration: "enableShiprocketIntegration",
}

export const defaultFeatureFlags: FeatureFlags = {
  enableSocialExperimentSection: false,
  enableSocialIcons: false,
  enableRestaurantToHomeReels: false,
  enableChefSampleCta: false,
  enableShiprocketIntegration: false,
}

export async function setFeatureFlagEnabledByAdmin(key: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { success: false, error: "Supabase is not configured." }
  }

  const { error } = await supabase
    .from("feature_flags")
    .upsert(
      {
        key,
        enabled,
      },
      { onConflict: "key" }
    )

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

export async function fetchFeatureFlags(): Promise<{ flags: FeatureFlags; error?: string }> {
  if (!supabase || !isSupabaseConfigured) {
    return { flags: defaultFeatureFlags }
  }

  const { data, error } = await supabase
    .from("feature_flags")
    .select("key, enabled")
    .in("key", Object.keys(keyMap))

  if (error) {
    return { flags: defaultFeatureFlags, error: error.message }
  }

  const flags: FeatureFlags = { ...defaultFeatureFlags }

  for (const row of ((data as FeatureFlagRow[] | null) ?? [])) {
    const mappedKey = keyMap[row.key]
    if (mappedKey) {
      flags[mappedKey] = Boolean(row.enabled)
    }
  }

  return { flags }
}

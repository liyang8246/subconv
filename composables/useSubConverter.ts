// @env browser

interface PresetSummary {
  id: string
  name: string
  description: string
  rulesetCount: number
  groupCount: number
}

/**
 * Fetch available presets from the API.
 * Uses Nuxt's useFetch for SSR-friendly data loading.
 */
export async function usePresets() {
  const { data } = await useFetch<{ presets: PresetSummary[] }>('/api/presets')
  return computed(() => data.value?.presets ?? [])
}

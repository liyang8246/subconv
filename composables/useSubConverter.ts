// Composable for communicating with the API
import type { ConvertResult } from '~/server/engine/types'

interface PresetSummary {
  id: string
  name: string
  description: string
  rulesetCount: number
  groupCount: number
}

export function useSubConverter() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const result = ref<ConvertResult | null>(null)
  const presets = ref<PresetSummary[]>([])
  const presetsLoaded = ref(false)

  async function fetchPresets() {
    if (presetsLoaded.value) return
    try {
      const data = await $fetch<{ presets: PresetSummary[] }>('/api/presets')
      presets.value = data.presets || []
      presetsLoaded.value = true
    }
    catch (e) {
      console.error('Failed to load presets:', e)
    }
  }

  async function convert(options: {
    url: string
    preset: string
    emoji?: boolean
    exclude?: string
    include?: string
    udp?: boolean
    tfo?: boolean
    scv?: boolean
    port?: number
  }) {
    loading.value = true
    error.value = null
    result.value = null

    try {
      const data = await $fetch<ConvertResult | { error: string }>('/api/sub', {
        method: 'POST',
        body: options,
      })

      if ('error' in data) {
        error.value = data.error
      }
      else {
        result.value = data
      }
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : 'Conversion failed'
    }
    finally {
      loading.value = false
    }
  }

  function downloadConfig() {
    if (!result.value?.config) return
    const blob = new Blob([result.value.config], { type: 'text/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clash-config.yaml'
    a.click()
    URL.revokeObjectURL(url)
  }

  function copyConfig() {
    if (!result.value?.config) return
    navigator.clipboard.writeText(result.value.config)
  }

  return {
    loading,
    error,
    result,
    presets,
    presetsLoaded,
    fetchPresets,
    convert,
    downloadConfig,
    copyConfig,
  }
}

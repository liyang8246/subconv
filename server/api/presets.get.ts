// ============================================================
// GET /api/presets — List all available presets
// ============================================================

import { getAllPresetNames, getPresetByName } from '../codegen'

export default defineEventHandler(() => {
  const names = getAllPresetNames()
  const presets = names.map((name) => {
    const preset = getPresetByName(name)
    return preset
      ? {
          id: name,
          name: preset.name,
          description: preset.description,
          rulesetCount: preset.rulesets.length,
          groupCount: preset.groups.length,
        }
      : null
  }).filter(Boolean)

  return { presets }
})

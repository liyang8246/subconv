// ============================================================
// GET /api/rules — List all compiled-in rule files
// ============================================================

import { getAllPresetNames, getPresetByName } from '../codegen'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const presetName = query.preset as string | undefined

  if (presetName) {
    const preset = getPresetByName(presetName)
    if (!preset) {
      throw createError({ statusCode: 404, statusMessage: 'Preset not found' })
    }
    return {
      preset: presetName,
      groups: preset.groups.map(g => ({
        name: g.name,
        type: g.type,
        refCount: g.refs.length,
      })),
      rulesets: preset.rulesets.map(r => ({
        group: r.group,
        ruleCount: r.rules.length,
        inline: r.inline,
      })),
    }
  }

  // Return summary of all presets
  const presets = getAllPresetNames().map((name) => {
    const p = getPresetByName(name)
    return p
      ? { id: name, name: p.name, ruleFileCount: p.rulesets.length, groupCount: p.groups.length }
      : null
  }).filter(Boolean)

  return { presets }
})

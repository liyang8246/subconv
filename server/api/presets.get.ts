// @env node
import { ALL_PRESETS } from '../codegen'

export default defineEventHandler(() => {
  const presets = Object.entries(ALL_PRESETS).map(([id, p]) => ({
    id,
    name: p.name,
    description: p.description,
    rulesetCount: p.rulesets.length,
    groupCount: p.groups.length,
  }))

  return { presets }
})

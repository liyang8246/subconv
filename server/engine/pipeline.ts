// @env node
import type { ClashProxy } from './types'

export function processProxies(proxies: ClashProxy[]): ClashProxy[] {
  return [...proxies].sort((a, b) => a.name.localeCompare(b.name, 'zh'))
}

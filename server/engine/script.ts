// @env node
// QuickJS (WebAssembly) sandbox for user-provided config-transform scripts.
//
// The user script must define:
//   function main(config, profileName) { return config; }
// and runs inside a host-less, memory/stack-limited, time-limited QuickJS VM.
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from 'quickjs-emscripten'

/** Reject scripts larger than this once decoded (the URL length caps most of them anyway). */
export const MAX_SCRIPT_BYTES = 256 * 1024

const SCRIPT_TIMEOUT_MS = 1000
const SCRIPT_MEMORY_LIMIT_BYTES = 128 * 1024 * 1024
const SCRIPT_STACK_LIMIT_BYTES = 2 * 1024 * 1024

let modulePromise: Promise<QuickJSWASMModule> | undefined

/** Lazily initialise the shared QuickJS WASM module (one compile per process). */
function getModule(): Promise<QuickJSWASMModule> {
  modulePromise ??= getQuickJS()
  return modulePromise
}

/** Error raised for anything that goes wrong inside the sandbox (bad code, timeout, limits). */
export class ScriptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ScriptError'
  }
}

/** Lines prepended before the user script in the evaluated wrapper (see {@link runScript}). */
const SCRIPT_WRAPPER_LINES = 2

/** Extract a readable message from whatever `evalCode` threw (string, Error, or plain object). */
function scriptErrorMessage(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const e = err as { message?: unknown, name?: unknown }
    if (typeof e.message === 'string' && e.message) return e.message
    try {
      const json = JSON.stringify(err)
      if (json && json !== '{}') return json
    }
    catch { /* fall through */ }
    return String(e.name || err)
  }
  return String(err)
}

/** Line within the user script that a QuickJS error points at, or undefined if it is outside it. */
function scriptErrorLine(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined
  const line = (err as { lineNumber?: unknown }).lineNumber
  if (typeof line !== 'number' || !Number.isFinite(line)) return undefined
  const userLine = line - SCRIPT_WRAPPER_LINES
  return userLine >= 1 ? userLine : undefined
}

/**
 * Run `script` against the generated config object and return whatever `main()` returned.
 * Throws {@link ScriptError} for syntax errors, thrown errors, timeouts and limit violations.
 */
export async function runScript(
  script: string,
  config: unknown,
  profileName: string,
): Promise<Record<string, unknown>> {
  const quickjs = await getModule()

  // Pass the config in as a JSON literal so the guest only sees plain data, then
  // wrap everything in an IIFE so `return` and `main`'s function declaration are legal.
  const configJson = JSON.stringify(config ?? {})
  const code = [
    '(function () {',
    '"use strict";',
    script,
    'if (typeof main !== "function") { throw new Error("脚本必须定义 main(config, profileName) 函数"); }',
    `return main(JSON.parse(${JSON.stringify(configJson)}), ${JSON.stringify(String(profileName))});`,
    '})()',
  ].join('\n')

  let result: unknown
  try {
    result = quickjs.evalCode(code, {
      shouldInterrupt: shouldInterruptAfterDeadline(Date.now() + SCRIPT_TIMEOUT_MS),
      memoryLimitBytes: SCRIPT_MEMORY_LIMIT_BYTES,
      maxStackSizeBytes: SCRIPT_STACK_LIMIT_BYTES,
    })
  }
  catch (err) {
    const message = scriptErrorMessage(err)
    if (message === 'interrupted') {
      throw new ScriptError(`脚本执行超时（超过 ${SCRIPT_TIMEOUT_MS}ms）`)
    }
    if (/out of memory|memory limit/i.test(message)) {
      throw new ScriptError('脚本内存超限')
    }
    const line = scriptErrorLine(err)
    throw new ScriptError(line ? `${message}（脚本第 ${line} 行）` : message)
  }

  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new ScriptError('main() 必须返回一个配置对象（config）')
  }
  return result as Record<string, unknown>
}

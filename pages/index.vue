<script setup lang="ts">
import { Base64 } from 'js-base64'

const DEFAULT_SCRIPT = `function main(config, profileName) {
  return config;
}`

const url = ref('')
const selectedPreset = ref('')
const generatedLink = ref('')
const shortLink = ref('')
const shortcutService = ref('v1.mk')
const generatingShort = ref(false)

const scriptEnabled = ref(false)
const script = ref(DEFAULT_SCRIPT)
const previewOpen = ref(false)
const previewLoading = ref(false)
const previewContent = ref('')

const presets = await usePresets()

const presetDescription = computed(() => {
  if (!selectedPreset.value) return ''
  return presets.value.find(p => p.id === selectedPreset.value)?.description || ''
})

// Short link is service-specific — reset it whenever the service changes
watch(shortcutService, () => {
  shortLink.value = ''
})

// The link embeds the script, so any script edit makes a generated link stale
watch([script, scriptEnabled], () => {
  generatedLink.value = ''
  shortLink.value = ''
})

function buildPipeUrl(): string {
  return url.value
    .trim()
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('|')
}

/** Build the query string for the conversion API (script is base64url-encoded by js-base64). */
function buildQueryParams(pipeUrl: string): URLSearchParams {
  const params = new URLSearchParams()
  params.set('url', pipeUrl)
  if (selectedPreset.value) params.set('preset', selectedPreset.value)
  if (scriptEnabled.value && script.value.trim()) params.set('script', Base64.encodeURI(script.value))
  return params
}

function errorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as {
      data?: { statusMessage?: string, message?: string }
      statusMessage?: string
      message?: string
    }
    return e.data?.statusMessage || e.data?.message || e.statusMessage || e.message || '未知错误'
  }
  return String(err)
}

async function handleGenerate() {
  const pipeUrl = buildPipeUrl()
  if (!pipeUrl) return

  generatedLink.value = `${window.location.origin}/api/sub?${buildQueryParams(pipeUrl).toString()}`

  // The link changed, so any previously generated short link is stale
  shortLink.value = ''
}

async function handlePreview() {
  const pipeUrl = buildPipeUrl()
  if (!pipeUrl || previewLoading.value) return

  previewOpen.value = true
  previewLoading.value = true
  previewContent.value = ''
  try {
    previewContent.value = await $fetch<string>(
      `/api/sub?${buildQueryParams(pipeUrl).toString()}`,
      { responseType: 'text' },
    )
  }
  catch (err: unknown) {
    previewContent.value = `预览失败：${errorMessage(err)}`
  }
  finally {
    previewLoading.value = false
  }
}

async function handleShorten() {
  if (!generatedLink.value || generatingShort.value) return

  generatingShort.value = true
  try {
    const { shortUrl } = await $fetch<{ shortUrl: string }>('/api/shorten', {
      method: 'POST',
      body: { longUrl: generatedLink.value, service: shortcutService.value },
    })
    shortLink.value = shortUrl
  }
  catch {
    shortLink.value = ''
  }
  finally {
    generatingShort.value = false
  }
}

async function copyLink() {
  if (!generatedLink.value) return
  try { await navigator.clipboard.writeText(generatedLink.value) } catch { /* */ }
}

async function copyShortLink() {
  if (!shortLink.value) return
  try { await navigator.clipboard.writeText(shortLink.value) } catch { /* */ }
}
</script>

<template>
  <div class="w-full min-h-screen flex items-center justify-center p-4">
    <div class="card w-xl bg-base-100 card-md shadow-sm">
      <div class="card-body">
        <h2 class="card-title">订阅转换</h2>
        <p>本网站为无状态 Serverless 部署, 不会保存任何数据</p>

        <div class="divider my-0"></div>

        <div>
          <fieldset class="fieldset">
            <legend class="fieldset-legend">订阅链接</legend>
            <textarea
              v-model="url"
              class="textarea h-24 w-full"
              placeholder="请输入订阅链接"
            />
            <span class="label">每行一个订阅链接 仅支持 Clash 规则格式</span>
          </fieldset>

          <fieldset class="fieldset">
            <legend class="fieldset-legend">规则预设</legend>
            <select v-model="selectedPreset" class="select w-full">
              <option disabled value="">请选择预设规则</option>
              <option
                v-for="p in presets"
                :key="p.id"
                :value="p.id"
              >
                {{ p.name }}
              </option>
            </select>
            <span
              v-if="selectedPreset"
              class="label block whitespace-normal wrap-break-word"
            >
              {{ presetDescription || '暂无描述' }}
            </span>
            <span v-else class="label block whitespace-normal wrap-break-word">
              预设详情查看 <a href="https://github.com/ACL4SSR/ACL4SSR/tree/master" target="_blank" class="link link-hover">ACL4SSR</a>
            </span>
          </fieldset>

          <fieldset class="fieldset">
            <label class="label cursor-pointer justify-start gap-2">
              <input v-model="scriptEnabled" type="checkbox" class="toggle toggle-sm">
              <span>启用脚本</span>
            </label>

            <template v-if="scriptEnabled">
              <ClientOnly>
                <CodeEditor v-model="script" />
                <template #fallback>
                  <textarea
                    v-model="script"
                    class="textarea h-64 w-full font-mono text-xs"
                    placeholder="function main(config, profileName) { return config }"
                  ></textarea>
                </template>
              </ClientOnly>
              <div class="flex items-center gap-2">
                <button
                  class="btn btn-sm btn-soft"
                  :disabled="!url.trim() || previewLoading"
                  @click="handlePreview"
                >
                  <span v-if="previewLoading" class="loading loading-spinner loading-xs"></span>
                  <span v-else class="icon-[tabler--eye]"></span>
                  预览结果
                </button>
                <span class="label whitespace-normal wrap-break-word">
                  QuickJS WASM 限制 1 秒
                </span>
              </div>
            </template>
          </fieldset>
        </div>

        <div class="divider mt-0 mb-2"></div>

        <div class="join">
          <input
            readonly
            class="input join-item w-full"
            :value="generatedLink"
            placeholder="待生成订阅链接..."
          />
          <button
            class="btn join-item btn-soft"
            :disabled="!generatedLink"
            @click="copyLink"
          >
            <span class="icon-[tabler--copy]"></span>
          </button>
        </div>

        <div class="join">
          <select v-model="shortcutService" class="select join-item w-32">
            <option value="v1.mk">v1.mk</option>
            <option value="d1.mk">d1.mk</option>
          </select>
          <input
            readonly
            class="input join-item w-full"
            :value="shortLink"
            placeholder="待生成订阅短链..."
          />
          <button
            class="btn join-item btn-soft"
            title="生成短链"
            :disabled="!generatedLink || generatingShort"
            @click="handleShorten"
          >
            <span v-if="generatingShort" class="loading loading-spinner loading-xs"></span>
            <span v-else class="icon-[tabler--link]"></span>
          </button>
          <button
            class="btn join-item btn-soft"
            :disabled="!shortLink"
            @click="copyShortLink"
          >
            <span class="icon-[tabler--copy]"></span>
          </button>
        </div>

        <div class="divider my-2"></div>

        <div class="flex items-center justify-between">
          <a
            href="https://github.com/liyang8246/subconv"
            target="_blank"
            class="text-sm link link-hover"
          > GitHub </a>
          <button
            class="btn btn-primary"
            :disabled="!url.trim() || !selectedPreset"
            @click="handleGenerate"
          >
            生成订阅链接
          </button>
        </div>
      </div>
    </div>

    <dialog class="modal" :class="{ 'modal-open': previewOpen }" @close="previewOpen = false">
      <div class="modal-box max-w-4xl">
        <h3 class="text-lg font-bold">配置预览</h3>
        <div v-if="previewLoading" class="py-10 text-center">
          <span class="loading loading-spinner"></span>
        </div>
        <pre
          v-else
          class="max-h-[60vh] overflow-auto rounded-box bg-base-200 p-3 text-xs whitespace-pre"
        >{{ previewContent }}</pre>
        <div class="modal-action">
          <button class="btn" @click="previewOpen = false">关闭</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="previewOpen = false">close</button>
      </form>
    </dialog>
  </div>
</template>

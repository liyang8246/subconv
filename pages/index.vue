<script setup lang="ts">
const url = ref('')
const selectedPreset = ref('')
const generatedLink = ref('')
const shortLink = ref('')
const shortcutService = ref('v1.mk')

const presets = await usePresets()

const presetDescription = computed(() => {
  if (!selectedPreset.value) return ''
  return presets.value.find(p => p.id === selectedPreset.value)?.description || ''
})

async function handleGenerate() {
  if (!url.value.trim()) return

  const pipeUrl = url.value
    .trim()
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('|')

  if (!pipeUrl) return

  const params = new URLSearchParams()
  params.set('url', pipeUrl)
  if (selectedPreset.value) params.set('preset', selectedPreset.value)
  generatedLink.value = `${window.location.origin}/api/sub?${params.toString()}`

  // Generate short link in parallel
  shortLink.value = ''
  try {
    const { shortUrl } = await $fetch<{ shortUrl: string }>('/api/shorten', {
      method: 'POST',
      body: { longUrl: generatedLink.value, service: shortcutService.value },
    })
    shortLink.value = shortUrl
  }
  catch { /* shorten service may be unavailable */ }
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
  </div>
</template>

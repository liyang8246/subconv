<script setup lang="ts">
import { ref, onMounted } from 'vue'

const {
  presets,
  fetchPresets,
} = useSubConverter()

const url = ref('')
const selectedPreset = ref('')
const generatedLink = ref('')
const shortLink = ref('')
const shortcutService = ref('v1.mk')

onMounted(() => {
  fetchPresets()
})

function handleGenerate() {
  if (!url.value.trim()) return

  const pipeUrl = url.value
    .trim()
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .join('|')

  if (!pipeUrl) return

  // Pure frontend URL construction — no server call
  const params = new URLSearchParams()
  params.set('url', pipeUrl)
  if (selectedPreset.value) params.set('preset', selectedPreset.value)
  generatedLink.value = `${window.location.origin}/api/sub?${params.toString()}`
  shortLink.value = ''
}

async function copyLink() {
  if (!generatedLink.value) return
  try {
    await navigator.clipboard.writeText(generatedLink.value)
  }
  catch {
    // Clipboard may not be available
  }
}

async function copyShortLink() {
  if (!shortLink.value) return
  try {
    await navigator.clipboard.writeText(shortLink.value)
  }
  catch {
    // Clipboard may not be available
  }
}
</script>

<template>
  <div class="w-full min-h-screen flex items-center justify-center p-4">
    <div class="card w-xl bg-base-100 card-md shadow-sm">
      <div class="card-body">
        <h2 class="card-title">订阅转换</h2>
        <p>本网站为 Serverless 部署, 是无状态和无服务器设计</p>

        <div class="divider my-0"></div>

        <div>
          <!-- Subscription URL -->
          <fieldset class="fieldset">
            <legend class="fieldset-legend">订阅链接</legend>
            <textarea
              v-model="url"
              class="textarea h-24 w-full"
              placeholder="请输入订阅链接"
            ></textarea>
            <span class="label">每行一个订阅链接 仅支持 Clash 规则格式</span>
          </fieldset>

          <!-- Preset Selector -->
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
              v-if="selectedPreset && presets.length"
              class="label block whitespace-normal break-words"
            >
              {{
                presets.find(p => p.id === selectedPreset)?.description || ''
              }}
            </span>
          </fieldset>
        </div>

        <div class="divider mt-0 mb-2"></div>

        <!-- Generated Link -->
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

        <!-- Short Link -->
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

        <!-- Submit -->
        <div class="justify-end card-actions">
          <button
            class="btn btn-primary"
            :disabled="!url.trim()"
            @click="handleGenerate"
          >
            生成订阅链接
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

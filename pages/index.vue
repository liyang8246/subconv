<template>
  <div class="mx-auto max-w-5xl px-4 py-8">
    <!-- Header -->
    <header class="mb-8 text-center">
      <h1 class="text-3xl font-bold tracking-tight text-white">
        Subscription Converter
      </h1>
      <p class="mt-2 text-slate-400">
        Transform Clash subscriptions with ACL4SSR rules. Paste your subscription URL, choose a preset, and
        generate a clean Clash configuration.
      </p>
    </header>

    <!-- Main Form -->
    <div class="rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur">
      <!-- Subscription URL -->
      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-slate-300">Subscription URL</label>
        <input
          v-model="url"
          type="text"
          placeholder="https://example.com/sub?token=xxx | https://example.com/sub2?token=yyy"
          class="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
        <p class="mt-1 text-xs text-slate-500">
          Multiple URLs separated by | (pipe)
        </p>
      </div>

      <!-- Preset Selector -->
      <div class="mb-6">
        <label class="mb-2 block text-sm font-medium text-slate-300">Preset Configuration</label>
        <select
          v-model="preset"
          class="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">
            No preset (proxies only)
          </option>
          <option
            v-for="p in presets"
            :key="p.id"
            :value="p.id"
          >
            {{ p.name }} ({{ p.rulesetCount }} rulesets, {{ p.groupCount }} groups)
          </option>
        </select>
        <p
          v-if="selectedDescription"
          class="mt-1 text-xs text-slate-500"
        >
          {{ selectedDescription }}
        </p>
      </div>

      <!-- Basic Options -->
      <div class="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input
            v-model="emoji"
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
            checked
          >
          Emoji
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input
            v-model="udp"
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
          >
          UDP
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input
            v-model="tfo"
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
          >
          TFO
        </label>
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input
            v-model="scv"
            type="checkbox"
            class="size-4 rounded border-slate-600 bg-slate-900 accent-blue-500"
          >
          Skip Cert Verify
        </label>
      </div>

      <!-- Advanced Options Toggle -->
      <button
        class="mb-4 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        @click="showAdvanced = !showAdvanced"
      >
        {{ showAdvanced ? '▼ Hide' : '▶ Show' }} Advanced Options
      </button>

      <!-- Advanced Options -->
      <div
        v-if="showAdvanced"
        class="mb-6 space-y-4 rounded-lg border border-slate-700 bg-slate-900/50 p-4"
      >
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-400">Exclude (regex)</label>
          <input
            v-model="exclude"
            type="text"
            placeholder="e.g. (到期|剩余流量)"
            class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          >
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-400">Include (regex)</label>
          <input
            v-model="include"
            type="text"
            placeholder="e.g. (US|美国)"
            class="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          >
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-slate-400">Port</label>
          <input
            v-model="port"
            type="number"
            placeholder="7890"
            class="w-24 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
          >
        </div>
      </div>

      <!-- Convert Button -->
      <button
        :disabled="!url || loading"
        class="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleConvert"
      >
        <span
          v-if="loading"
          class="flex items-center justify-center gap-2"
        >
          <span class="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Converting...
        </span>
        <span v-else>Convert</span>
      </button>

      <!-- Error -->
      <div
        v-if="error"
        class="mt-4 rounded-lg border border-red-800 bg-red-900/30 p-3 text-sm text-red-400"
      >
        {{ error }}
      </div>
    </div>

    <!-- Results -->
    <div
      v-if="result"
      class="mt-6 rounded-xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur"
    >
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">
          Result
        </h2>
        <div class="flex gap-2 text-sm text-slate-400">
          <span>{{ result.proxyCount }} proxies</span>
          <span>&middot;</span>
          <span>{{ result.ruleCount }} rules</span>
        </div>
      </div>

      <!-- Actions -->
      <div class="mb-4 flex gap-2">
        <button
          class="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
          @click="copyConfig"
        >
          Copy
        </button>
        <button
          class="rounded-lg bg-green-700 px-4 py-2 text-sm text-white hover:bg-green-600 transition-colors"
          @click="downloadConfig"
        >
          Download
        </button>
      </div>

      <!-- Preview -->
      <pre class="max-h-96 overflow-auto rounded-lg border border-slate-700 bg-slate-950 p-4 text-xs text-slate-300 whitespace-pre-wrap font-mono">{{ result.config }}</pre>
    </div>

    <!-- Footer -->
    <footer class="mt-12 text-center text-xs text-slate-600">
      Powered by
      <a
        href="https://github.com/ACL4SSR/ACL4SSR"
        target="_blank"
        class="text-slate-500 hover:text-slate-400"
      >ACL4SSR</a>
      rules &middot; Built with Nuxt 4
    </footer>
  </div>
</template>

<script setup lang="ts">
const { loading, error, result, presets, fetchPresets, convert, downloadConfig, copyConfig } = useSubConverter()

const url = ref('')
const preset = ref('')
const emoji = ref(true)
const udp = ref(false)
const tfo = ref(false)
const scv = ref(false)
const exclude = ref('')
const include = ref('')
const port = ref(7890)
const showAdvanced = ref(false)

const selectedDescription = computed(() => {
  if (!preset.value) return ''
  const p = presets.value.find(p => p.id === preset.value)
  return p?.description || ''
})

onMounted(() => {
  fetchPresets()
})

async function handleConvert() {
  await convert({
    url: url.value,
    preset: preset.value,
    emoji: emoji.value,
    exclude: exclude.value || undefined,
    include: include.value || undefined,
    udp: udp.value || undefined,
    tfo: tfo.value || undefined,
    scv: scv.value || undefined,
    port: port.value,
  })
}
</script>

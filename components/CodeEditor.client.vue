<script setup lang="ts">
import { basicSetup, EditorView } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import '@fontsource/fira-code/latin-400.css'

const props = withDefaults(defineProps<{
  modelValue: string
  language?: 'javascript' | 'yaml'
  readonly?: boolean
  heightClass?: string
}>(), {
  language: 'javascript',
  readonly: false,
  heightClass: 'h-64',
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const host = ref<HTMLDivElement | null>(null)
let view: EditorView | null = null

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    doc: props.modelValue,
    extensions: [
      basicSetup,
      props.language === 'yaml' ? yaml() : javascript(),
      oneDark,
      EditorView.editable.of(!props.readonly),
      EditorView.theme({
        '&': { height: '100%', fontSize: '14px' },
        '.cm-scroller': {
          fontFamily: '"Fira Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          overflowY: 'auto',
        },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
      }),
    ],
    parent: host.value,
  })
})

// Keep the editor in sync when the value is changed from the outside (e.g. preview result).
watch(() => props.modelValue, (value) => {
  if (!view) return
  const current = view.state.doc.toString()
  if (current === value) return
  view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
})

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div
    ref="host"
    class="overflow-hidden rounded-box border border-base-300 bg-base-100"
    :class="heightClass"
  ></div>
</template>

// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  modules: ['@nuxt/eslint'],
  css: ['~/assets/css/main.css'],
  nitro: {
    preset: 'vercel',
  },
  vite: {
    plugins: [tailwindcss()],
  },
  compatibilityVersion: 4,
  eslint: {
    config: {
      stylistic: true,
    },
  },
})

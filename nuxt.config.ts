// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: [
    "@nuxthub/core",
    "@nuxt/ui",
    "nuxt-auth-utils",
    "nuxt-monaco-editor",
    "@nuxtjs/mdc",
  ],
  hub: {
    db: "postgresql",
  },
  ui: {
    fonts: false,
  },
  routeRules: {
    "/": { swr: 300 },
  },
  appConfig: {
    voteIntervalMinutes: 5,
  },
});
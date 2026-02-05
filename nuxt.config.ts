// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  modules: [
    "@nuxthub/core",
    "@nuxt/ui",
    "nuxt-auth-utils",
    "nuxt-monaco-editor",
  ],
  hub: {
    db: "postgresql",
  },
  ui: {
    fonts: false,
  },
  appConfig: {
    // The interval (in minutes) for each vote, must be the factor of 60 (an hour)
    voteIntervalMinutes: 5,
  },
});

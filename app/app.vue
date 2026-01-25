<script setup lang="ts">
useHead({
  titleTemplate: (title) => (title ? `${title} - votecode` : "votecode"),
});
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style>
@import "tailwindcss";
@import "@nuxt/ui";

@theme {
  --color-primary: #549d36;
}
</style>

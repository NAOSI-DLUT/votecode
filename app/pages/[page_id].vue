<script setup lang="ts">
const route = useRoute();
const pageId = computed(() => route.params.page_id as string);

useHead({
  title: () => pageId.value,
});
</script>

<template>welcome to page {{ pageId }}</template>

<script setup lang="ts">
const { page_id } = useRoute().params;

useHead({
  title: page_id as string,
});
</script>

<template>welcome to page {{ page_id }}</template>

<script setup lang="ts">
const { page } = useRoute().params;

useHead({
  title: page as string,
});
</script>

<template>welcome to page {{ page }}</template>

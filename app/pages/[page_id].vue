<script setup lang="ts">
const route = useRoute();
const pageId = computed(() => route.params.page_id as string);

useHead({
  title: () => pageId.value,
});

const mode = useState("mode", () => "preview");
const { data: pages, error } = useFetch(`/api/pages/${pageId.value}`);
if (error.value) {
  throw createError({
    statusCode: 404,
    statusMessage: "Page not found",
  });
}
</script>

<template>
  <template v-if="pages">
    <iframe
      v-if="mode === 'preview'"
      class="h-full"
      :srcdoc="pages.html"
    ></iframe>
    <MonacoEditor
      v-else
      class="h-full"
      v-model="pages.html"
      lang="html"
      :options="{ readOnly: true }"
    />
  </template>
</template>

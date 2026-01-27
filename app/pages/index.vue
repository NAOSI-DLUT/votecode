<script setup lang="ts">
const supabase = useSupabaseClient();
const toast = useToast();
const { data: pages } = useAsyncData(async () => {
  return supabase.rpc("get_pages_with_vote_count").then(({ data, error }) => {
    if (error) {
      toast.add({
        title: "Failed to fetch pages",
        description: error.message,
        color: "error",
      });
      return [];
    }
    return data;
  });
});

const createPageId = ref("");

function createPage() {
  if (!createPageId.value.trim()) return;
  supabase
    .from("pages")
    .insert({ id: createPageId.value.trim() })
    .then(({ error }) => {
      if (error) {
        toast.add({
          title: "Failed to create page",
          description: error.message,
          color: "error",
        });
      } else {
        toast.add({
          title: "Page created",
          color: "success",
        });
        createPageId.value = "";
      }
    });
}
</script>

<template>
  <UContainer>
    <UPage>
      <UPageCTA
        title="votecode"
        description="Vote on prompts, code together and share the vibe 🎉"
        variant="naked"
      />
      <UPageList>
        <UPageCard
          v-for="page in pages"
          :key="page.id"
          variant="ghost"
          :title="page.id"
          :to="`/${page.id}`"
        >
          <template #footer>
            <UBadge icon="lucide-flame" variant="subtle"
              >{{ page.vote_count }} votes</UBadge
            >
          </template>
        </UPageCard>
      </UPageList>
      <UEmpty
        variant="naked"
        icon="lucide-plus"
        :title="pages?.length ? 'Or create another page…' : 'No pages yet'"
        :description="pages?.length ? '' : 'Create a page to get started'"
      >
        <template #actions>
          <UInput v-model="createPageId" />
          <UButton @click="createPage">Create page</UButton>
        </template>
      </UEmpty>
    </UPage>
  </UContainer>
</template>

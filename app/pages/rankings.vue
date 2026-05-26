<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

type RankingResponse = {
  users: Array<{
    id: string;
    name: string;
    avatarUrl: string;
    htmlUrl: string;
    voteCount: number;
  }>;
  pages: Array<{
    id: string;
    voteCount: number;
  }>;
};

const activeTab = ref("users");
const { data, error } = await useFetch<RankingResponse>("/api/rankings");

if (error.value) {
  throw createError({
    statusCode: 500,
    statusMessage: "Failed to load rankings",
  });
}

const tabItems = [
  { label: "Users", value: "users" },
  { label: "Pages", value: "pages" },
];

const userRows = computed(() =>
  (data.value?.users ?? []).map((user, index) => ({
    rank: index + 1,
    ...user,
  })),
);

const pageRows = computed(() =>
  (data.value?.pages ?? []).map((page, index) => ({
    rank: index + 1,
    ...page,
  })),
);

const userColumns: TableColumn<(typeof userRows.value)[number]>[] = [
  { accessorKey: "rank", header: "#" },
  { accessorKey: "name", header: "User" },
  { accessorKey: "voteCount", header: "Votes" },
];

const pageColumns: TableColumn<(typeof pageRows.value)[number]>[] = [
  { accessorKey: "rank", header: "#" },
  { accessorKey: "id", header: "Page" },
  { accessorKey: "voteCount", header: "Votes" },
];
</script>

<template>
  <UContainer class="py-6">
    <UPage>
      <UPageHeader
        title="Rankings"
        description="Sorted by votes from highest to lowest"
      />

      <UTabs
        v-model="activeTab"
        :items="tabItems"
        :content="false"
      />

      <UTable
        v-if="activeTab === 'users'"
        :data="userRows"
        :columns="userColumns"
      />

      <UTable
        v-else
        :data="pageRows"
        :columns="pageColumns"
      >
        <template #id-cell="{ row }">
          <NuxtLink
            :to="`/${row.original.id}`"
            class="text-primary hover:underline"
          >
            {{ row.original.id }}
          </NuxtLink>
        </template>
      </UTable>
    </UPage>
  </UContainer>
</template>

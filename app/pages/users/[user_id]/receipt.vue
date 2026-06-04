<script setup lang="ts">
definePageMeta({ layout: false });

const route = useRoute();
const userId = computed(() => route.params.user_id as string);

const { data, error } = await useFetch(`/api/users/${userId.value}/prompts`, {
  default: () => ({ user: null, prompts: [] }) as any,
});

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: "User not found" });
}

const latestPrompt = computed(() => data.value?.prompts?.[0] ?? null);
const userName = computed(() => data.value?.user?.name ?? userId.value);

useHead({
  title: `Receipt · @${userName.value}`,
});
</script>

<template>
  <div class="w-[48mm] font-mono text-[9pt] text-black leading-[1.6]">
    <img
      src="~/assets/naosi.svg"
      alt="naosi.org"
      class="block w-[28mm] mx-auto mb-[2mm]"
    />
    <div
      class="text-center text-[12pt] font-bold tracking-[0.2em] uppercase mb-[3mm]"
    >
      votecode
    </div>

    <div v-if="latestPrompt">
      <table class="w-full border-collapse">
        <tbody>
          <tr>
            <td
              class="text-[7pt] text-black uppercase tracking-[0.1em] whitespace-nowrap pr-[2mm] align-middle w-[1%]"
            >
              User
            </td>
            <td class="text-right font-bold break-all align-middle">
              @{{ userName }}
            </td>
          </tr>
          <tr>
            <td
              class="text-[7pt] text-black uppercase tracking-[0.1em] whitespace-nowrap pr-[2mm] align-middle w-[1%]"
            >
              Date
            </td>
            <td class="text-right font-bold break-all align-middle">
              {{ new Date(latestPrompt.createdAt).toLocaleString() }}
            </td>
          </tr>
          <tr>
            <td
              class="text-[7pt] text-black uppercase tracking-[0.1em] whitespace-nowrap pr-[2mm] align-middle w-[1%]"
            >
              Page
            </td>
            <td class="text-right font-bold break-all align-middle">
              /{{ latestPrompt.pageId }}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="border-0 border-t border-black my-[2mm]" />

      <div class="text-[7pt] text-black uppercase tracking-[0.1em] mb-[1mm]">
        PROMPT
      </div>
      <div class="whitespace-pre-wrap break-all">
        {{ latestPrompt.content }}
      </div>

      <div class="border-0 border-t border-black my-[2mm]" />

      <div
        v-if="latestPrompt?.html"
        class="mt-[2mm] aspect-[9/16] overflow-hidden"
      >
        <div class="text-[7pt] text-black uppercase tracking-[0.1em] mb-[1mm]">
          PREVIEW
        </div>
        <iframe
          :srcdoc="latestPrompt.html"
          class="w-[calc(100%/0.5)] aspect-[9/16] border-2 border-black scale-50 origin-top-left"
          scrolling="no"
        />
      </div>
    </div>
  </div>
</template>

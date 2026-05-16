import type { InternalApi } from "nitropack/types";

export default function usePrompts() {
  const prompts = useState<InternalApi["/api/pages/:page_id/prompts"]["get"]>(
    "prompts",
    () => [],
  );

  async function load(pageId?: string) {
    if (!pageId) {
      prompts.value = [];
      return;
    }

    prompts.value = await $fetch<any>(`/api/pages/${pageId}/prompts`);
  }

  async function refresh(pageId?: string) {
    await load(pageId);
  }

  return { prompts, load, refresh };
}

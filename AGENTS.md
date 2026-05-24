This project is built with `nuxt@4` + `@nuxt/hub` + `@nuxt/ui` + `nuxt-auth-utils`. Please use Context7 whenever you need framework or library documentation.

- Most files from `vue`, `shared`, `utils`, `types`, and Nuxt runtime APIs are auto-imported by Nuxt. Do not add imports for them unless the codebase already does so explicitly.

## Frontend

- Prioritize Nuxt UI components and existing project patterns before writing custom Tailwind-heavy UI.
- For toast error messages, use `e.data?.message || e.message` so backend errors surface correctly.
- Keep page components concise. Avoid introducing tiny helper functions unless they materially improve clarity.
- When displaying prompt-related UI, remember each prompt has its own `html`, `status`, and `generating` state. The page view can represent either the latest approved prompt or a user-selected prompt version.
- SSE updates under `pages:${pageId}:prompts:${promptId}` represent prompt-level state changes. `pages:${pageId}:refresh` is a general refresh signal, not a dedicated html stream.

## Backend

- Authentication should use `const { user } = await getUserSession(event)` or `const { user } = await requireUserSession(event)` from `nuxt-auth-utils`.
- Keep API handlers simple. Avoid unnecessary custom types or over-validation.
- When request validation is needed, use Zod inline with `z.object({ ... }).parse(body)` rather than extracting tiny schemas.
- Database access should use `import { db, schema } from "@nuxthub/db"`.
- Prefer returning database results directly when no reshaping is needed.
- When a route has multiple sub-paths, prefer directory-based routing with `index.<method>.ts`.
- Resource lookups should return `404` when the target page/prompt/resource does not exist.

## Database

- The database schema lives in [server/db/schema.ts](/d:/Projects/votecode/server/db/schema.ts).
- Never hand-write SQL migration files under `server/db/migrations/**`.
- Make schema changes only in `server/db/schema.ts`.
- Generate migration artifacts with `pnpm nuxt db generate`.
- Prompt state is modeled separately as:
  - `status`: `pending` / `approved` / `rejected`
  - `generating`: boolean for in-flight generation
- For prompt branching, keep in mind:
  - `pages.latestPrompt` points to the currently approved prompt on the main line
  - `prompts.parent` links a prompt to its previous prompt
  - each prompt stores its own `html`

## Generate Flow

- `server/utils/generate.ts` should stay focused: generate a single prompt from `promptId`, using the prompt content and its parent html.
- Prompt submission should return quickly and continue generation in the background.
- Voting/cron selection should only decide which prompt becomes the new approved branch head. It should not re-run generation.

## Verification

- After code changes, run `pnpm test`.
- When schema or API typing changes are substantial, also run `pnpm nuxt typecheck`.

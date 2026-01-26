import { db, schema } from "@nuxthub/db";

export default defineOAuthGitHubEventHandler({
  async onSuccess(event, { user }) {
    await db
      .insert(schema.users)
      .values({
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
      })
      .onConflictDoNothing();
    await setUserSession(event, {
      user: {
        id: user.id,
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
      },
    });
    return sendRedirect(event, "/");
  },
});

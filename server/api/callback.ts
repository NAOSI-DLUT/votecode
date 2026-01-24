export default defineOAuthGitHubEventHandler({
  config: { emailRequired: true },
  async onSuccess(event, { user, tokens }) {
    await setUserSession(event, {
      user: {
        email: user.email!,
      },
    });
    return sendRedirect(event, "/");
  },
});

export default defineOAuthGitHubEventHandler({
  async onSuccess(event, { user }) {
    await setUserSession(event, {
      user: {
        name: user.name,
        avatar_url: user.avatar_url,
        html_url: user.html_url,
      },
    });
    return sendRedirect(event, "/");
  },
});

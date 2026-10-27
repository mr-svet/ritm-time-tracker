# Owner-only Agentation

Published 2026-10-26 in release 798c36078d46d113080bae629f1566dd14906bf5.
CI 40318431192: 140 tests pass, syntax and Docker build successful. Dokploy Done;
server checkout matches, container running healthy. Live HTTPS confirms anonymous
and guest sessions cannot load the panel or its bundle (403), including a forged
feedback preference. Owner login, panel appearance and logout hiding verified
locally using a synthetic account; real owner credentials were not used.

Sign in through https://ritmday.space/today?login=owner using the existing owner
password. Then reopen https://ritmday.space/?agentation=1 in the same browser.
There is no new account, password or separate login service. The existing owner
session governs access; after expiry or logout the owner must sign in again.

The server checks an unexpired owner session before adding the panel to HTML
or serving /agentation/panel.mjs. Guest sessions, expired sessions and the
feedback preference cookie do not grant access. An unauthenticated opt-in URL
still shows the normal page with its existing Developer sign-in link.

The toolbar also checks /api/session before mounting, hides on the logout
button, and rechecks every 10 seconds and on returning to the tab. This hides
an already loaded panel after expiry; it is not a replacement for server access
checks. Normal visitors do not load React or the toolbar or contact localhost.

After authenticated activation the existing feedback preference keeps the
panel enabled while browsing. /?agentation=0 turns it off. Annotation syncing
still targets the viewer's local http://localhost:4747. Browser-to-MCP delivery was verified on 2026-10-26 after Chrome's device-app
permission was enabled and the page reloaded. A control annotation from the
public landing was read via agentation_get_all_pending, resolved through MCP,
and its marker disappeared from the live browser. No design or personal journal
data was changed. MCP was exercised using the official SDK stdio client against
the configured agentation-mcp package; the active conversation does not expose
named Agentation tools directly, so the same tools were called through the SDK.

Prepared regression cases cover owner access, guests, expired sessions, forged
preference cookies, direct bundle requests and session expiry. Build, checks and publication were explicitly approved for this release.

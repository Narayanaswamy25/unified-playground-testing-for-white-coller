# Unified Playground — Selenium E2E Suite

Browser-driven end-to-end tests for `unified-playground-frontend`, backed by
a live `unified-playground-backend`. TypeScript + `selenium-webdriver` + Mocha + Chai.

## Layout

```
src/
  config/
    env.ts        # loads and validates .env
    driver.ts      # builds a Chrome/Firefox WebDriver (headless by default)
    setup.ts       # global mocha before() hook
  pages/           # Page Object Model — one class per page/flow
    BasePage.ts        # shared find/click/type/wait helpers
    LoginPage.ts
    SignupPage.ts       # SignupPage + VerificationPage
    AppShellPage.ts     # sidebar nav + logout, shared by every private page
    DashboardPage.ts
    WorkflowsPage.ts
  utils/
    authHelper.ts    # logs the shared test user in through the real UI
    otp.ts           # reads OTP codes straight from MongoDB (see below)
    testLifecycle.ts # per-test screenshot-on-failure + driver.quit()
  tests/
    auth/login.test.ts
    auth/signup.test.ts
    app/dashboard.test.ts
    app/workflows.test.ts
```

## Prerequisites

1. **Both apps running:**
   - Backend: `unified-playground-backend` → `npm run dev` (default `http://localhost:8080`)
   - Frontend: `unified-playground-frontend` → `npm run dev` (default `http://localhost:3000`)
   - A MongoDB instance the backend can reach (use its `MONGO_TEST_URI` database, not production).
2. **Chrome or Firefox installed.** Selenium 4.6+'s built-in Selenium Manager resolves
   the matching driver binary automatically — no manual chromedriver version pinning needed.
3. **A pre-seeded, email-verified test user** with a password already set and **2FA/SMS
   disabled** (the login test only covers the password flow). Create one by signing up
   through the UI once and verifying it manually, or seed it directly in MongoDB.
4. Copy `.env.example` → `.env` and fill in `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` /
   `MONGO_URI`.

```bash
npm install
cp .env.example .env   # then edit it
npm test
```

Other scripts: `npm run test:headed` (visible browser), `npm run test:auth`,
`npm run test:app`.

## Why a MongoDB connection?

Signup requires solving an emailed 6-digit OTP; login 2FA requires solving an SMS'd one.
The backend has no test/dev API backdoor for either. Both live in the
`unified_playground_users_otps` collection in plaintext (`otp` field, keyed by
`email` + `purpose`), so `src/utils/otp.ts` reads it directly instead of wiring up
a real mailbox or SMS provider in tests. `MONGO_URI` **must** point at the same
database the backend under test is using, and never at production.

## Known gaps to close next

- **No `data-testid` attributes anywhere in the frontend.** Every locator here is built
  from `id`/`name` attributes (which happen to be stable because form fields reuse their
  API field name) or from visible text/hrefs. That's workable but brittle — any copy
  change ("Create Workflow" → "New Workflow") or radix/shadcn library upgrade that
  changes `data-slot` values will silently break tests. The single highest-leverage
  change you can make is adding `data-testid` to interactive elements (buttons, the
  profile menu trigger, modals) as you touch them.
- `AppShellPage.logout()` targets `[data-slot="dropdown-menu-trigger"]`, which matches
  the **first** dropdown trigger on the page — on pages with an org/project switcher in
  the header this may not be the profile menu. Verify against a real page or add a
  `data-testid="profile-menu-trigger"` to `ProfileMenu`.
- Login 2FA (SMS OTP) and password-reset flows aren't covered yet — same OTP-from-Mongo
  pattern as signup would extend to both (`purpose: "two_factor_login"` /
  `"password_reset"`).
- Campaigns, Settings, and API keys pages aren't covered — follow the `WorkflowsPage`
  pattern (extend `AppShellPage`, one method per user action) once you need them.
- No CI wiring yet. To run in GitHub Actions: bring up both services (or a
  docker-compose stack) plus MongoDB, then run `npm test` with `HEADLESS=true`
  against a `BASE_URL` pointing at the running frontend container.
# unified_white_collar_testing

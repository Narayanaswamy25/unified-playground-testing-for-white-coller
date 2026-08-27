import { expect } from "chai";
import { WebDriver } from "selenium-webdriver";
import { buildDriver } from "../../config/driver";
import { env } from "../../config/env";
import { LoginPage } from "../../pages/LoginPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

// There's no "delete my account" feature in this app — the closest thing is
// Settings' "Leave organization" action, and it's genuinely destructive: if the
// account is the sole owner of its org, this HARD-DELETES the entire
// organization (settings.service.ts's deleteOrgAccountService). That org's
// campaigns/workflows/api-keys are not cascade-deleted — they're orphaned, not
// removed. Logs in as its own dedicated account (TEST_USER_EMAIL_DELET) rather
// than reusing the suite's cached shared session, and is opt-in only — never
// runs as part of a plain `npm test`, only via `npm run test:delete`.
(env.runDeleteAccountTest ? describe : describe.skip)("Delete account (leave organization)", function () {
  let driver: WebDriver;

  afterEach(async function () {
    if (driver) await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("leaves the organization from Settings", async function () {
    this.timeout(60_000);

    driver = buildDriver();
    const loginPage = new LoginPage(driver);
    await loginPage.loginWithPassword(env.testUserEmailDelete, env.testUserPasswordDelete);
    await loginPage.waitForUrlToContain("/dashboard");

    const settings = new SettingsPage(driver);
    await settings.open();
    await settings.openLeaveOrganizationDialog();
    await settings.confirmLeaveOrganization();

    const message = await settings.getToastMessage();
    expect(message).to.match(/Organization transferred|Organization deleted|You have left the organization/);
  });
});

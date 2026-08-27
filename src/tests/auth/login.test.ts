import { expect } from "chai";
import { By, WebDriver } from "selenium-webdriver";
import { buildDriver } from "../../config/driver";
import { env } from "../../config/env";
import { LoginPage } from "../../pages/LoginPage";
import { DashboardPage } from "../../pages/DashboardPage";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

describe("Login", function () {
  let driver: WebDriver;
  let loginPage: LoginPage;

  beforeEach(async function () {
    driver = buildDriver();
    loginPage = new LoginPage(driver);
  });

  afterEach(async function () {
    await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("logs in with a valid email and password and lands on the dashboard", async function () {
    await loginPage.loginWithPassword(env.testUserEmail, env.testUserPassword);

    if (await loginPage.isTwoFactorStepShown()) {
      this.skip(); // 2FA is enabled for this test user; covered separately once an OTP source is wired up.
    }

    const dashboard = new DashboardPage(driver);
    await dashboard.waitForUrlToContain("/dashboard");
    expect(await dashboard.isLoaded()).to.equal(true);
  });

  it("shows an error toast for a wrong password", async function () {
    await loginPage.open();
    await loginPage.submitEmail(env.testUserEmail);
    await loginPage.submitPassword("clearly-the-wrong-password");

    const message = await loginPage.getToastMessage();
    expect(message.toLowerCase()).to.include("invalid email or password");
  });

  it("rejects a malformed email address before hitting the API", async function () {
    await loginPage.open();
    await loginPage.submitEmail("not-an-email");

    // Client-side validation should keep us on the same step instead of advancing.
    const stillOnEmailStep = await loginPage.isPresent(By.id("email"));
    expect(stillOnEmailStep).to.equal(true);
  });
});

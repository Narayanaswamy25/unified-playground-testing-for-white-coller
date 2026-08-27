import { expect } from "chai";
import { WebDriver } from "selenium-webdriver";
import { buildDriver } from "../../config/driver";
import { DashboardPage } from "../../pages/DashboardPage";
import { loginAsTestUser } from "../../utils/authHelper";
import { useSharedSession } from "../../utils/sharedSession";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

describe("Dashboard", function () {
  let driver: WebDriver;
  let dashboard: DashboardPage;

  beforeEach(async function () {
    driver = buildDriver();
    await useSharedSession(driver);
    dashboard = new DashboardPage(driver);
  });

  afterEach(async function () {
    await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("loads after login", async function () {
    expect(await dashboard.isLoaded()).to.equal(true);
  });

  it("navigates to Workflows via the sidebar", async function () {
    await dashboard.goToWorkflows();
    expect(await driver.getCurrentUrl()).to.include("/workflows");
  });

  it("navigates to Logs via the sidebar", async function () {
    await dashboard.goToLogs();
    expect(await driver.getCurrentUrl()).to.include("/logs");
  });

  it("navigates to API keys via the sidebar", async function () {
    await dashboard.goToApiKeys();
    expect(await driver.getCurrentUrl()).to.include("/api-keys");
  });
});

describe("Dashboard logout", function () {
  let driver: WebDriver;
  let dashboard: DashboardPage;

  beforeEach(async function () {
    driver = buildDriver();
    // A real, dedicated login — logging out revokes this session, so it must not
    // be the one every other spec is sharing.
    await loginAsTestUser(driver);
    dashboard = new DashboardPage(driver);
  });

  afterEach(async function () {
    await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("logs out back to the login page", async function () {
    await dashboard.logout();
    expect(await driver.getCurrentUrl()).to.include("/login");
  });
});

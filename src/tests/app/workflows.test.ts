import { expect } from "chai";
import { WebDriver } from "selenium-webdriver";
import { buildDriver } from "../../config/driver";
import { WorkflowsPage } from "../../pages/WorkflowsPage";
import { useSharedSession } from "../../utils/sharedSession";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

describe("Workflows", function () {
  let driver: WebDriver;
  let workflows: WorkflowsPage;

  beforeEach(async function () {
    driver = buildDriver();
    await useSharedSession(driver);
    workflows = new WorkflowsPage(driver);
    await workflows.open();
  });

  afterEach(async function () {
    await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("shows the workflows table", async function () {
    expect(await workflows.isTableVisible()).to.equal(true);
  });

  it("opens the create workflow modal", async function () {
    await workflows.openCreateWorkflowModal();
    const modalHeading = await driver.wait(
      async () => {
        const elements = await driver.findElements({
          xpath: "//*[contains(normalize-space(text()), 'Create workflow')]",
        });
        return elements.length > 0 ? elements[0] : null;
      },
      10000,
    );
    expect(modalHeading).to.not.equal(null);
  });
});

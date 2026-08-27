import { By, until } from "selenium-webdriver";
import { BasePage } from "./BasePage";

// None of this modal's controls carry an id/name/data-testid — see
// CreateWorkflowModal.tsx in the frontend repo. Everything is scoped under the
// Radix dialog's `data-slot="dialog-content"` and matched by visible text.
const DIALOG = By.css('[data-slot="dialog-content"]');
const NAME_INPUT = By.xpath(
  '//*[@data-slot="dialog-content"]//label[contains(normalize-space(.),"Workflow name")]/following::input[1]',
);
const CONTINUE_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Continue"]',
);
const DEPLOY_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[contains(normalize-space(.),"Deploy")]',
);
const DEPLOYED_HEADING = By.xpath(
  '//*[@data-slot="dialog-content"]//h2[normalize-space(.)="Workflow deployed"]',
);
const VIEW_WORKFLOW_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="View workflow"]',
);

// "White Collar" / "Blue / Grey Collar" (Step 1), "Recruiter-led" / "Candidate-led"
// (Step 2), and each verification method's label (Step 3) are all rendered as a
// plain <button> whose title text sits in a nested <span> — same selectable shape.
function labeledOption(label: string): By {
  return By.xpath(
    `//*[@data-slot="dialog-content"]//button[.//span[normalize-space(.)="${label}"]]`,
  );
}

export type CollarType = "White Collar" | "Blue / Grey Collar";
export type IntegrationType = "Recruiter-led" | "Candidate-led";

export class CreateWorkflowModalPage extends BasePage {
  async waitForOpen(): Promise<void> {
    await this.find(DIALOG);
  }

  async enterName(name: string): Promise<void> {
    await this.type(NAME_INPUT, name);
  }

  async selectCollarType(collar: CollarType): Promise<void> {
    await this.click(labeledOption(collar));
  }

  async selectIntegrationType(type: IntegrationType): Promise<void> {
    await this.click(labeledOption(type));
  }

  async selectVerificationMethod(label: string): Promise<void> {
    await this.click(labeledOption(label));
  }

  async clickContinue(): Promise<void> {
    await this.click(CONTINUE_BUTTON);
  }

  /**
   * Recruiter-led workflows have one extra "Configuration" step (defaults are
   * already valid — auto-balance keeps marks summing correctly) that
   * candidate-led workflows skip straight past. Rather than hardcode a step
   * count per mode, click Continue until Deploy shows up, bounded so a real
   * regression still fails fast instead of hanging.
   */
  async continueUntilDeployVisible(maxClicks = 3): Promise<void> {
    for (let i = 0; i < maxClicks; i++) {
      if (await this.isPresent(DEPLOY_BUTTON, 1500)) return;
      await this.clickContinue();
    }
    if (!(await this.isPresent(DEPLOY_BUTTON, 1500))) {
      throw new Error("Deploy button never appeared after clicking Continue repeatedly.");
    }
  }

  async deploy(): Promise<void> {
    await this.click(DEPLOY_BUTTON);
    await this.find(DEPLOYED_HEADING);
  }

  /** Clicks "View workflow" on the post-deploy success screen and returns the new workflowId from the resulting URL. */
  async viewDeployedWorkflow(): Promise<string> {
    await this.click(VIEW_WORKFLOW_BUTTON);
    await this.driver.wait(until.urlMatches(/\/workflows\/[^/?#]+/), 15000);
    const url = await this.driver.getCurrentUrl();
    const match = url.match(/\/workflows\/([^/?#]+)/);
    if (!match) throw new Error(`Could not extract workflowId from URL: ${url}`);
    return match[1];
  }
}

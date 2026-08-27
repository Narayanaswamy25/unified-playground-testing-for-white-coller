import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

const CREATE_WORKFLOW_BUTTON = By.xpath(
  "//button[contains(normalize-space(.), 'Create Workflow')]",
);
const SEARCH_INPUT = By.css('input[type="search"], input[placeholder*="Search" i]');
const TABLE = By.css("table");

export class WorkflowsPage extends AppShellPage {
  async open(): Promise<void> {
    await this.goto("/workflows");
  }

  async openCreateWorkflowModal(): Promise<void> {
    await this.click(CREATE_WORKFLOW_BUTTON);
  }

  async search(term: string): Promise<void> {
    await this.type(SEARCH_INPUT, term);
  }

  async isTableVisible(): Promise<boolean> {
    return this.isPresent(TABLE);
  }
}

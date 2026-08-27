import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

const NEW_CAMPAIGN_BUTTON = By.xpath('//button[contains(normalize-space(.), "New Campaign")]');

function tab(label: string): By {
  return By.xpath(`//button[normalize-space(.)="${label}"]`);
}

export class WorkflowDetailPage extends AppShellPage {
  async open(workflowId: string): Promise<void> {
    await this.goto(`/workflows/${workflowId}`);
  }

  async openNewCampaignModal(): Promise<void> {
    await this.click(NEW_CAMPAIGN_BUTTON);
  }

  async isNewCampaignButtonPresent(): Promise<boolean> {
    return this.isPresent(NEW_CAMPAIGN_BUTTON, 3000);
  }

  async isTabPresent(label: string): Promise<boolean> {
    return this.isPresent(tab(label), 3000);
  }
}

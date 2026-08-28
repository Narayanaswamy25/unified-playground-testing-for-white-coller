import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

const NEW_CAMPAIGN_BUTTON = By.xpath('//button[contains(normalize-space(.), "New Campaign")]');
const CAMPAIGN_TAB = By.xpath('//button[normalize-space(.)="Campaign"]');

function tab(label: string): By {
  return By.xpath(`//button[normalize-space(.)="${label}"]`);
}

// The campaign list on this tab renders each campaign as a card with its name
// in a plain <span> (no link/href) — the card div itself carries the click
// handler that navigates to /campaigns/{id}, so clicking the name text (which
// bubbles up to it) is enough.
function campaignCard(campaignName: string): By {
  return By.xpath(`//span[normalize-space(.)="${campaignName}"]`);
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

  async openCampaignsTab(): Promise<void> {
    await this.click(CAMPAIGN_TAB);
  }

  /** Clicks the named campaign's card in the (already-open) Campaign tab's list, navigating to its /campaigns/{id} detail page. */
  async openCampaign(campaignName: string): Promise<void> {
    await this.click(campaignCard(campaignName));
    await this.waitForUrlToContain("/campaigns/");
  }
}

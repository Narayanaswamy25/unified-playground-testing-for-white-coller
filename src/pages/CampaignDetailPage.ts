import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

// Candidate email is masked in this table (maskEmail()), so rows are located by
// candidate name instead — tests must give each candidate a unique name.
function candidateRow(candidateName: string): By {
  return By.xpath(`//tr[.//p[normalize-space(.)="${candidateName}"]]`);
}

export class CampaignDetailPage extends AppShellPage {
  async open(campaignId: string): Promise<void> {
    await this.goto(`/campaigns/${campaignId}`);
  }

  /**
   * Text of the (auto-computed, read-only) verdict badge in this candidate's
   * row — "Hire" or "Reject", or "—" if not graded yet. Located by exact badge
   * text rather than column position — the row's column count/order varies by
   * collar type, but nothing else in it renders literally "Hire"/"Reject".
   */
  async getVerdict(candidateName: string): Promise<string> {
    const row = await this.find(candidateRow(candidateName));
    const spans = await row.findElements(By.css("span"));
    for (const span of spans) {
      const text = (await span.getText()).trim();
      if (text === "Hire" || text === "Reject") return text;
    }
    return "—";
  }
}

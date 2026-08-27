import { By, until } from "selenium-webdriver";
import { BasePage } from "./BasePage";

// None of this modal's controls carry an id/name/data-testid — see
// CreateCampaignModal.tsx in the frontend repo. Everything is scoped under the
// Radix dialog's `data-slot="dialog-content"`.
const DIALOG = By.css('[data-slot="dialog-content"]');

// Step 1 ("Create Campaign") and Step 2's "Job title" field share the exact same
// placeholder ("eg: Full Stack Engineer") — safe to reuse one locator for both
// since the steps are mutually exclusive in the DOM (only the active step renders).
const NAME_OR_JOB_TITLE_INPUT = By.xpath(
  '//*[@data-slot="dialog-content"]//input[@placeholder="eg: Full Stack Engineer"]',
);
const MANUAL_ENTRY_TOGGLE = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Manual entry"]',
);
const FULL_NAME_INPUT = By.xpath(
  '//*[@data-slot="dialog-content"]//label[contains(normalize-space(.),"Full Name")]/following::input[1]',
);
const CANDIDATE_EMAIL_INPUT = By.xpath(
  '//*[@data-slot="dialog-content"]//label[contains(normalize-space(.),"Email")]/following::input[1]',
);
const ADD_CANDIDATE_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Add"]',
);
const CREATE_NEW_ASSESSMENT_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[.//p[normalize-space(.)="Create new"]]',
);
const EXPERIENCE_TRIGGER = By.xpath(
  '//*[@data-slot="dialog-content"]//label[contains(normalize-space(.),"Experience")]/following-sibling::button[1]',
);
const SKILL_SEARCH_INPUT = By.xpath(
  '//*[@data-slot="dialog-content"]//input[contains(@placeholder,"Search skill")]',
);
// Results render as a sibling of the search input's own wrapper div, only once
// the debounced search actually resolves. Deliberately sibling-scoped (not
// `following::`) — until results exist, this matches nothing rather than
// escaping past Step 2 entirely and grabbing the footer's hidden duplicate
// Continue button (always present in the DOM, permanently invisible).
const FIRST_SKILL_RESULT = By.xpath(
  '//*[@data-slot="dialog-content"]//input[contains(@placeholder,"Search skill")]/parent::div/following-sibling::div[1]//button[1]',
);
const SKIP_FOR_NOW_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Skip for now"]',
);
const SUCCESS_HEADING = By.xpath(
  '//*[@data-slot="dialog-content"]//h2[normalize-space(.)="Assessment sent successfully!"]',
);
const SUCCESS_CLOSE_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Close"]',
);

function experienceOption(label: string): By {
  return By.xpath(`//*[@data-slot="dialog-content"]//button[normalize-space(.)="${label}"]`);
}

// The footer renders a visually-hidden duplicate of the primary action button
// ahead of the real, visible one in DOM order (see CreateCampaignModal.tsx's
// footer — a `className="hidden"` copy for some layout/analytics purpose).
// `[last()]` always lands on the later, visible one; `contains()` matches
// either copy regardless of exact wording ("Continue" vs "Continue ›").
function footerButton(textContains: string): By {
  return By.xpath(
    `(//*[@data-slot="dialog-content"]//button[contains(normalize-space(.),"${textContains}")])[last()]`,
  );
}

export class CreateCampaignModalPage extends BasePage {
  async waitForOpen(): Promise<void> {
    await this.find(DIALOG);
  }

  // ── Step 1: Create Campaign ──────────────────────────────────────────────

  async enterCampaignName(name: string): Promise<void> {
    await this.type(NAME_OR_JOB_TITLE_INPUT, name);
  }

  async switchToManualEntry(): Promise<void> {
    await this.click(MANUAL_ENTRY_TOGGLE);
  }

  async addCandidate(name: string, email: string): Promise<void> {
    await this.type(FULL_NAME_INPUT, name);
    await this.type(CANDIDATE_EMAIL_INPUT, email);
    await this.click(ADD_CANDIDATE_BUTTON);
  }

  /** Step 1's Continue creates the campaign on the backend — a real write, not just local state. */
  async continueFromCandidates(): Promise<void> {
    await this.click(footerButton("Continue"));
  }

  // ── Step 2: Assessment details (the "job posting" fields) ───────────────

  async startNewAssessment(): Promise<void> {
    await this.click(CREATE_NEW_ASSESSMENT_BUTTON);
  }

  async enterJobTitle(title: string): Promise<void> {
    await this.type(NAME_OR_JOB_TITLE_INPUT, title);
  }

  async selectExperience(label: string): Promise<void> {
    await this.click(EXPERIENCE_TRIGGER);
    await this.click(experienceOption(label));
  }

  /** Searches the skill library and adds the first matching result — async-loaded, so this waits for a result to appear. */
  async addSkill(query: string): Promise<void> {
    await this.type(SKILL_SEARCH_INPUT, query);
    await this.click(FIRST_SKILL_RESULT);
  }

  async enterJobDescription(text: string): Promise<void> {
    await this.type(
      By.xpath(
        '//*[@data-slot="dialog-content"]//textarea[@placeholder="Paste the Job Description for the particular job role."]',
      ),
      text,
    );
  }

  async continueFromAssessmentDetails(): Promise<void> {
    await this.click(footerButton("Continue"));
  }

  // ── Step 3: Assessment configuration → AI question generation ───────────

  /** Triggers a real OpenAI call on the backend; generation can take a while. */
  async generateAssessment(timeoutMs = 120_000): Promise<void> {
    await this.click(footerButton("Generate Assessment"));
    // The footer is hidden entirely while generating and remounts once the
    // real questions come back — reappearance of Continue is the completion signal.
    await this.driver.wait(until.elementLocated(footerButton("Continue")), timeoutMs);
  }

  // ── Step 4: Review questions → Send ──────────────────────────────────────

  async continueToReview(): Promise<void> {
    await this.click(footerButton("Continue"));
  }

  async sendAssessment(): Promise<void> {
    await this.click(footerButton("Send Assessment"));
  }

  async skipSavingConfig(): Promise<void> {
    await this.click(SKIP_FOR_NOW_BUTTON);
  }

  async waitForSendSuccess(): Promise<void> {
    await this.find(SUCCESS_HEADING);
  }

  async close(): Promise<void> {
    await this.click(SUCCESS_CLOSE_BUTTON);
  }
}

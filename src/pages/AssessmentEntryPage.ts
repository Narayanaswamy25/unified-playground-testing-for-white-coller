import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";

// record-assessment-frontend is a separate app/origin from the rest of this
// suite — pages here navigate with an absolute URL rather than BasePage.goto(),
// which prefixes env.baseUrl (the unified-playground frontend's origin).
const EMAIL_INPUT = By.id("email");
// The terms control is a <label> wrapping a plain <div> click target, not a
// native checkbox — the div is what actually carries the onClick handler.
const TERMS_CLICK_TARGET = By.xpath(
  '//label[contains(normalize-space(.),"I agree to the Terms")]//div[1]',
);
const CONTINUE_BUTTON = By.xpath(
  '//button[@type="submit"][contains(normalize-space(.),"Continue")]',
);

export class AssessmentEntryPage extends BasePage {
  async open(url: string): Promise<void> {
    await this.driver.get(url);
  }

  async getPrefilledEmail(): Promise<string | null> {
    const el = await this.find(EMAIL_INPUT);
    return el.getAttribute("value");
  }

  async acceptTermsAndContinue(): Promise<void> {
    await this.click(TERMS_CLICK_TARGET);
    await this.click(CONTINUE_BUTTON);
  }
}

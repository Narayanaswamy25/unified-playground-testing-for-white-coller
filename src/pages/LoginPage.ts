import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";

const EMAIL_INPUT = By.id("email");
const PASSWORD_INPUT = By.id("password");
const SUBMIT_BUTTON = By.css('form button[type="submit"]');
const OTP_INPUT = By.id("code");
const TOAST = By.css("[data-sonner-toast]");

export class LoginPage extends BasePage {
  async open(): Promise<void> {
    await this.goto("/login");
  }

  async submitEmail(email: string): Promise<void> {
    await this.type(EMAIL_INPUT, email);
    await this.click(SUBMIT_BUTTON);
  }

  async submitPassword(password: string): Promise<void> {
    await this.type(PASSWORD_INPUT, password);
    await this.click(SUBMIT_BUTTON);
  }

  /** Full happy-path login for a user that already has a password set and no 2FA challenge. */
  async loginWithPassword(email: string, password: string): Promise<void> {
    await this.open();
    await this.submitEmail(email);
    await this.submitPassword(password);
  }

  async submitTwoFactorCode(code: string): Promise<void> {
    await this.type(OTP_INPUT, code);
    await this.click(SUBMIT_BUTTON);
  }

  async isTwoFactorStepShown(): Promise<boolean> {
    return this.isPresent(OTP_INPUT);
  }

  async getToastMessage(): Promise<string> {
    return this.textOf(TOAST);
  }
}

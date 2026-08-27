import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

// The trigger button and the confirm-dialog button both read exactly "Leave
// organization" (settings/page.tsx uses the same string in both places
// regardless of owner/non-owner role) — before the dialog opens only the
// trigger exists in the DOM, but the confirm click must be scoped to the
// dialog to avoid re-clicking the trigger once both are present.
const LEAVE_ORG_TRIGGER = By.xpath('//button[normalize-space(.)="Leave organization"]');
const CONFIRM_LEAVE_ORG_BUTTON = By.xpath(
  '//*[@data-slot="dialog-content"]//button[normalize-space(.)="Leave organization"]',
);
const TOAST = By.css("[data-sonner-toast]");

export class SettingsPage extends AppShellPage {
  async open(): Promise<void> {
    await this.goto("/settings");
  }

  async openLeaveOrganizationDialog(): Promise<void> {
    await this.click(LEAVE_ORG_TRIGGER);
  }

  async confirmLeaveOrganization(): Promise<void> {
    await this.click(CONFIRM_LEAVE_ORG_BUTTON);
  }

  async getToastMessage(): Promise<string> {
    return this.textOf(TOAST);
  }
}

import { By } from "selenium-webdriver";
import { BasePage } from "./BasePage";

const LOGOUT_ITEM = By.xpath("//*[contains(normalize-space(text()), 'Log out')]");
// aria-label, not [data-slot="dropdown-menu-trigger"] — the header's project switcher
// uses the same shadcn trigger component, and that generic selector matches it first.
const PROFILE_MENU_TRIGGER = By.css('button[aria-label="Profile"]');

/** Shared chrome (sidebar nav + profile menu) available on every /(private) page. */
export class AppShellPage extends BasePage {
  private navLink(href: string) {
    return By.css(`a[href="${href}"]`);
  }

  async navigateTo(href: string): Promise<void> {
    await this.click(this.navLink(href));
    await this.waitForUrlToContain(href);
  }

  async logout(): Promise<void> {
    await this.click(PROFILE_MENU_TRIGGER);
    await this.click(LOGOUT_ITEM);
    await this.waitForUrlToContain("/login");
  }
}

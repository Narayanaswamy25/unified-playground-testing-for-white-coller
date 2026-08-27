import { By } from "selenium-webdriver";
import { AppShellPage } from "./AppShellPage";

const HEADING = By.css("h1, h2");

export class DashboardPage extends AppShellPage {
  async open(): Promise<void> {
    await this.goto("/dashboard");
  }

  async goToWorkflows(): Promise<void> {
    await this.navigateTo("/workflows");
  }

  async goToLogs(): Promise<void> {
    await this.navigateTo("/logs");
  }

  async goToApiKeys(): Promise<void> {
    await this.navigateTo("/api-keys");
  }

  async isLoaded(): Promise<boolean> {
    return this.isPresent(HEADING);
  }
}

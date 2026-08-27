import { By, until, WebDriver, WebElement } from "selenium-webdriver";
import { env } from "../config/env";

export abstract class BasePage {
  constructor(protected readonly driver: WebDriver) {}

  protected async find(locator: By): Promise<WebElement> {
    return this.driver.wait(until.elementLocated(locator), env.defaultTimeout);
  }

  protected async findVisible(locator: By): Promise<WebElement> {
    const element = await this.find(locator);
    await this.driver.wait(until.elementIsVisible(element), env.defaultTimeout);
    return element;
  }

  protected async click(locator: By): Promise<void> {
    const element = await this.findVisible(locator);
    await this.driver.wait(until.elementIsEnabled(element), env.defaultTimeout);
    await element.click();
  }

  protected async type(locator: By, text: string): Promise<void> {
    const element = await this.findVisible(locator);
    await element.clear();
    await element.sendKeys(text);
  }

  async textOf(locator: By): Promise<string> {
    const element = await this.findVisible(locator);
    return element.getText();
  }

  async isPresent(locator: By, timeoutMs = 2000): Promise<boolean> {
    try {
      await this.driver.wait(until.elementLocated(locator), timeoutMs);
      return true;
    } catch {
      return false;
    }
  }

  async waitForUrlToContain(fragment: string): Promise<void> {
    await this.driver.wait(until.urlContains(fragment), env.defaultTimeout);
  }

  async goto(path: string): Promise<void> {
    await this.driver.get(`${env.baseUrl}${path}`);
  }
}

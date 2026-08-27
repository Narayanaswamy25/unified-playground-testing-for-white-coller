import { WebDriver } from "selenium-webdriver";
import { env } from "../config/env";
import { LoginPage } from "../pages/LoginPage";

/**
 * Logs the shared test user in via the real UI form. Assumes no 2FA is enabled for
 * this account. Only use this for specs that must exercise a genuinely fresh
 * session — e.g. a logout spec, which revokes it. Everything else should call
 * `useSharedSession` from `sharedSession.ts` instead, to avoid hitting /login (and
 * the DB behind it) on every single test.
 */
export async function loginAsTestUser(driver: WebDriver): Promise<void> {
  const loginPage = new LoginPage(driver);
  await loginPage.loginWithPassword(env.testUserEmail, env.testUserPassword);
  await loginPage.waitForUrlToContain("/dashboard");
}

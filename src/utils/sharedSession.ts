import jwt from "jsonwebtoken";
import { until, WebDriver } from "selenium-webdriver";
import { env } from "../config/env";
import { LoginPage } from "../pages/LoginPage";

// Keys the frontend's lib/auth-client.ts stores the session under — duplicated here
// (this suite doesn't import frontend source) so a captured session can be replayed
// into a fresh browser without going through the login form again.
const AUTH_ACCESS_TOKEN_KEY = "auth_access_token";
const AUTH_USER_KEY = "auth_user";
const AUTH_TOKEN_COOKIE = "auth_token";
const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type CachedSession = { accessToken: string; userJson: string | null };

// Module-level, so every spec in this process shares the one real login below
// instead of each triggering its own POST /login (and its DB round trips).
let cachedSessionPromise: Promise<CachedSession> | null = null;

function isStillValid(accessToken: string): boolean {
  try {
    const payload = jwt.verify(accessToken, env.jwtAccessSecret) as jwt.JwtPayload;
    // Leave a safety margin so a token doesn't expire mid-test after passing this check.
    return typeof payload.exp === "number" && payload.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}

async function establishSharedSession(driver: WebDriver): Promise<CachedSession> {
  const loginPage = new LoginPage(driver);
  await loginPage.loginWithPassword(env.testUserEmail, env.testUserPassword);
  await loginPage.waitForUrlToContain("/dashboard");

  const accessToken = (await driver.executeScript(
    `return window.localStorage.getItem('${AUTH_ACCESS_TOKEN_KEY}');`,
  )) as string | null;
  const userJson = (await driver.executeScript(
    `return window.localStorage.getItem('${AUTH_USER_KEY}');`,
  )) as string | null;

  if (!accessToken) {
    throw new Error("Shared login succeeded but no access token was found in localStorage afterwards.");
  }

  return { accessToken, userJson };
}

/**
 * Real UI login happens at most once per test run. Every other spec that needs to be
 * authenticated calls this instead of the login form: it hands back the one cached
 * access token, transparently re-logging in if it has expired or hasn't been minted yet.
 */
async function getSharedSession(driver: WebDriver): Promise<CachedSession> {
  if (cachedSessionPromise) {
    const cached = await cachedSessionPromise;
    if (isStillValid(cached.accessToken)) return cached;
    cachedSessionPromise = null;
  }
  cachedSessionPromise = establishSharedSession(driver);
  return cachedSessionPromise;
}

/**
 * Authenticates `driver` using the shared session instead of the login form, writing
 * the cached access token straight into localStorage/cookies the way the app itself
 * does on a real login. Falls back to a real login (via this same driver) the first
 * time it's called in a run, or whenever the cached token has expired.
 */
export async function useSharedSession(driver: WebDriver): Promise<void> {
  const session = await getSharedSession(driver);

  if ((await driver.getCurrentUrl()).includes("/dashboard")) {
    return; // this driver is the one that just performed the real login above
  }

  // Storage is origin-scoped, so a page from the app must be loaded before it can be written.
  await driver.get(`${env.baseUrl}/login`);
  await driver.executeScript(
    `window.localStorage.setItem('${AUTH_ACCESS_TOKEN_KEY}', arguments[0]);
     if (arguments[1]) window.localStorage.setItem('${AUTH_USER_KEY}', arguments[1]);
     document.cookie = '${AUTH_TOKEN_COOKIE}=' + arguments[0] + '; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax';`,
    session.accessToken,
    session.userJson,
  );

  await driver.get(`${env.baseUrl}/dashboard`);
  await driver.wait(until.urlContains("/dashboard"), env.defaultTimeout);
}

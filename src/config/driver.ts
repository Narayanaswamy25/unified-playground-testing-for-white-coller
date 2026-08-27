import { Builder, ThenableWebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
import firefox from "selenium-webdriver/firefox";
import { env } from "./env";

export function buildDriver(): ThenableWebDriver {
  if (env.browser === "firefox") {
    const options = new firefox.Options();
    if (env.headless) options.addArguments("-headless");
    return new Builder().forBrowser("firefox").setFirefoxOptions(options).build();
  }

  const options = new chrome.Options();
  if (env.headless) options.addArguments("--headless=new");
  options.addArguments("--window-size=1440,900", "--disable-gpu", "--no-sandbox");
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

/**
 * For specs that need a real getUserMedia camera grant (e.g. record-assessment's
 * identity-verification step) without a native permission prompt blocking the
 * run. `--use-fake-ui-for-media-stream` auto-accepts the prompt without
 * replacing the actual device — deliberately NOT paired with
 * `--use-fake-device-for-media-stream`, so Chrome uses the machine's real webcam.
 * Always headed.
 */
export function buildDriverWithRealCamera(): ThenableWebDriver {
  const options = new chrome.Options();
  options.addArguments(
    "--window-size=1440,900",
    "--disable-gpu",
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
  );
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

/**
 * Same as buildDriverWithRealCamera, plus auto-selects the screen-share source
 * for getDisplayMedia (record-assessment's exam pre-flight requires "Entire
 * screen") instead of leaving the native picker dialog for a human to click —
 * `--auto-select-desktop-capture-source` matches the source name case-insensitively.
 */
export function buildDriverWithRealMedia(desktopCaptureSource = "Entire screen"): ThenableWebDriver {
  const options = new chrome.Options();
  options.addArguments(
    "--window-size=1440,900",
    "--disable-gpu",
    "--no-sandbox",
    "--use-fake-ui-for-media-stream",
    `--auto-select-desktop-capture-source=${desktopCaptureSource}`,
  );
  return new Builder().forBrowser("chrome").setChromeOptions(options).build();
}

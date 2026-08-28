import * as fs from "fs";
import * as path from "path";
import { WebDriver } from "selenium-webdriver";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", "screenshots");

export async function saveScreenshotOnFailure(
  driver: WebDriver,
  mochaContext: Mocha.Context,
): Promise<void> {
  // `currentTest` is only populated inside an actual afterEach hook — it's
  // undefined when this is called from a catch block within the test body
  // itself (e.g. a spec that builds its own driver instead of relying on a
  // shared beforeEach/afterEach pair). Fall back to `mochaContext.test`, which
  // is set in both places, so screenshot capture doesn't silently no-op there.
  const test = mochaContext.currentTest ?? mochaContext.test;
  if (mochaContext.currentTest && mochaContext.currentTest.state !== "failed") return;

  await saveScreenshot(driver, test?.fullTitle() ?? "unknown-test");
}

export async function saveScreenshot(driver: WebDriver, name: string): Promise<void> {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const safeName = name.replace(/[^a-z0-9]+/gi, "-");
  const filePath = path.join(SCREENSHOT_DIR, `${safeName}.png`);

  try {
    const image = await driver.takeScreenshot();
    fs.writeFileSync(filePath, image, "base64");
    console.log(`Saved failure screenshot: ${filePath}`);
  } catch (error) {
    console.warn("Could not capture failure screenshot:", error);
  }
}

export async function quitDriverSafely(driver: WebDriver | undefined): Promise<void> {
  if (!driver) return;
  try {
    await driver.quit();
  } catch {
    // driver already gone, nothing to do
  }
}

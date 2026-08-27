import * as fs from "fs";
import * as path from "path";
import { WebDriver } from "selenium-webdriver";

const SCREENSHOT_DIR = path.join(__dirname, "..", "..", "screenshots");

export async function saveScreenshotOnFailure(
  driver: WebDriver,
  mochaContext: Mocha.Context,
): Promise<void> {
  if (mochaContext.currentTest?.state !== "failed") return;

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const safeName = (mochaContext.currentTest?.fullTitle() ?? "unknown-test").replace(
    /[^a-z0-9]+/gi,
    "-",
  );
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

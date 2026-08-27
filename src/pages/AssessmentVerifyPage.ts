import { By, until } from "selenium-webdriver";
import { BasePage } from "./BasePage";

const VIDEO = By.css("video");
const CAPTURE_BUTTON = By.xpath('//button[contains(normalize-space(.),"Capture Photo")]');

export class AssessmentVerifyPage extends BasePage {
  /** Confirms getUserMedia actually granted a live camera stream (readyState >= HAVE_CURRENT_DATA), not just that a <video> tag exists. */
  async waitForCameraStream(timeoutMs = 15_000): Promise<void> {
    const video = await this.driver.wait(until.elementLocated(VIDEO), timeoutMs);
    await this.driver.wait(async () => {
      const readyState = await this.driver.executeScript("return arguments[0].readyState;", video);
      return (readyState as number) >= 2;
    }, timeoutMs);
  }

  /**
   * Face detection auto-captures (after holding a centered face for 1.5s) and
   * auto-confirms — no click needed as long as a real face is in frame. This
   * just waits for the resulting redirect to /start. Falls back to manually
   * clicking "Capture Photo" if it's enabled but auto-capture hasn't fired yet.
   */
  async completeVerification(timeoutMs = 60_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await this.driver.getCurrentUrl()).includes("/start")) return;
      try {
        const button = await this.driver.findElement(CAPTURE_BUTTON);
        if (await button.isEnabled()) await button.click();
      } catch {
        // Not present, or it disappeared between the find and the click (auto-capture
        // already fired) — either way this fallback click just wasn't needed this tick.
      }
      await this.driver.sleep(500);
    }
    throw new Error("Verification never completed (redirect to /start) within the timeout — no face detected?");
  }
}

import { By, until } from "selenium-webdriver";
import { GeneratedQuestion } from "../utils/campaignLookup";
import { BasePage } from "./BasePage";

const SHARE_SCREEN_BUTTON = By.xpath('//button[contains(normalize-space(.),"Share My Screen")]');
const ENABLE_CAMERA_BUTTON = By.xpath('//button[contains(normalize-space(.),"Enable Camera")]');
const BEGIN_ASSESSMENT_BUTTON = By.xpath('//button[contains(normalize-space(.),"Begin Assessment")]');
const NEXT_QUESTION_BUTTON = By.xpath('//button[normalize-space(.)="Next Question"]');
const SUBMIT_ASSESSMENT_BUTTON = By.xpath('//button[contains(normalize-space(.),"Submit Assessment")]');
const CONFIRM_SUBMIT_BUTTON = By.xpath('//button[contains(normalize-space(.),"Confirm & Submit")]');
const ANSWER_TEXTAREA = By.css("textarea");
const RECONNECT_CAMERA_BUTTON = By.xpath('//button[contains(normalize-space(.),"Reconnect Camera")]');
// The only text-base/font-bold <p> on the exam page is the current question's
// own text (start/page.tsx) — used to look the question up in the Mongo-fetched
// list by content rather than trusting array-index alignment with the DOM.
const QUESTION_TEXT = By.css("p.text-base.font-bold");

function normalizeText(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export class AssessmentStartPage extends BasePage {
  async shareScreen(): Promise<void> {
    await this.click(SHARE_SCREEN_BUTTON);
  }

  async enableCameraAndMic(): Promise<void> {
    await this.click(ENABLE_CAMERA_BUTTON);
  }

  async waitForBeginAssessmentEnabled(timeoutMs = 20_000): Promise<void> {
    const button = await this.driver.wait(until.elementLocated(BEGIN_ASSESSMENT_BUTTON), timeoutMs);
    await this.driver.wait(until.elementIsEnabled(button), timeoutMs);
  }

  async beginAssessment(): Promise<void> {
    await this.click(BEGIN_ASSESSMENT_BUTTON);
  }

  /** Next Question stays in the DOM but disabled on the last question (disabled={currentIndex === questions.length - 1} in start/page.tsx). */
  private async isOnLastQuestion(): Promise<boolean> {
    const button = await this.driver.findElement(NEXT_QUESTION_BUTTON);
    return !(await button.isEnabled());
  }

  private async getCurrentQuestionText(): Promise<string> {
    return (await this.textOf(QUESTION_TEXT)).trim();
  }

  /**
   * The exam monitors the camera continuously (not just at verification) and
   * shows a blocking "Assessment paused — no face detected" overlay with a
   * "Reconnect Camera/Mic" button whenever it loses a face for two consecutive
   * frames — e.g. if whoever's in frame steps away mid-run. Clicking Reconnect
   * only actually clears the overlay once a face is visible again, so this
   * polls rather than clicking once and hoping.
   */
  private async resumeIfPaused(timeoutMs = 30_000): Promise<void> {
    if (!(await this.isPresent(RECONNECT_CAMERA_BUTTON, 500))) return;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const button = await this.driver.findElement(RECONNECT_CAMERA_BUTTON);
        await button.click();
      } catch {
        // Already cleared, or not clickable yet this tick — either way, recheck below.
      }
      await this.driver.sleep(1000);
      if (!(await this.isPresent(RECONNECT_CAMERA_BUTTON, 500))) return;
    }
    throw new Error(
      "Assessment stayed paused (no face detected) past the timeout — make sure you stay visible to the camera for the whole exam, not just the identity check.",
    );
  }

  /** Matches by content, not array position — the exam session isn't guaranteed to render questions in the same order they're stored in. */
  private findQuestionByText(questions: GeneratedQuestion[], displayedText: string): GeneratedQuestion {
    const normalized = normalizeText(displayedText);
    const match = questions.find((q) => normalizeText(q.text) === normalized);
    if (!match) {
      throw new Error(
        `No Mongo-stored question matches the on-screen text "${displayedText}". Known question texts: ${JSON.stringify(
          questions.map((q) => q.text),
        )}`,
      );
    }
    return match;
  }

  /**
   * Answers the currently-displayed question. `wantCorrect` picks the real
   * correct answer (read from Mongo — see campaignLookup.getGeneratedQuestions)
   * when true, or a deliberately wrong one when false — used by the Reject
   * verdict spec, which needs the candidate to actually fail the assessment.
   */
  private async answerCurrentQuestion(question: GeneratedQuestion, wantCorrect: boolean): Promise<void> {
    if (question.type === "short-answer" || question.type === "long-answer") {
      const text = wantCorrect
        ? question.correctAnswer
        : "This answer is deliberately wrong — submitted by an automated end-to-end test covering the Reject verdict.";
      await this.type(ANSWER_TEXTAREA, text);
      return;
    }

    // mcq / true-false — click the option matching (or, for wantCorrect=false, any option other than) the correct answer.
    const buttons = await this.driver.findElements(By.css("button"));
    const optionTexts: string[] = [];
    const target = normalizeText(question.correctAnswer);
    for (const button of buttons) {
      if (!(await button.isDisplayed())) continue;
      const text = await button.getText();
      if (!text.trim()) continue;
      optionTexts.push(text);
      const isCorrectOption = normalizeText(text) === target;
      if (isCorrectOption === wantCorrect) {
        await button.click();
        return;
      }
    }
    throw new Error(
      `Could not find ${wantCorrect ? "an option button matching" : "any option button other than"} correct answer ` +
        `"${question.correctAnswer}" for question "${question.text}". On-screen option texts: ${JSON.stringify(optionTexts)}`,
    );
  }

  /** Walks every question, matching each on-screen question to its Mongo record by text, answering each correctly (or, if `correct` is false, incorrectly), then submits. */
  async answerAllQuestionsAndSubmit(
    questions: GeneratedQuestion[],
    { correct = true, maxQuestions = 30 }: { correct?: boolean; maxQuestions?: number } = {},
  ): Promise<void> {
    for (let i = 0; i < maxQuestions; i++) {
      await this.resumeIfPaused();
      const displayedText = await this.getCurrentQuestionText();
      const question = this.findQuestionByText(questions, displayedText);
      await this.answerCurrentQuestion(question, correct);
      await this.resumeIfPaused();
      if (await this.isOnLastQuestion()) break;
      await this.click(NEXT_QUESTION_BUTTON);
    }

    await this.resumeIfPaused();
    await this.click(SUBMIT_ASSESSMENT_BUTTON);
    await this.resumeIfPaused();
    await this.click(CONFIRM_SUBMIT_BUTTON);
  }

  async waitForSubmitted(timeoutMs = 30_000): Promise<void> {
    await this.driver.wait(until.urlContains("/submitted"), timeoutMs);
  }
}

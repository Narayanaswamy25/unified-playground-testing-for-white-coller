import { expect } from "chai";
import { WebDriver } from "selenium-webdriver";
import { buildDriver, buildDriverWithRealMedia } from "../../config/driver";
import { env } from "../../config/env";
import { AssessmentEntryPage } from "../../pages/AssessmentEntryPage";
import { AssessmentStartPage } from "../../pages/AssessmentStartPage";
import { AssessmentVerifyPage } from "../../pages/AssessmentVerifyPage";
import { CreateCampaignModalPage } from "../../pages/CreateCampaignModalPage";
import { CreateWorkflowModalPage } from "../../pages/CreateWorkflowModalPage";
import { WorkflowDetailPage } from "../../pages/WorkflowDetailPage";
import { WorkflowsPage } from "../../pages/WorkflowsPage";
import { getAssessmentInviteLink, getGeneratedQuestions } from "../../utils/campaignLookup";
import { useSharedSession } from "../../utils/sharedSession";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

// Every workflow/campaign this suite creates is a REAL write against the shared
// staging database — nothing here is mocked. The recruiter-led spec also makes a
// real OpenAI question-generation call and sends a real assessment-invite email
// via AWS SES to TEST_CANDIDATE_EMAIL. Nothing in this suite ever deletes data.
const RUN_ID = Date.now();

// Set by the recruiter-led spec once its campaign is actually sent; read by the
// candidate-side describe block below. Both live in this file (rather than
// splitting the candidate spec out) specifically so this dependency stays
// obvious and in-order instead of being an implicit cross-file coupling.
let sentCampaignName: string | undefined;

describe("White-collar flow", function () {
  let driver: WebDriver;

  beforeEach(async function () {
    driver = buildDriver();
    await useSharedSession(driver);
  });

  afterEach(async function () {
    await saveScreenshotOnFailure(driver, this);
    await quitDriverSafely(driver);
  });

  it("creates a recruiter-led workflow, campaign, and sends the assessment", async function () {
    this.timeout(180_000);

    const workflowName = `Software Programming One Fisher - ${RUN_ID}`;
    const campaignName = `${workflowName} Campaign`;
    console.log(`Campaign name for this run: ${campaignName}`);

    // ── Deploy the workflow ──────────────────────────────────────────────
    const workflows = new WorkflowsPage(driver);
    await workflows.open();
    await workflows.openCreateWorkflowModal();

    const createWorkflow = new CreateWorkflowModalPage(driver);
    await createWorkflow.waitForOpen();
    await createWorkflow.enterName(workflowName);
    await createWorkflow.selectCollarType("White Collar");
    await createWorkflow.clickContinue();
    await createWorkflow.selectIntegrationType("Recruiter-led");
    await createWorkflow.clickContinue();
    await createWorkflow.selectVerificationMethod("Knowledge assessment");
    await createWorkflow.clickContinue();
    await createWorkflow.continueUntilDeployVisible();
    await createWorkflow.deploy();
    const workflowId = await createWorkflow.viewDeployedWorkflow();
    expect(workflowId).to.be.a("string").and.not.empty;

    // ── Create a campaign for it: candidate, job posting, generate, send ──
    const workflowDetail = new WorkflowDetailPage(driver);
    expect(await workflowDetail.isNewCampaignButtonPresent()).to.equal(true);
    await workflowDetail.openNewCampaignModal();

    const createCampaign = new CreateCampaignModalPage(driver);
    await createCampaign.waitForOpen();
    await createCampaign.enterCampaignName(campaignName);
    await createCampaign.switchToManualEntry();
    await createCampaign.addCandidate("Test Candidate", env.testCandidateEmail);
    await createCampaign.continueFromCandidates();

    await createCampaign.startNewAssessment();
    await createCampaign.enterJobTitle("Software Programmer");
    await createCampaign.selectExperience("1 - 2 Years");
    await createCampaign.addSkill("JavaScript");
    await createCampaign.continueFromAssessmentDetails();

    await createCampaign.generateAssessment();
    await createCampaign.continueToReview();
    await createCampaign.sendAssessment();
    await createCampaign.skipSavingConfig();
    await createCampaign.waitForSendSuccess();

    sentCampaignName = campaignName;
  });

  it("creates a candidate-led workflow, where candidates verify via API instead of an in-app campaign", async function () {
    this.timeout(60_000);

    const workflowName = `Software Programming One Fisher (Candidate-led) - ${RUN_ID}`;

    const workflows = new WorkflowsPage(driver);
    await workflows.open();
    await workflows.openCreateWorkflowModal();

    const createWorkflow = new CreateWorkflowModalPage(driver);
    await createWorkflow.waitForOpen();
    await createWorkflow.enterName(workflowName);
    await createWorkflow.selectCollarType("White Collar");
    await createWorkflow.clickContinue();
    await createWorkflow.selectIntegrationType("Candidate-led");
    await createWorkflow.clickContinue();
    await createWorkflow.selectVerificationMethod("15 AI MCQ Question");
    await createWorkflow.clickContinue();
    await createWorkflow.continueUntilDeployVisible();
    await createWorkflow.deploy();
    await createWorkflow.viewDeployedWorkflow();

    // Candidate-led means candidates verify on their own via API — there's no
    // "New Campaign" flow for it in this app; Analytics replaces the Campaign tab.
    const workflowDetail = new WorkflowDetailPage(driver);
    expect(await workflowDetail.isNewCampaignButtonPresent()).to.equal(false);
    expect(await workflowDetail.isTabPresent("Campaign")).to.equal(false);
    expect(await workflowDetail.isTabPresent("Analytics")).to.equal(true);
  });
});

// Separate describe: this drives the CANDIDATE side (a different app entirely —
// record-assessment, at env.assessmentBaseUrl) of the campaign the recruiter-led
// spec above just sent. It needs a real webcam + real screen-share grant (no
// fake-device flags — record-assessment's face-api.js proctoring needs an
// actual face) and a live human in front of the camera when it runs, so it's
// opt-in via RUN_CANDIDATE_ASSESSMENT_TEST and always headed regardless of HEADLESS.
(env.runCandidateAssessmentTest ? describe : describe.skip)(
  "White-collar flow — candidate takes the sent assessment",
  function () {
    let driver: WebDriver;

    afterEach(async function () {
      if (driver) await saveScreenshotOnFailure(driver, this);
      await quitDriverSafely(driver);
    });

    it("verifies identity via webcam, completes the proctored exam, and submits", async function () {
      this.timeout(240_000);

      if (!sentCampaignName) {
        throw new Error(
          "No campaign was sent by the recruiter-led spec in this run — it must run first, in the same process.",
        );
      }

      const link = await getAssessmentInviteLink(sentCampaignName, env.testCandidateEmail, env.assessmentBaseUrl);
      const questions = await getGeneratedQuestions(sentCampaignName);

      driver = buildDriverWithRealMedia();

      const entry = new AssessmentEntryPage(driver);
      await entry.open(link);
      await entry.acceptTermsAndContinue();

      const verify = new AssessmentVerifyPage(driver);
      await verify.waitForCameraStream();
      await verify.completeVerification();

      const start = new AssessmentStartPage(driver);
      await start.shareScreen();
      await start.enableCameraAndMic();
      await start.waitForBeginAssessmentEnabled();
      await start.beginAssessment();
      await start.answerAllQuestionsAndSubmit(questions);
      await start.waitForSubmitted();

      expect(await driver.getCurrentUrl()).to.include("/submitted");
    });
  },
);

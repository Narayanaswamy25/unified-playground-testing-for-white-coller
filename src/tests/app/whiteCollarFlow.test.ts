import { expect } from "chai";
import { WebDriver } from "selenium-webdriver";
import { buildDriver, buildDriverWithRealMedia } from "../../config/driver";
import { env } from "../../config/env";
import { AssessmentEntryPage } from "../../pages/AssessmentEntryPage";
import { AssessmentStartPage } from "../../pages/AssessmentStartPage";
import { AssessmentVerifyPage } from "../../pages/AssessmentVerifyPage";
import { CampaignDetailPage } from "../../pages/CampaignDetailPage";
import { CreateCampaignModalPage } from "../../pages/CreateCampaignModalPage";
import { CreateWorkflowModalPage } from "../../pages/CreateWorkflowModalPage";
import { WorkflowDetailPage } from "../../pages/WorkflowDetailPage";
import { WorkflowsPage } from "../../pages/WorkflowsPage";
import {
  GeneratedQuestion,
  getAssessmentInviteLink,
  getGeneratedQuestions,
  waitForCandidatePassed,
} from "../../utils/campaignLookup";
import { ensureWorkflow } from "../../utils/ensureWorkflow";
import { useSharedSession } from "../../utils/sharedSession";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

// Every workflow/campaign this suite creates is a REAL write against the shared
// staging database — nothing here is mocked. The staff spec makes a real
// OpenAI question-generation call and sends real assessment-invite emails via
// AWS SES. Nothing in this suite ever deletes data.
//
// One workflow, one campaign, two candidates: HIRE_CANDIDATE answers every
// question correctly (expect it to complete and show a "Hire" verdict);
// REJECT_CANDIDATE answers every question wrong on purpose (expect "Reject").
// Sharing one campaign between both outcomes — instead of a full separate
// workflow+campaign+generate+send pipeline per outcome — cuts the real backend
// work (AI generation, emails) in half without losing coverage of either path.
const RUN_ID = Date.now();
const HIRE_CANDIDATE_NAME = `Hire Test Candidate - ${RUN_ID}`;
const REJECT_CANDIDATE_NAME = `Reject Test Candidate - ${RUN_ID}`;

// Set by the recruiter-led spec once its campaign is actually sent; read by the
// candidate-side describe block below. Both live in this file so this
// dependency stays obvious and in-order instead of an implicit cross-file coupling.
let sentCampaignName: string | undefined;
let sentWorkflowId: string | undefined;

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

  it("creates a recruiter-led workflow and one campaign carrying both candidates, and sends the assessment", async function () {
    this.timeout(180_000);

    const workflowName = `Software Programming Freshesher - ${RUN_ID}`;
    const campaignName = `${workflowName} Campaign`;
    console.log(`Campaign name for this run: ${campaignName}`);

    // ── Reuse TEST_WORKFLOW_ID if set, otherwise deploy a fresh workflow ───
    // (ensureWorkflow leaves the browser on /workflows/{id} either way).
    sentWorkflowId = await ensureWorkflow(driver, workflowName);

    // ── One campaign, two candidates: HIRE_CANDIDATE_NAME will answer
    //    correctly, REJECT_CANDIDATE_NAME will answer wrong on purpose —
    //    see the candidate-side describe block below. ──
    const workflowDetail = new WorkflowDetailPage(driver);
    expect(await workflowDetail.isNewCampaignButtonPresent()).to.equal(true);
    await workflowDetail.openNewCampaignModal();

    const createCampaign = new CreateCampaignModalPage(driver);
    await createCampaign.waitForOpen();
    await createCampaign.enterCampaignName(campaignName);
    await createCampaign.switchToManualEntry();
    await createCampaign.addCandidate(HIRE_CANDIDATE_NAME, env.testCandidateEmail);
    await createCampaign.addCandidate(REJECT_CANDIDATE_NAME, env.testCandidateEmail2);
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
    await createCampaign.close();

    sentCampaignName = campaignName;
  });

  it("creates a candidate-led workflow, where candidates verify via API instead of an in-app campaign", async function () {
    this.timeout(60_000);

    const workflowName = `Software Programming Freshesher (Candidate-led) - ${RUN_ID}`;

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
// record-assessment, at env.assessmentBaseUrl) of the campaign the staff spec
// above just sent — both candidates in that one campaign. Needs a real webcam +
// real screen-share grant (no fake-device flags — record-assessment's
// face-api.js proctoring needs an actual face) and a live human in front of the
// camera, twice — once per candidate. Opt-in via RUN_CANDIDATE_ASSESSMENT_TEST,
// always headed regardless of HEADLESS.
(env.runCandidateAssessmentTest ? describe : describe.skip)(
  "White-collar flow — candidate takes the sent assessment",
  function () {
    async function takeAssessment(
      candidateEmail: string,
      questions: GeneratedQuestion[],
      answerCorrectly: boolean,
      testContext: Mocha.Context,
    ): Promise<void> {
      if (!sentCampaignName) {
        throw new Error(
          "No campaign was sent by the recruiter-led spec in this run — it must run first, in the same process.",
        );
      }
      const link = await getAssessmentInviteLink(sentCampaignName, candidateEmail, env.assessmentBaseUrl);

      const driver = buildDriverWithRealMedia();
      try {
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
        await start.answerAllQuestionsAndSubmit(questions, { correct: answerCorrectly });
        await start.waitForSubmitted();

        expect(await driver.getCurrentUrl()).to.include("/submitted");
      } catch (err) {
        await saveScreenshotOnFailure(driver, testContext);
        throw err;
      } finally {
        await quitDriverSafely(driver);
      }
    }

    let questions: GeneratedQuestion[];

    before(async function () {
      // Both candidates answer the same generated question set from the one
      // campaign the recruiter-led spec sent — fetch it once instead of once
      // per candidate.
      questions = await getGeneratedQuestions(sentCampaignName!);
    });

    it("hire candidate verifies identity via webcam, answers correctly, and submits", async function () {
      this.timeout(240_000);
      await takeAssessment(env.testCandidateEmail, questions, true, this);
    });

    it("reject candidate verifies identity via webcam, answers incorrectly on purpose, and submits", async function () {
      this.timeout(240_000);
      await takeAssessment(env.testCandidateEmail2, questions, false, this);
    });

    it("shows Hire/Reject verdicts on the campaign page matching each candidate's real outcome", async function () {
      this.timeout(60_000);
      if (!sentCampaignName || !sentWorkflowId) {
        throw new Error("No campaign was sent by the recruiter-led spec in this run.");
      }

      expect(await waitForCandidatePassed(sentCampaignName, env.testCandidateEmail)).to.equal(true);
      expect(await waitForCandidatePassed(sentCampaignName, env.testCandidateEmail2)).to.equal(false);

      const staffDriver = buildDriver();
      await useSharedSession(staffDriver);
      try {
        // Navigate the same way a recruiter would: into the workflow, its
        // Campaign tab, then the specific campaign card — rather than jumping
        // straight to /campaigns/{id} — so this also confirms the verdicts
        // surface correctly starting from the workflow page.
        const workflowDetail = new WorkflowDetailPage(staffDriver);
        await workflowDetail.open(sentWorkflowId);
        await workflowDetail.openCampaignsTab();
        await workflowDetail.openCampaign(sentCampaignName);

        const campaignDetail = new CampaignDetailPage(staffDriver);
        expect(await campaignDetail.getVerdict(HIRE_CANDIDATE_NAME)).to.equal("Hire");
        expect(await campaignDetail.getVerdict(REJECT_CANDIDATE_NAME)).to.equal("Reject");
      } finally {
        await quitDriverSafely(staffDriver);
      }
    });
  },
);

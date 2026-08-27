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
  getAssessmentInviteLink,
  getCampaignId,
  getGeneratedQuestions,
  waitForCandidatePassed,
} from "../../utils/campaignLookup";
import { useSharedSession } from "../../utils/sharedSession";
import { quitDriverSafely, saveScreenshotOnFailure } from "../../utils/testLifecycle";

// "Hire"/"Reject" is not a staff action anywhere in this app — it's a read-only
// badge the campaign page computes from candidatesessions.passed once the
// candidate submits (getCandidateVerdict in campaigns/[campaignId]/page.tsx).
// These specs prove that badge actually reflects a real pass/fail outcome, by
// driving the full pipeline twice: once where the candidate answers correctly
// (expect a "Hire" badge) and once where they deliberately answer wrong
// (expect "Reject"). Real writes against the shared staging DB, same as the
// rest of this suite — nothing here is mocked, nothing gets deleted.
//
// Uses TEST_CANDIDATE_EMAIL_2 rather than TEST_CANDIDATE_EMAIL so these don't
// collide with whiteCollarFlow.test.ts's candidate-assessment spec, which binds
// a single-use session to TEST_CANDIDATE_EMAIL.
const RUN_ID = Date.now();

async function createAndSendRecruiterLedCampaign(
  driver: WebDriver,
  label: string,
  candidateName: string,
  candidateEmail: string,
): Promise<{ workflowId: string; campaignName: string }> {
  const workflowName = `${label} - ${RUN_ID}`;
  const campaignName = `${workflowName} Campaign`;

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

  const workflowDetail = new WorkflowDetailPage(driver);
  await workflowDetail.openNewCampaignModal();

  const createCampaign = new CreateCampaignModalPage(driver);
  await createCampaign.waitForOpen();
  await createCampaign.enterCampaignName(campaignName);
  await createCampaign.switchToManualEntry();
  await createCampaign.addCandidate(candidateName, candidateEmail);
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

  return { workflowId, campaignName };
}

// Needs a real webcam + screen-share grant and a live human in front of the
// camera for the exam-answering run, same as whiteCollarFlow.test.ts's
// candidate-assessment spec — opt-in only, always headed regardless of HEADLESS.
(env.runCandidateAssessmentTest ? describe : describe.skip)("White-collar flow — Hire/Reject verdict", function () {
  async function runVerdictScenario(
    this: Mocha.Context,
    label: string,
    candidateName: string,
    answerCorrectly: boolean,
    expectedVerdict: "Hire" | "Reject",
  ): Promise<void> {
    this.timeout(240_000);

    let staffDriver = buildDriver();
    await useSharedSession(staffDriver);
    const { campaignName } = await createAndSendRecruiterLedCampaign(
      staffDriver,
      label,
      candidateName,
      env.testCandidateEmail2,
    );
    await quitDriverSafely(staffDriver);

    const link = await getAssessmentInviteLink(campaignName, env.testCandidateEmail2, env.assessmentBaseUrl);
    const questions = await getGeneratedQuestions(campaignName);

    const candidateDriver = buildDriverWithRealMedia();
    try {
      const entry = new AssessmentEntryPage(candidateDriver);
      await entry.open(link);
      await entry.acceptTermsAndContinue();

      const verify = new AssessmentVerifyPage(candidateDriver);
      await verify.waitForCameraStream();
      await verify.completeVerification();

      const start = new AssessmentStartPage(candidateDriver);
      await start.shareScreen();
      await start.enableCameraAndMic();
      await start.waitForBeginAssessmentEnabled();
      await start.beginAssessment();
      await start.answerAllQuestionsAndSubmit(questions, { correct: answerCorrectly });
      await start.waitForSubmitted();
    } catch (err) {
      await saveScreenshotOnFailure(candidateDriver, this);
      throw err;
    } finally {
      await quitDriverSafely(candidateDriver);
    }

    const passed = await waitForCandidatePassed(campaignName, env.testCandidateEmail2);
    expect(passed).to.equal(expectedVerdict === "Hire");

    // Confirm the UI's auto-computed verdict badge agrees with the DB.
    staffDriver = buildDriver();
    await useSharedSession(staffDriver);
    try {
      const campaignId = await getCampaignId(campaignName);
      const campaignDetail = new CampaignDetailPage(staffDriver);
      await campaignDetail.open(campaignId);
      expect(await campaignDetail.getVerdict(candidateName)).to.equal(expectedVerdict);
    } finally {
      await quitDriverSafely(staffDriver);
    }
  }

  it("shows a Hire verdict when the candidate answers everything correctly", async function () {
    await runVerdictScenario.call(
      this,
      "Software Programming One Fisher (Hire)",
      `Hire Test Candidate - ${RUN_ID}`,
      true,
      "Hire",
    );
  });

  it("shows a Reject verdict when the candidate answers everything incorrectly", async function () {
    await runVerdictScenario.call(
      this,
      "Software Programming One Fisher (Reject)",
      `Reject Test Candidate - ${RUN_ID}`,
      false,
      "Reject",
    );
  });
});

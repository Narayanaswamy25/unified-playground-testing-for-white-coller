import { WebDriver } from "selenium-webdriver";
import { env } from "../config/env";
import { CreateWorkflowModalPage } from "../pages/CreateWorkflowModalPage";
import { WorkflowDetailPage } from "../pages/WorkflowDetailPage";
import { WorkflowsPage } from "../pages/WorkflowsPage";

/**
 * Reuses the recruiter-led white-collar workflow at TEST_WORKFLOW_ID if set —
 * recreating a whole workflow (name, collar type, integration type,
 * verification method, assessment config) just to hang a new campaign off it
 * is unnecessary ceremony once one already exists. Otherwise deploys a fresh
 * one and prints its id so it can be pasted into .env as TEST_WORKFLOW_ID for
 * every run after this one.
 */
export async function ensureWorkflow(driver: WebDriver, workflowName: string): Promise<string> {
  if (env.testWorkflowId) {
    const workflowDetail = new WorkflowDetailPage(driver);
    await workflowDetail.open(env.testWorkflowId);
    if (!(await workflowDetail.isNewCampaignButtonPresent())) {
      throw new Error(
        `TEST_WORKFLOW_ID=${env.testWorkflowId} did not load a recruiter-led workflow with a "New Campaign" ` +
          "button — confirm the id is correct, still exists, and is recruiter-led (not candidate-led).",
      );
    }
    return env.testWorkflowId;
  }

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

  console.log(
    `\nCreated workflow "${workflowName}" (${workflowId}).\n` +
      "To reuse it on every future run instead of creating a new one each time, add this to .env:\n" +
      `  TEST_WORKFLOW_ID=${workflowId}\n`,
  );

  return workflowId;
}

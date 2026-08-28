import * as dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  baseUrl: required("BASE_URL", "http://localhost:3000"),
  apiBaseUrl: required("API_BASE_URL", "http://localhost:8080/api/v1"),
  browser: required("BROWSER", "chrome"),
  headless: (process.env.HEADLESS ?? "true") !== "false",
  testUserEmail: required("TEST_USER_EMAIL"),
  testUserPassword: required("TEST_USER_PASSWORD"),
  testCandidateEmail: required("TEST_CANDIDATE_EMAIL"),
  /** Second candidate inbox — the Hire/Reject verdict specs use this instead, so
   *  they don't collide with the main candidate spec's single-use session for
   *  TEST_CANDIDATE_EMAIL on the same campaign. */
  testCandidateEmail2: required("TEST_CANDIDATE_EMAIL_2"),
  defaultTimeout: Number(process.env.DEFAULT_TIMEOUT ?? 10000),
  mongoUri: required("MONGO_URI", "mongodb://127.0.0.1:27017/record-studio-test"),
  /** Same secret the backend signs access tokens with — used only to verify a cached
   *  token's expiry locally before reusing it. See src/utils/sharedSession.ts. */
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  /** The candidate-facing app that assessment-invite links point at. */
  assessmentBaseUrl: required("ASSESSMENT_BASE_URL", "https://skills-verification.vercel.app"),
  /** Candidate-taking-the-assessment spec needs a real webcam + screen-share
   *  grant and a live human face in front of the camera — opt-in only, so a
   *  plain `npm test` run never hangs waiting for either. */
  runCandidateAssessmentTest: (process.env.RUN_CANDIDATE_ASSESSMENT_TEST ?? "false") === "true",
  /** Account the delete-account spec logs into and leaves the org for — real
   *  and destructive (deletes the whole org if this account is its sole owner).
   *  Never run as part of `npm test`; only via `npm run test:delete`. */
  testUserEmailDelete: required("TEST_USER_EMAIL_DELET"),
  testUserPasswordDelete: required("TEST_USER_PASSWORD_DELET"),
  /** Opt-in — leaving/deleting an org is destructive and irreversible, so this never runs as part of a plain `npm test`. */
  runDeleteAccountTest: (process.env.RUN_DELETE_ACCOUNT_TEST ?? "false") === "true",
  /** Optional — an existing recruiter-led white-collar workflow's id. When set,
   *  the white-collar specs reuse it (skipping the whole create-workflow wizard)
   *  instead of deploying a brand-new workflow on every single run. See
   *  src/utils/ensureWorkflow.ts. Left unset, a fresh one is created and its id
   *  is printed so it can be pasted in here for future runs. */
  testWorkflowId: process.env.TEST_WORKFLOW_ID?.trim() || undefined,
};

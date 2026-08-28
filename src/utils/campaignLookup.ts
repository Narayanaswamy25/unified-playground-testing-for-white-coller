import { Db, MongoClient } from "mongodb";
import { env } from "../config/env";
import { asReadOnly } from "./db";

export type GeneratedQuestion = {
  text: string;
  type: "mcq" | "true-false" | "short-answer" | "long-answer" | "coding";
  options: string[];
  correctAnswer: string;
  order: number;
};

/** Every lookup below is a one-shot read against the live Mongo cluster — connect, run, close. */
async function withMongoDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(env.mongoUri);
  try {
    await client.connect();
    return await fn(client.db());
  } finally {
    await client.close();
  }
}

/** The most recent live campaign with this name — every lookup below keys off it. */
async function findLiveCampaign(db: Db, campaignName: string, notFoundHint = "") {
  const campaigns = asReadOnly(db.collection("unified_campaigns"));
  const campaign = await campaigns.findOne({ name: campaignName, mode: "live" }, { sort: { createdAt: -1 } });
  if (!campaign) {
    throw new Error(`No campaign found named "${campaignName}".${notFoundHint}`);
  }
  return campaign;
}

/**
 * The white-collar send flow (campaign.service.ts's sendCampaignService) builds
 * each candidate's invite link on the fly and never persists it — only
 * candidates.$.status flips to "sent". So instead of reading a stored link, this
 * reconstructs it the same way the backend does: campaignId + orgId + the
 * candidate's candidateId come from `unified_campaigns`, and the org's live VFN
 * API key (the `keyId` query param) comes from `unified_api_keys`.
 */
export async function getAssessmentInviteLink(
  campaignName: string,
  candidateEmail: string,
  assessmentBaseUrl: string,
): Promise<string> {
  return withMongoDb(async (db) => {
    const campaign = await findLiveCampaign(db, campaignName, " Confirm it was created and sent before this lookup.");

    const candidate = (campaign.candidates as { email?: string; candidateId?: string }[]).find(
      (c) => c.email?.toLowerCase() === candidateEmail.toLowerCase(),
    );
    if (!candidate?.candidateId) {
      throw new Error(`Campaign "${campaignName}" has no candidate with email ${candidateEmail}.`);
    }

    const apiKeys = asReadOnly(db.collection("unified_api_keys"));
    const apiKey = await apiKeys.findOne({
      orgId: campaign.orgId,
      mode: "live",
      isActive: true,
    });
    if (!apiKey) {
      throw new Error(`No active live API key found for org ${campaign.orgId}.`);
    }

    const url = new URL(`${assessmentBaseUrl}/assessment/${campaign.campaignId}`);
    url.searchParams.set("keyId", apiKey.apiKey as string);
    url.searchParams.set("candidateId", candidate.candidateId);
    return url.toString();
  });
}

/**
 * The AI-generated questions (with their correct answers) that were saved onto
 * the campaign at "Generate Assessment" time — the same document
 * record-assessment-backend reads from when it serves the exam session, so
 * these line up with what actually renders on /start, in the same order.
 */
export async function getGeneratedQuestions(campaignName: string): Promise<GeneratedQuestion[]> {
  return withMongoDb(async (db) => {
    const campaign = await findLiveCampaign(db, campaignName);

    const questions = (campaign.questions ?? []) as GeneratedQuestion[];
    if (questions.length === 0) {
      throw new Error(`Campaign "${campaignName}" has no generated questions yet.`);
    }

    return [...questions].sort((a, b) => a.order - b.order);
  });
}

/** The campaignId for a given campaign name — needed to navigate to /campaigns/{campaignId} in the UI. */
export async function getCampaignId(campaignName: string): Promise<string> {
  return withMongoDb(async (db) => {
    const campaign = await findLiveCampaign(db, campaignName);
    return campaign.campaignId as string;
  });
}

/**
 * Grading happens synchronously inside record-assessment-backend's
 * handleSubmitSession (session.passed is set in the same request that handles
 * the candidate's Submit click), so this only needs a short poll to cover Mongo
 * write/read propagation, not a wait for a slow async grading job. `passed`
 * true/false is exactly what the campaign page's Hire/Reject verdict badge is
 * computed from (getCandidateVerdict in campaigns/[campaignId]/page.tsx).
 */
export async function waitForCandidatePassed(
  campaignName: string,
  candidateEmail: string,
  timeoutMs = 60_000,
): Promise<boolean> {
  return withMongoDb(async (db) => {
    const campaign = await findLiveCampaign(db, campaignName);

    const sessions = asReadOnly(db.collection("candidatesessions"));
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const session = await sessions.findOne({
        campaignId: campaign.campaignId,
        "candidate.email": candidateEmail.toLowerCase(),
      });
      if (session && typeof session.passed === "boolean") {
        return session.passed as boolean;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error(
      `candidatesessions.passed was never set for ${candidateEmail} on campaign "${campaignName}" — did the candidate actually submit?`,
    );
  });
}

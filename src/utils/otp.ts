import { MongoClient } from "mongodb";
import { env } from "../config/env";
import { asReadOnly } from "./db";

export type OtpPurpose = "email_verification" | "two_factor_login" | "password_reset";

/**
 * Reads the latest unused, unexpired OTP the backend wrote for this email/purpose
 * directly from MongoDB. There is no API backdoor for this in the backend
 * (email verification codes go out via email, 2FA codes via SMS), so tests read
 * the same `unified_playground_users_otps` collection the backend writes to.
 *
 * MONGO_URI must point at the backend's test database, never production.
 */
export async function getLatestOtp(email: string, purpose: OtpPurpose): Promise<string> {
  const client = new MongoClient(env.mongoUri);
  try {
    await client.connect();
    const db = client.db();
    const otps = asReadOnly(db.collection("unified_playground_users_otps"));
    const record = await otps.findOne(
      {
        email: email.trim().toLowerCase(),
        purpose,
        isUsed: false,
        expiresAt: { $gt: new Date() },
      },
      { sort: { createdAt: -1 } },
    );

    if (!record) {
      throw new Error(
        `No unused, unexpired OTP found for ${email} (purpose=${purpose}). ` +
          "Confirm MONGO_URI points at the backend's active database and that the " +
          "triggering request (signup/login) actually ran before this lookup.",
      );
    }

    return record.otp as string;
  } finally {
    await client.close();
  }
}

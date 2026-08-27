import { Collection, Document } from "mongodb";

/**
 * Mongo driver methods that mutate data. Blocked unconditionally on any collection
 * handed out by this test suite — the suite's job is to observe app state (e.g. read
 * an OTP the backend wrote), never to change it.
 */
const BLOCKED_METHODS = [
  "insertOne",
  "insertMany",
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "bulkWrite",
  "drop",
  "dropIndexes",
  "createIndex",
  "createIndexes",
  "rename",
] as const;

export class ReadOnlyViolationError extends Error {
  constructor(method: string) {
    super(
      `Blocked "${method}" — this test suite has read-only DB access. ` +
        "Reads (findOne/find/aggregate/countDocuments/...) are allowed; writes are not.",
    );
    this.name = "ReadOnlyViolationError";
  }
}

/**
 * Wraps a MongoDB collection so any write method throws instead of executing.
 * This is enforced in code, independent of whatever permissions the MONGO_URI
 * credentials actually have — a defense-in-depth on top of using a read-only
 * DB user, not a replacement for it.
 */
export function asReadOnly<T extends Document>(collection: Collection<T>): Collection<T> {
  return new Proxy(collection, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && (BLOCKED_METHODS as readonly string[]).includes(prop)) {
        return () => {
          throw new ReadOnlyViolationError(prop);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

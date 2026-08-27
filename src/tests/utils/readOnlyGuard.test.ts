import { expect } from "chai";
import { Collection, Document } from "mongodb";
import { asReadOnly, ReadOnlyViolationError } from "../../utils/db";

/**
 * Proves that asReadOnly() — the only path src/utils/otp.ts uses to touch MongoDB —
 * lets reads through untouched and blocks every write method before it ever reaches
 * the real driver call. No live database is needed: the "collection" here is a mock
 * that records whether it was actually invoked, which is exactly what would fire a
 * real mutation against MongoDB if the guard were not in place.
 */
describe("asReadOnly DB guard", function () {
  function mockCollectionCallCount(): { calls: Record<string, number>; collection: Collection<Document> } {
    const calls: Record<string, number> = {};
    const record = (name: string, returnValue: unknown) => {
      calls[name] = 0;
      return (..._args: unknown[]) => {
        calls[name] += 1;
        return returnValue;
      };
    };

    const mock = {
      findOne: record("findOne", { otp: "123456" }),
      find: record("find", []),
      countDocuments: record("countDocuments", 0),
      insertOne: record("insertOne", { insertedId: "x" }),
      insertMany: record("insertMany", {}),
      updateOne: record("updateOne", {}),
      updateMany: record("updateMany", {}),
      deleteOne: record("deleteOne", {}),
      deleteMany: record("deleteMany", {}),
      findOneAndUpdate: record("findOneAndUpdate", {}),
      findOneAndDelete: record("findOneAndDelete", {}),
    };

    return { calls, collection: mock as unknown as Collection<Document> };
  }

  it("passes reads straight through to the real driver call", async function () {
    const { calls, collection } = mockCollectionCallCount();
    const guarded = asReadOnly(collection);

    const result = await guarded.findOne({ email: "a@b.com" });

    expect(result).to.deep.equal({ otp: "123456" });
    expect(calls.findOne).to.equal(1); // the real findOne DID execute
  });

  const writeMethods = [
    "insertOne",
    "insertMany",
    "updateOne",
    "updateMany",
    "deleteOne",
    "deleteMany",
    "findOneAndUpdate",
    "findOneAndDelete",
  ] as const;

  for (const method of writeMethods) {
    it(`blocks "${method}" before it reaches the driver`, function () {
      const { calls, collection } = mockCollectionCallCount();
      const guarded = asReadOnly(collection);

      expect(() => (guarded as unknown as Record<string, (...a: unknown[]) => unknown>)[method]()).to.throw(
        ReadOnlyViolationError,
      );
      expect(calls[method]).to.equal(0); // the real write method NEVER executed
    });
  }
});

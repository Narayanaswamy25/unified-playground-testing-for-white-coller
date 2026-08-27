import { env } from "./env";

// Mocha's documented root-hook-plugin shape — required files run before the
// BDD interface's globals (describe/before/...) exist, so calling before()
// directly at module scope here throws "before is not defined".
export const mochaHooks = {
  beforeAll(this: Mocha.Context) {
    console.log(`Running against ${env.baseUrl} (browser=${env.browser}, headless=${env.headless})`);
  },
};

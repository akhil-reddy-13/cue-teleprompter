import { assertServerUp } from "./harness.mjs";
import recording from "./recording.mjs";
import experience from "./experience.mjs";

/**
 * Drives the real app in real Chrome against a synthetic camera, so the
 * recording pipeline is exercised end to end rather than mocked.
 *
 *   npm run dev            # in one shell
 *   npm run test:e2e       # in another
 */
await assertServerUp();

const only = process.argv[2];
const suites = [
  { name: "recording", run: recording },
  { name: "experience", run: experience },
].filter((suite) => !only || suite.name === only);

if (suites.length === 0) {
  console.error(`Unknown suite "${only}". Try: recording, experience.`);
  process.exit(1);
}

const failures = [];
for (const suite of suites) {
  failures.push(...(await suite.run()).map((name) => `${suite.name}: ${name}`));
}

if (failures.length > 0) {
  console.log(`\n${failures.length} failed:`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("\nAll checks passed.");

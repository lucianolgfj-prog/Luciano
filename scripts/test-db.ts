import "dotenv/config";
import { spawnSync } from "node:child_process";
const url = process.env.TEST_DATABASE_URL;
if (!url || new URL(url).pathname !== "/jda_test")
  throw new Error(
    "Defina TEST_DATABASE_URL para um banco separado chamado jda_test.",
  );
const env = { ...process.env, DATABASE_URL: url };
for (const args of [
  ["scripts/migrate.ts"],
  [
    "--test",
    "tests/integration/workflow.test.ts",
    "tests/integration/connectors.test.ts",
  ],
]) {
  const result = spawnSync(process.execPath, ["--import", "tsx", ...args], {
    env,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    break;
  }
}

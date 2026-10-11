import "dotenv/config";
import { synchronize, type Target } from "../lib/sync";
import { db } from "../lib/db";
const targets = ["outlook", "onedrive", "notion", "outbox"] as const;
async function main() {
  const selected = process.argv[2];
  if (selected && !targets.includes(selected as Target))
    throw new Error("Use outlook, onedrive, notion ou outbox.");
  for (const target of selected ? [selected as Target] : targets) {
    const result = await synchronize(target);
    console.log(`${target}: ${result.message}`);
    if (!result.ok) process.exitCode = 1;
  }
}
main()
  .catch(() => {
    console.error("Worker falhou; consulte o estado das integrações.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

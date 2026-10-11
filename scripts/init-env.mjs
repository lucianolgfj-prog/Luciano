import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env existente preservada.");
} else {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(
    ".env",
    template.replace(
      "replace-with-a-random-32-byte-secret",
      randomBytes(48).toString("base64url"),
    ) + "\nPOSTGRES_PASSWORD=jda_local_only\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log(".env local de demonstração criada. Nenhum segredo foi exibido.");
}

import "dotenv/config";
import { Client } from "pg";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
// Migrações SQL versionadas, atômicas e verificadas por checksum. Não depende de binários Rust.
async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(721647)");
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_jda_migrations" (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
    );
    const root = resolve("prisma/migrations");
    const folders = (await readdir(root, { withFileTypes: true }))
      .filter((f) => f.isDirectory())
      .map((f) => f.name)
      .sort();
    for (const name of folders) {
      const sql = await readFile(resolve(root, name, "migration.sql"), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const applied = await client.query(
        'SELECT checksum FROM "_jda_migrations" WHERE name=$1',
        [name],
      );
      if (applied.rowCount) {
        if (applied.rows[0].checksum !== checksum)
          throw new Error(`Migração já aplicada foi modificada: ${name}`);
        console.log(`${name}: já aplicada`);
        continue;
      }
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "_jda_migrations"(name,checksum) VALUES($1,$2)',
          [name, checksum],
        );
        await client.query("COMMIT");
        console.log(`${name}: aplicada`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(721647)").catch(() => {});
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Migração falhou. Verifique acesso ao banco, schema e integridade dos arquivos. Nenhuma migração parcial foi mantida.",
  );
  process.exitCode = 1;
});

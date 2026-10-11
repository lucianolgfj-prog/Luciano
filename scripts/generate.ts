import "dotenv/config";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { getGenerators } from "@prisma/internals";
const require = createRequire(import.meta.url);
async function main() {
  const generators = await getGenerators({
    schemaPath: resolve("prisma/schema.prisma"),
    registry: {
      "prisma-client-js": {
        type: "rpc",
        generatorPath:
          require.resolve("@prisma/client/generator-build/index.js"),
        isNode: true,
      },
    },
  });
  try {
    for (const generator of generators) await generator.generate();
    console.log(
      "Cliente Prisma JavaScript gerado; execução via driver PostgreSQL.",
    );
  } finally {
    for (const generator of generators) generator.stop();
  }
}
main().catch(() => {
  console.error(
    "Geração do cliente falhou. Verifique o schema e as versões fixadas do Prisma.",
  );
  process.exitCode = 1;
});

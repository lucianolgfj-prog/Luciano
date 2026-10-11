import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractPublications,
  matchesLawyer,
  classify,
} from "../lib/publications";
import { recurringAt, conversion } from "../lib/metrics";
import {
  canUpdateTask,
  permissions,
  externalWritesAllowed,
} from "../lib/policy";
import { safeLink } from "../lib/format";
const header = "Luciano Gonçalves Faria Júnior — OAB/GO 64.721";
const one =
  "PROAD 202610000000001 Processo 0000001-00.2026.8.09.0000 TJGO Publicação: 13/10/2026 Despacho para conferir documentos.";
test("filtro exige nome, inscrição e estado", () => {
  assert.equal(matchesLawyer(header), true);
  assert.equal(matchesLawyer("Outro advogado OAB/GO 64.721"), false);
  assert.equal(
    matchesLawyer("Luciano Gonçalves Faria Júnior OAB/SP 64.721"),
    false,
  );
});
test("IDs PROAD distintos no mesmo processo são preservados", () => {
  const p = extractPublications(
    `${header}\n${one}\n${one.replace("202610000000001", "202610000000002")}`,
    "email",
  );
  assert.equal(p.length, 2);
  assert.notEqual(p[0].fingerprint, p[1].fingerprint);
  assert.equal(p[0].caseNumber, "0000001-00.2026.8.09.0000");
  assert.equal(p[0].court, "TJGO");
  assert.equal(p[0].publishedAt?.toISOString(), "2026-10-13T15:00:00.000Z");
});
test("mesmo PROAD não duplica por HTML ou reenvio", () => {
  const a = extractPublications(`${header}\n${one}`, "email1");
  const b = extractPublications(`<p>${header}</p><p>${one}</p>`, "email2");
  assert.equal(a[0].fingerprint, b[0].fingerprint);
});
test("sem identificador, hash não depende do ID de e-mail", () => {
  const a = extractPublications(
    `${header} Despacho para conferir documentos.`,
    "email1",
  );
  const b = extractPublications(
    `${header} Despacho para conferir documentos.`,
    "email2",
  );
  assert.equal(a[0].fingerprint, b[0].fingerprint);
});
test("campos ausentes e data inválida ficam sem inferência", () => {
  const p = extractPublications(
    `${header}\nPROAD 202610000000001 Publicação: 31/02/2026 Texto sem tribunal e número.`,
    "email",
  );
  assert.equal(p[0].caseNumber, null);
  assert.equal(p[0].publishedAt, null);
  assert.equal(p[0].court, null);
  assert.match(p[0].suggestion, /Não há cálculo de prazo/);
});
test("classificação é preliminar e não presume prazo", () => {
  assert.match(classify("Sentença de procedência").nature, /Possível sentença/);
  assert.match(classify("Precatório").suggestion, /Não há cálculo de prazo/);
});
test("MRR respeita início e fim de vigência", () => {
  const services = [
    {
      monthlyFee: 1000,
      startsAt: new Date("2026-01-01"),
      endsAt: new Date("2026-03-01"),
      active: true,
    },
    {
      monthlyFee: 500,
      startsAt: new Date("2026-02-01"),
      endsAt: null,
      active: true,
    },
  ];
  assert.equal(recurringAt(services, new Date("2026-01-15")), 1000);
  assert.equal(recurringAt(services, new Date("2026-02-15")), 1500);
  assert.equal(recurringAt(services, new Date("2026-03-01")), 500);
});
test("conversão só considera encerradas e base vazia dá zero", () => {
  assert.equal(conversion(["WON", "LOST", "LEAD", "PROPOSAL"]), 50);
  assert.equal(conversion([]), 0);
});
test("permissões bloqueiam aprovação comercial e tarefas alheias", () => {
  assert.equal(permissions.approve("COMMERCIAL"), false);
  assert.equal(permissions.approve("LEGAL"), false);
  assert.equal(permissions.approve("ADMIN"), true);
  assert.equal(
    canUpdateTask(
      { id: "rafael", role: "COMMERCIAL" },
      { assigneeId: "gustavo" },
    ),
    false,
  );
  assert.equal(
    canUpdateTask({ id: "gustavo", role: "LEGAL" }, { assigneeId: "gustavo" }),
    true,
  );
});
test("links rejeitam javascript, HTTP e domínios externos", () => {
  assert.equal(safeLink("javascript:alert(1)"), null);
  assert.equal(safeLink("https://evil.test"), null);
  assert.ok(safeLink("https://office.sharepoint.com/doc"));
  assert.equal(safeLink("https://office.sharepoint.com.evil.test"), null);
});
test("escrita externa é impossível em demo mesmo com flag", () => {
  const a = process.env.APP_MODE,
    b = process.env.ALLOW_EXTERNAL_WRITES;
  process.env.APP_MODE = "demo";
  process.env.ALLOW_EXTERNAL_WRITES = "true";
  assert.equal(externalWritesAllowed(), false);
  process.env.APP_MODE = a;
  process.env.ALLOW_EXTERNAL_WRITES = b;
});

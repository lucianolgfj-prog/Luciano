import { createHash } from "node:crypto";
import { convert } from "html-to-text";
export function normalize(text: string) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function matchesLawyer(text: string) {
  const n = normalize(text);
  return (
    n.includes("luciano goncalves faria junior") &&
    /(?:64[.\s]?721)/.test(n) &&
    /\bgo\b|goias/.test(n)
  );
}
export function classify(text: string) {
  const n = normalize(text);
  const nature = /sentenca/.test(n)
    ? "Possível sentença"
    : /acordao/.test(n)
      ? "Possível acórdão"
      : /decisao/.test(n)
        ? "Possível decisão interlocutória"
        : /despacho/.test(n)
          ? "Possível despacho"
          : "Natureza não identificada";
  const action = /precatorio/.test(n)
    ? "Conferir inscrição e andamento do precatório."
    : /document/.test(n)
      ? "Conferir os documentos mencionados e avaliar a providência cabível."
      : "Ler o inteiro teor e avaliar a providência cabível com o responsável jurídico.";
  return {
    nature: `${nature} — triagem preliminar`,
    suggestion: `${action} Confirmar número, tribunal, data e conteúdo na fonte oficial. Não há cálculo de prazo nem conclusão jurídica automática.`,
  };
}
export function extractPublications(html: string, sourceId: string) {
  const plain = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { ignoreHref: true } },
      { selector: "img", format: "skip" },
    ],
  });
  if (!matchesLawyer(plain)) return [];
  const ids = [...plain.matchAll(/PROAD\s*[:#-]?\s*(\d{10,20})/gi)];
  const parts = ids.length
    ? ids.map((m, i) => ({
        id: `PROAD:${m[1]}`,
        content: plain.slice(m.index!, ids[i + 1]?.index ?? plain.length),
        context: plain.slice(0, m.index),
      }))
    : [{ id: sourceId, content: plain, context: "" }];
  return parts.map((part) => {
    const caseNumber =
      part.content.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] ??
      (ids.length === 1
        ? plain.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0]
        : undefined) ??
      null;
    const court =
      part.content
        .match(/\b(?:TJ[A-Z]{2}|TRF[1-6]|TRT[- ]?\d{1,2}|STJ|STF|TST)\b/i)?.[0]
        ?.toUpperCase() ?? null;
    const stamp = part.content.match(
      /(?:publica[çc][ãa]o|publicado em|data de publica[çc][ãa]o)\s*[:\-]?\s*(\d{2})\/(\d{2})\/(\d{4})/i,
    );
    let publishedAt: Date | null = null;
    if (stamp) {
      const candidate = new Date(
        `${stamp[3]}-${stamp[2]}-${stamp[1]}T12:00:00-03:00`,
      );
      if (
        !Number.isNaN(candidate.getTime()) &&
        candidate.getUTCDate() === Number(stamp[1]) &&
        candidate.getUTCMonth() + 1 === Number(stamp[2])
      )
        publishedAt = candidate;
    }
    // Fonte + ID PROAD é estável mesmo se a mensagem recebida mudar de formatação.
    const key = part.id.startsWith("PROAD:")
      ? `${part.id}`
      : `${normalize(part.content)}|${caseNumber ?? ""}|${publishedAt?.toISOString() ?? ""}`;
    return {
      fingerprint: createHash("sha256").update(key).digest("hex"),
      sourceId: part.id,
      caseNumber,
      court,
      publishedAt,
      content: part.content.slice(0, 40000),
      ...classify(part.content),
    };
  });
}

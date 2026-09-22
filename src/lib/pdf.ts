import {
  GROUPS,
  TOTAL_TIER1,
  TOTAL_TIER2,
  missingRequired,
  scoreAnswers,
  type Answers,
} from "./checklist";
import { parisDate, parisHuman } from "./paris";
import { slugify } from "./slug";
import { markFor, missingSuffix, parseMembers, type SubmissionFields } from "./summary";

const MARGIN = 18;
const PAGE_W = 210;
const PAGE_H = 297;
const TEXT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN;

const INK: [number, number, number] = [20, 33, 61];
const INK_2: [number, number, number] = [74, 84, 112];
const GREEN: [number, number, number] = [31, 136, 61];
const RED: [number, number, number] = [198, 40, 40];
const AMBER: [number, number, number] = [180, 83, 9];

function colorFor(answer: string | undefined): [number, number, number] {
  if (answer === "yes") return GREEN;
  if (answer === "no") return RED;
  if (answer === "idk") return AMBER;
  return INK_2;
}

export type BuiltPdf = {
  blob: Blob;
  /** The same bytes, ready to ride along in the POST body. */
  base64: string;
  filename: string;
};

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** Builds the student's copy of the audit. jsPDF draws onto a blank page — the
 *  page CSS plays no part here — so the layout below is the whole design. */
export async function buildPdf(
  fields: SubmissionFields,
  answers: Answers,
  now: Date,
): Promise<BuiltPdf> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { tier1, tier2, idk, palier1Valid } = scoreAnswers(answers);

  let y = MARGIN;

  const breakIfNeeded = (needed: number) => {
    if (y + needed <= BOTTOM - 8) return;
    doc.addPage();
    y = MARGIN;
  };

  const write = (
    text: string,
    opts: { size?: number; style?: "normal" | "bold"; color?: [number, number, number]; indent?: number; gap?: number } = {},
  ) => {
    const { size = 10, style = "normal", color = INK, indent = 0, gap = 1.2 } = opts;
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, TEXT_W - indent) as string[];
    const lineHeight = size * 0.42;
    breakIfNeeded(lines.length * lineHeight);
    doc.text(lines, MARGIN + indent, y);
    y += lines.length * lineHeight + gap;
  };

  // --- En-tête ---
  write("Audit open source — EIP", { size: 19, style: "bold", gap: 1.5 });
  write(parisHuman(now), { size: 9.5, color: INK_2, gap: 4 });

  write(`Équipe : ${fields.team || "—"}`, { size: 11, style: "bold", gap: 1 });
  write(`Repo : ${fields.repo || "—"}`, { size: 9.5, color: INK_2, gap: 1 });
  const members = parseMembers(fields.members);
  write(`Membres : ${members.join(", ") || "—"}`, { size: 9.5, color: INK_2, gap: 5 });

  // --- Scores ---
  doc.setDrawColor(223, 227, 236);
  doc.setFillColor(243, 245, 249);
  breakIfNeeded(20);
  doc.roundedRect(MARGIN, y - 4, TEXT_W, 19, 2, 2, "FD");
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...INK_2);
  doc.text("PALIER 1 — MINIMUM OPEN SOURCE", MARGIN + 5, y + 1.5);
  doc.text("PALIER 2 — BONNES PRATIQUES", MARGIN + TEXT_W / 2 + 5, y + 1.5);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(palier1Valid ? GREEN : RED));
  doc.text(`${tier1} / ${TOTAL_TIER1}`, MARGIN + 5, y + 9);
  doc.setTextColor(...INK);
  doc.text(`${tier2} / ${TOTAL_TIER2}`, MARGIN + TEXT_W / 2 + 5, y + 9);
  y += 21;

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...(palier1Valid ? GREEN : RED));
  doc.text(
    palier1Valid
      ? "Palier 1 validé : votre projet est open source"
      : `Palier 1 : ${TOTAL_TIER1 - tier1} point${TOTAL_TIER1 - tier1 > 1 ? "s" : ""} manquant${TOTAL_TIER1 - tier1 > 1 ? "s" : ""}`,
    MARGIN,
    y,
  );
  y += 5;
  if (idk) {
    write(`Points à vérifier (« je ne sais pas ») : ${idk}`, { size: 9, color: AMBER, gap: 3 });
  } else {
    y += 1;
  }
  y += 3;

  // --- Détail par groupe ---
  for (const group of GROUPS) {
    const done = group.items.filter((i) => answers[i.id] === "yes").length;
    breakIfNeeded(16);
    write(`${group.title} — ${done}/${group.items.length}`, {
      size: 11.5,
      style: "bold",
      gap: 2,
    });
    for (const item of group.items) {
      const answer = answers[item.id];
      const label = `${markFor(answer)} ${item.label}${item.required ? "  *" : ""}`;
      write(label, { size: 9, color: colorFor(answer), indent: 3, gap: 0.8 });
    }
    y += 3.5;
  }

  // --- Palier 1 : points manquants ---
  const missing = missingRequired(answers);
  breakIfNeeded(14);
  write(
    missing.length ? `Palier 1 — points manquants (${missing.length})` : "Palier 1 complet.",
    { size: 11.5, style: "bold", color: missing.length ? RED : GREEN, gap: 2 },
  );
  for (const { item, answer } of missing) {
    write(`! ${item.label}${missingSuffix(answer)}`, { size: 9, color: RED, indent: 3, gap: 0.8 });
  }

  // --- Légende et pieds de page ---
  y += 4;
  write("[x] oui   [ ] non   [?] je ne sais pas   [-] sans réponse   * = palier 1", {
    size: 8,
    color: INK_2,
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p += 1) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...INK_2);
    doc.text(`${fields.team || "—"} — audit open source`, MARGIN, PAGE_H - 10);
    doc.text(`${p} / ${pages}`, PAGE_W - MARGIN, PAGE_H - 10, { align: "right" });
  }

  const buffer = doc.output("arraybuffer");
  return {
    blob: new Blob([buffer], { type: "application/pdf" }),
    base64: toBase64(buffer),
    filename: `audit-${slugify(fields.team)}-${parisDate(now)}.pdf`,
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

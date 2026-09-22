import {
  GROUPS,
  TOTAL_TIER1,
  TOTAL_TIER2,
  missingRequired,
  scoreAnswers,
  type Answers,
} from "./checklist";
import { parisHuman } from "./paris";

export type SubmissionFields = {
  team: string;
  repo: string;
  members: string;
};

/** Members are typed one per line or comma-separated; both collapse to a list. */
export function parseMembers(members: string): string[] {
  return members
    .split(/[\n,]+/)
    .map((m) => m.trim())
    .filter(Boolean);
}

export function markFor(answer: string | undefined): string {
  return answer === "yes" ? "[x]" : answer === "no" ? "[ ]" : answer === "idk" ? "[?]" : "[-]";
}

/** Why a required item is not met — mirrors the original critMissing(). */
export function missingSuffix(answer: string | undefined): string {
  return answer === "idk" ? "  (à vérifier)" : answer ? "" : "  (sans réponse)";
}

/** The plain-text audit shown in the <pre> block and copied by « Copier le résumé ».
 *  Same shape as the original page, minus the Jeudi/Vendredi line and the [+] markers. */
export function buildSummary(fields: SubmissionFields, answers: Answers, now: Date): string {
  const { tier1, tier2, idk, palier1Valid } = scoreAnswers(answers);
  const lines: string[] = [];

  lines.push(`AUDIT OPEN SOURCE — ${parisHuman(now)}`);
  lines.push(`Équipe : ${fields.team || "—"}`);
  lines.push(`Repo : ${fields.repo || "—"}`);
  lines.push(`Membres : ${parseMembers(fields.members).join(", ") || "—"}`);
  lines.push(
    `Palier 1 (minimum open source) : ${tier1} / ${TOTAL_TIER1}${palier1Valid ? "  ✔ validé" : ""}`,
  );
  lines.push(`Palier 2 (bonnes pratiques) : ${tier2} / ${TOTAL_TIER2}`);
  if (idk) lines.push(`Points à vérifier (« je ne sais pas ») : ${idk}`);
  lines.push("");

  for (const group of GROUPS) {
    const done = group.items.filter((i) => answers[i.id] === "yes").length;
    lines.push(`${group.title} — ${done}/${group.items.length}`);
    for (const item of group.items) {
      lines.push(`  ${markFor(answers[item.id])} ${item.label}${item.required ? "  *" : ""}`);
    }
    lines.push("");
  }

  const missing = missingRequired(answers);
  lines.push(
    missing.length ? `Palier 1 — points manquants (${missing.length}) :` : "Palier 1 complet.",
  );
  for (const { item, answer } of missing) {
    lines.push(`  ! ${item.label}${missingSuffix(answer)}`);
  }

  lines.push("", "[x] oui   [ ] non   [?] je ne sais pas   [-] sans réponse   * = palier 1");
  return lines.join("\n");
}

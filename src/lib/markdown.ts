import { GROUPS, missingRequired, scoreAnswers, TOTAL_TIER1, TOTAL_TIER2, type Answers } from "./checklist";
import { parisIso } from "./paris";
import { missingSuffix, parseMembers, type SubmissionFields } from "./summary";

/** Double-quoted YAML scalars. JSON string escaping is a valid subset of YAML's,
 *  so a team called `Nimbus: "the" one` survives the round trip. */
function yaml(value: string): string {
  return JSON.stringify(value);
}

function checkbox(answer: string | undefined): string {
  if (answer === "yes") return "- [x]";
  if (answer === "idk") return "- [?]";
  return "- [ ]";
}

export function buildMarkdown(
  fields: SubmissionFields,
  answers: Answers,
  submittedAt: Date,
): string {
  const { tier1, tier2, idk, palier1Valid } = scoreAnswers(answers);
  const members = parseMembers(fields.members);
  const out: string[] = [];

  out.push("---");
  out.push(`team: ${yaml(fields.team)}`);
  out.push(`repo: ${yaml(fields.repo)}`);
  if (members.length === 0) {
    out.push("members: []");
  } else {
    out.push("members:");
    for (const member of members) out.push(`  - ${yaml(member)}`);
  }
  out.push(`submitted_at: ${parisIso(submittedAt)}`);
  out.push(`score_palier1: "${tier1}/${TOTAL_TIER1}"`);
  out.push(`score_palier2: "${tier2}/${TOTAL_TIER2}"`);
  out.push(`idk_count: ${idk}`);
  out.push(`palier1_valid: ${palier1Valid}`);
  out.push("---");
  out.push("");
  out.push(`# Audit open source — ${fields.team}`);
  out.push("");

  for (const group of GROUPS) {
    const done = group.items.filter((i) => answers[i.id] === "yes").length;
    out.push(`## ${group.title} — ${done}/${group.items.length}`);
    out.push("");
    for (const item of group.items) {
      const answer = answers[item.id];
      const tags = [item.required ? "(requis)" : "", answer ? "" : "(sans réponse)"]
        .filter(Boolean)
        .join(" ");
      out.push(`${checkbox(answer)} ${item.label}${tags ? ` ${tags}` : ""}`);
    }
    out.push("");
  }

  const missing = missingRequired(answers);
  out.push("## Palier 1 — points manquants");
  out.push("");
  if (missing.length === 0) {
    out.push("Aucun : le palier 1 est validé.");
  } else {
    for (const { item, answer } of missing) {
      const why = missingSuffix(answer).trim();
      out.push(`- ${item.label}${why ? ` ${why}` : ""}`);
    }
  }
  out.push("");

  return out.join("\n");
}

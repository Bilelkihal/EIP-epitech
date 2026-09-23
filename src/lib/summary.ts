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

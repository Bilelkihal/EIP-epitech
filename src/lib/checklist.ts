import data from "@/data/checklist.json";

/** The three answers a team can give. A fourth state — no answer at all — is
 *  represented by the absence of a key in an `Answers` map. */
export const ANSWERS = ["yes", "no", "idk"] as const;
export type Answer = (typeof ANSWERS)[number];

export type Answers = Partial<Record<string, Answer>>;

export type ChecklistItem = {
  id: string;
  label: string;
  /** Palier 1 items only: shown with a « requis » tag and counted in the gate. */
  required: boolean;
};

export type ChecklistGroup = {
  id: string;
  tier: 1 | 2;
  title: string;
  why: string;
  items: ChecklistItem[];
};

export const GROUPS: ChecklistGroup[] = data.groups.map((g) => ({
  ...g,
  tier: g.tier === 1 ? 1 : 2,
}));

export const ALL_ITEMS: ChecklistItem[] = GROUPS.flatMap((g) => g.items);
export const ITEM_IDS: string[] = ALL_ITEMS.map((i) => i.id);
export const ITEMS_BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));

export const TIER1_ITEMS = GROUPS.filter((g) => g.tier === 1).flatMap((g) => g.items);
export const TIER2_ITEMS = GROUPS.filter((g) => g.tier === 2).flatMap((g) => g.items);
export const TOTAL_TIER1 = TIER1_ITEMS.length;
export const TOTAL_TIER2 = TIER2_ITEMS.length;

export type Scores = {
  tier1: number;
  tier2: number;
  idk: number;
  palier1Valid: boolean;
};

/** Single source of truth for scoring. The page uses it to render the live
 *  header, the route handler re-runs it on the server so a crafted payload
 *  cannot inflate a score. */
export function scoreAnswers(answers: Answers): Scores {
  const yes = (items: ChecklistItem[]) => items.filter((i) => answers[i.id] === "yes").length;
  const tier1 = yes(TIER1_ITEMS);
  return {
    tier1,
    tier2: yes(TIER2_ITEMS),
    idk: ALL_ITEMS.filter((i) => answers[i.id] === "idk").length,
    palier1Valid: tier1 === TOTAL_TIER1,
  };
}

/** Palier 1 items that are not answered « oui », in checklist order. */
export function missingRequired(answers: Answers): { item: ChecklistItem; answer?: Answer }[] {
  return ALL_ITEMS.filter((i) => i.required && answers[i.id] !== "yes").map((item) => ({
    item,
    answer: answers[item.id],
  }));
}

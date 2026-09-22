import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { scoreAnswers, type Answers } from "./checklist";
import { buildMarkdown } from "./markdown";
import { parisDate, parisIso, parisTimeForFile } from "./paris";
import { slugify } from "./slug";
import type { SubmissionFields } from "./summary";

export const SUBMISSIONS_DIR = path.join(process.cwd(), "submissions");
const INDEX_CSV = path.join(SUBMISSIONS_DIR, "index.csv");
const CSV_HEADER = "submitted_at,team,palier1,palier2,idk,file\n";

/** Read-only or missing filesystem — the usual shape of a serverless host. */
function isReadOnly(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "EROFS" || code === "EACCES" || code === "EPERM";
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export type WriteResult =
  | { written: true; file: string }
  | { written: false; reason: "read-only" | "error"; message: string };

/**
 * Writes one Markdown file per submission and appends a row to index.csv.
 * Never overwrites: the exclusive-create flag makes two simultaneous
 * submissions from the same team in the same second resolve to _2, _3, …
 * rather than one clobbering the other.
 */
export async function writeSubmission(
  fields: SubmissionFields,
  answers: Answers,
  submittedAt: Date,
): Promise<WriteResult> {
  const day = parisDate(submittedAt);
  const dir = path.join(SUBMISSIONS_DIR, day);
  const base = `${parisTimeForFile(submittedAt)}_${slugify(fields.team)}`;
  const markdown = buildMarkdown(fields, answers, submittedAt);

  try {
    await mkdir(dir, { recursive: true });

    let relative = "";
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const name = attempt === 1 ? `${base}.md` : `${base}_${attempt}.md`;
      try {
        await writeFile(path.join(dir, name), markdown, { encoding: "utf8", flag: "wx" });
        relative = path.posix.join("submissions", day, name);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
    }
    if (!relative) {
      return { written: false, reason: "error", message: "50 fichiers portent déjà ce nom." };
    }

    const { tier1, tier2, idk } = scoreAnswers(answers);
    const row = [
      csvCell(parisIso(submittedAt)),
      csvCell(fields.team),
      String(tier1),
      String(tier2),
      String(idk),
      csvCell(relative),
    ].join(",");
    await appendIndexRow(row);

    return { written: true, file: relative };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      written: false,
      reason: isReadOnly(error) ? "read-only" : "error",
      message,
    };
  }
}

/** Creates index.csv with its header exactly once. The exclusive-create flag
 *  means two concurrent submissions cannot each write a header. */
async function appendIndexRow(row: string): Promise<void> {
  try {
    await writeFile(INDEX_CSV, CSV_HEADER, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  await appendFile(INDEX_CSV, row + "\n", "utf8");
}

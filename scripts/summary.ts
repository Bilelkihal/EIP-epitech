/**
 * Compares every team's first and latest submission.
 *
 *   npx tsx scripts/summary.ts            all submissions
 *   npx tsx scripts/summary.ts 2026-09-22 only that day onwards
 *
 * Reads the Markdown files directly rather than index.csv: the .md files are
 * the record, and one copied out of an e-mail counts the same as one written
 * by the server.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SUBMISSIONS = path.join(process.cwd(), "submissions");

type Submission = {
  team: string;
  key: string;
  submittedAt: string;
  palier1: number;
  palier1Total: number;
  palier2: number;
  palier2Total: number;
  idk: number;
  file: string;
};

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

function parseScore(value: string): [number, number] {
  const [got, total] = unquote(value).split("/");
  return [Number(got), Number(total)];
}

function parseFrontMatter(source: string): Record<string, string> {
  if (!source.startsWith("---")) return {};
  const end = source.indexOf("\n---", 3);
  if (end === -1) return {};
  const fields: Record<string, string> = {};
  for (const line of source.slice(4, end).split("\n")) {
    if (line.startsWith("  - ") || !line.includes(":")) continue;
    const at = line.indexOf(":");
    fields[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return fields;
}

/** "2026-09-22T18:47:03+02:00" -> "22/09 18:47" */
function shortDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]} ${match[4]}:${match[5]}` : iso;
}

async function collect(since?: string): Promise<Submission[]> {
  let days: string[];
  try {
    days = (await readdir(SUBMISSIONS, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }

  const out: Submission[] = [];
  for (const day of days) {
    if (since && day < since) continue;
    const files = (await readdir(path.join(SUBMISSIONS, day))).filter((f) => f.endsWith(".md")).sort();
    for (const file of files) {
      const relative = path.posix.join("submissions", day, file);
      const fields = parseFrontMatter(await readFile(path.join(SUBMISSIONS, day, file), "utf8"));
      if (!fields.team || !fields.score_palier1) {
        console.warn(`  (ignoré, en-tête illisible) ${relative}`);
        continue;
      }
      const team = unquote(fields.team);
      const [palier1, palier1Total] = parseScore(fields.score_palier1);
      const [palier2, palier2Total] = parseScore(fields.score_palier2 ?? "0/0");
      out.push({
        team,
        key: team.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(),
        submittedAt: unquote(fields.submitted_at ?? `${day}T00:00:00+02:00`),
        palier1,
        palier1Total,
        palier2,
        palier2Total,
        idk: Number(unquote(fields.idk_count ?? "0")),
        file: relative,
      });
    }
  }
  return out.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
  return value.length >= width ? value : " ".repeat(width - value.length) + value;
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

async function main() {
  const since = process.argv[2];
  const submissions = await collect(since);

  if (submissions.length === 0) {
    console.log(
      since
        ? `Aucune soumission depuis ${since} dans submissions/.`
        : "Aucune soumission dans submissions/.",
    );
    return;
  }

  const byTeam = new Map<string, Submission[]>();
  for (const submission of submissions) {
    const list = byTeam.get(submission.key);
    if (list) list.push(submission);
    else byTeam.set(submission.key, [submission]);
  }

  const teams = [...byTeam.values()].sort((a, b) =>
    a[a.length - 1].team.localeCompare(b[b.length - 1].team, "fr"),
  );

  const nameWidth = Math.max(8, ...teams.map((s) => s[s.length - 1].team.length));

  const header =
    pad("ÉQUIPE", nameWidth) +
    padLeft("N", 4) +
    "   " +
    pad("PREMIÈRE", 12) +
    padLeft("P1", 6) +
    padLeft("P2", 7) +
    padLeft("?", 4) +
    "   " +
    pad("DERNIÈRE", 12) +
    padLeft("P1", 6) +
    padLeft("P2", 7) +
    padLeft("?", 4) +
    padLeft("ΔP1", 6) +
    padLeft("ΔP2", 6);

  console.log("");
  console.log(header);
  console.log("─".repeat(header.length));

  let totalD1 = 0;
  let totalD2 = 0;

  for (const list of teams) {
    const first = list[0];
    const last = list[list.length - 1];
    const single = list.length === 1;
    const d1 = last.palier1 - first.palier1;
    const d2 = last.palier2 - first.palier2;
    totalD1 += d1;
    totalD2 += d2;

    console.log(
      pad(last.team, nameWidth) +
        padLeft(String(list.length), 4) +
        "   " +
        pad(shortDate(first.submittedAt), 12) +
        padLeft(`${first.palier1}/${first.palier1Total}`, 6) +
        padLeft(`${first.palier2}/${first.palier2Total}`, 7) +
        padLeft(String(first.idk), 4) +
        "   " +
        (single ? pad("—", 12) + padLeft("—", 6) + padLeft("—", 7) + padLeft("—", 4) : pad(shortDate(last.submittedAt), 12) +
          padLeft(`${last.palier1}/${last.palier1Total}`, 6) +
          padLeft(`${last.palier2}/${last.palier2Total}`, 7) +
          padLeft(String(last.idk), 4)) +
        padLeft(single ? "—" : signed(d1), 6) +
        padLeft(single ? "—" : signed(d2), 6),
    );
  }

  console.log("─".repeat(header.length));
  const validated = teams.filter((l) => {
    const last = l[l.length - 1];
    return last.palier1 === last.palier1Total;
  }).length;
  console.log(
    `${teams.length} équipe${teams.length > 1 ? "s" : ""}, ${submissions.length} envoi${
      submissions.length > 1 ? "s" : ""
    } — palier 1 validé par ${validated}/${teams.length}` +
      ` — progression cumulée ${signed(totalD1)} (P1) / ${signed(totalD2)} (P2)`,
  );
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

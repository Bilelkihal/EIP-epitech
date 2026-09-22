import { NextResponse } from "next/server";
import { z } from "zod";
import { ITEM_IDS, type Answers } from "@/lib/checklist";
import { sendSubmissionEmail } from "@/lib/email";
import { writeSubmission } from "@/lib/storage";

/** Node, not edge: this handler writes files and uses Buffer. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The PDF rides along as base64, so the cap is generous — but finite. */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

const KNOWN_IDS = new Set(ITEM_IDS);

const bodySchema = z
  .object({
    team: z.string().trim().min(1, "Le nom du projet / équipe est obligatoire.").max(120),
    repo: z.string().trim().max(500).default(""),
    members: z.string().max(4000).default(""),
    answers: z
      .record(z.string().max(120), z.enum(["yes", "no", "idk"]))
      .refine(
        (answers) => Object.keys(answers).every((id) => KNOWN_IDS.has(id)),
        "Réponse pour une question inconnue.",
      ),
    pdf: z
      .object({
        filename: z.string().trim().min(1).max(200),
        base64: z.string().max(MAX_BODY_BYTES),
      })
      .optional(),
  })
  .strict();

function fail(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return fail("Envoi trop volumineux.", 413);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail("Corps de requête illisible.", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Requête invalide.", 400);
  }

  const { team, repo, members, answers, pdf } = parsed.data;
  const fields = { team, repo, members };
  // Scores are never taken from the client: everything reported downstream is
  // recomputed from checklist.json against these answers.
  const stored: Answers = answers;
  const submittedAt = new Date();

  const write = await writeSubmission(fields, stored, submittedAt);
  if (!write.written && write.reason === "error") {
    console.error("[submit] écriture impossible:", write.message);
  }

  const email = await sendSubmissionEmail({
    fields,
    answers: stored,
    submittedAt,
    file: write.written ? write.file : null,
    pdf,
  });
  if (!email.sent) {
    console.warn("[submit] e-mail non envoyé:", email.reason);
  }

  // A submission counts if it left a trace somewhere. Losing both the file and
  // the mail is the only real failure — anything else and the team is done.
  if (!write.written && !email.sent) {
    return fail(
      "Impossible d'enregistrer votre audit (ni fichier, ni e-mail). Prévenez votre coach.",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    file: write.written ? write.file : null,
    emailed: email.sent,
  });
}

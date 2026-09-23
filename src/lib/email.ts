import nodemailer from "nodemailer";
import { missingRequired, scoreAnswers, TOTAL_TIER1, TOTAL_TIER2, type Answers } from "./checklist";
import { parisHuman } from "./paris";
import { missingSuffix, parseMembers, type SubmissionFields } from "./summary";

/** Gmail by default; any SMTP provider works by overriding the host and port. */
const DEFAULT_HOST = "smtp.gmail.com";
const DEFAULT_PORT = 465;

export type EmailResult = { sent: boolean; reason?: string };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function body(
  fields: SubmissionFields,
  answers: Answers,
  submittedAt: Date,
  file: string | null,
): string {
  const { tier1, tier2, idk, palier1Valid } = scoreAnswers(answers);
  const missing = missingRequired(answers);
  const members = parseMembers(fields.members);
  const repo = fields.repo.trim();

  const rows = [
    ["Équipe", escapeHtml(fields.team)],
    ["Repo", repo ? `<a href="${escapeHtml(repo)}">${escapeHtml(repo)}</a>` : "—"],
    ["Membres", members.length ? escapeHtml(members.join(", ")) : "—"],
    ["Envoyé le", parisHuman(submittedAt)],
    ["Palier 1", `<b>${tier1} / ${TOTAL_TIER1}</b>${palier1Valid ? " — validé" : ""}`],
    ["Palier 2", `<b>${tier2} / ${TOTAL_TIER2}</b>`],
    ["À vérifier", String(idk)],
    ["Fichier", file ? `<code>${escapeHtml(file)}</code>` : "non écrit (hôte en lecture seule)"],
  ]
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 14px 4px 0;color:#4a5470;white-space:nowrap">${label}</td><td style="padding:4px 0">${value}</td></tr>`,
    )
    .join("");

  const gaps = missing.length
    ? `<h3 style="margin:24px 0 6px;font-size:15px">Palier 1 — points manquants (${missing.length})</h3>
       <ul style="margin:0;padding-left:20px;color:#c62828">${missing
         .map(({ item, answer }) => `<li>${escapeHtml(item.label)}${escapeHtml(missingSuffix(answer))}</li>`)
         .join("")}</ul>`
    : `<p style="margin:24px 0 0;color:#1f883d"><b>Palier 1 complet.</b></p>`;

  return `<div style="font-family:ui-sans-serif,system-ui,sans-serif;color:#14213d;line-height:1.5">
    <h2 style="margin:0 0 14px;font-size:19px">Audit open source — ${escapeHtml(fields.team)}</h2>
    <table style="border-collapse:collapse;font-size:14px">${rows}</table>
    ${gaps}
    <p style="margin:24px 0 0;font-size:13px;color:#4a5470">Le détail complet est dans le PDF joint.</p>
  </div>`;
}

/**
 * Sends the audit to the coach's inbox with the student's own PDF attached,
 * over SMTP — Gmail unless SMTP_HOST says otherwise.
 *
 * Never throws: a missing credential or an SMTP outage must not cost a team its
 * submission, so the caller decides what to tell them.
 */
export async function sendSubmissionEmail(options: {
  fields: SubmissionFields;
  answers: Answers;
  submittedAt: Date;
  file: string | null;
  pdf?: { filename: string; base64: string };
}): Promise<EmailResult> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const to = process.env.SUBMISSIONS_EMAIL_TO;
  if (!user) return { sent: false, reason: "SMTP_USER absent" };
  if (!pass) return { sent: false, reason: "SMTP_PASSWORD absent" };
  if (!to) return { sent: false, reason: "SUBMISSIONS_EMAIL_TO absent" };

  const { fields, answers, submittedAt, file, pdf } = options;
  const { tier1, tier2 } = scoreAnswers(answers);
  const port = Number(process.env.SMTP_PORT ?? DEFAULT_PORT);

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? DEFAULT_HOST,
      port,
      // 465 is implicit TLS; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: { user, pass },
    });

    await transport.sendMail({
      // Gmail rewrites a From that is not the authenticated account, so the
      // default keeps them in step.
      from: process.env.SUBMISSIONS_EMAIL_FROM || `OSS Checklist <${user}>`,
      to: to.split(",").map((address) => address.trim()).filter(Boolean),
      subject: `[TEK5 Open Source] ${fields.team} — P1 ${tier1}/${TOTAL_TIER1} · P2 ${tier2}/${TOTAL_TIER2}`,
      html: body(fields, answers, submittedAt, file),
      attachments: pdf
        ? [{ filename: pdf.filename, content: Buffer.from(pdf.base64, "base64") }]
        : undefined,
    });
    return { sent: true };
  } catch (cause) {
    return { sent: false, reason: cause instanceof Error ? cause.message : String(cause) };
  }
}

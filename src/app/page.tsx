"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ALL_ITEMS,
  GROUPS,
  TOTAL_TIER1,
  TOTAL_TIER2,
  scoreAnswers,
  type Answer,
  type Answers,
} from "@/lib/checklist";
import { buildPdf, downloadBlob } from "@/lib/pdf";
import { buildSummary } from "@/lib/summary";

/** Bumped from the original page's `oss-readiness-tek5`: the stored shape lost
 *  its j1/j2 snapshots, so old payloads are not worth migrating. */
const STORAGE_KEY = "oss-readiness-tek5-v2";

const TRI: { value: Answer; label: string }[] = [
  { value: "yes", label: "Oui" },
  { value: "no", label: "Non" },
  { value: "idk", label: "?" },
];

type Sent = {
  file: string | null;
  emailed: boolean;
  pdf: { blob: Blob; filename: string };
};

export default function Page() {
  const [team, setTeam] = useState("");
  const [repo, setRepo] = useState("");
  const [members, setMembers] = useState("");
  const [answers, setAnswers] = useState<Answers>({});

  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  const [missingIds, setMissingIds] = useState<string[]>([]);
  const [teamMissing, setTeamMissing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamRef = useRef<HTMLInputElement>(null);

  // --- Persistance locale ------------------------------------------------

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<{
          team: string;
          repo: string;
          members: string;
          answers: Answers;
        }>;
        if (typeof saved.team === "string") setTeam(saved.team);
        if (typeof saved.repo === "string") setRepo(saved.repo);
        if (typeof saved.members === "string") setMembers(saved.members);
        if (saved.answers && typeof saved.answers === "object") setAnswers(saved.answers);
      }
    } catch {
      /* navigation privée, quota plein : on repart d'un formulaire vide */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ team, repo, members, answers }));
    } catch {
      /* ignoré volontairement */
    }
  }, [hydrated, team, repo, members, answers]);

  // Le résumé est horodaté ; on rafraîchit l'heure à chaque changement.
  useEffect(() => {
    setNow(new Date());
  }, [hydrated, team, repo, members, answers]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // --- Scores ------------------------------------------------------------

  const scores = useMemo(() => scoreAnswers(answers), [answers]);
  const summary = useMemo(
    () => (now ? buildSummary({ team, repo, members }, answers, now) : ""),
    [team, repo, members, answers, now],
  );

  const gateIdk = useMemo(
    () => GROUPS.filter((g) => g.tier === 1).flatMap((g) => g.items).filter((i) => answers[i.id] === "idk").length,
    [answers],
  );

  // --- Interactions ------------------------------------------------------

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  }, []);

  /** Second click on the same value clears the answer, as in the original. */
  const toggle = useCallback((id: string, value: Answer) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[id] === value) delete next[id];
      else next[id] = value;
      return next;
    });
    setMissingIds((prev) => prev.filter((m) => m !== id));
  }, []);

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summary);
      showToast("Résumé copié");
    } catch {
      showToast("Sélectionnez et copiez le texte ci-dessous");
    }
  }, [summary, showToast]);

  const reset = useCallback(() => {
    if (!confirm("Effacer toutes les réponses enregistrées sur cet appareil ?")) return;
    setTeam("");
    setRepo("");
    setMembers("");
    setAnswers({});
    setMissingIds([]);
    setTeamMissing(false);
    setError(null);
    setSent(null);
  }, []);

  const submit = useCallback(async () => {
    setError(null);

    const blankTeam = team.trim().length === 0;
    const blanks = ALL_ITEMS.filter((i) => !answers[i.id]);
    setTeamMissing(blankTeam);
    setMissingIds(blanks.map((i) => i.id));

    if (blankTeam || blanks.length > 0) {
      const target = blankTeam
        ? teamRef.current
        : document.getElementById(`item-${blanks[0].id}`);
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      if (blankTeam) teamRef.current?.focus({ preventScroll: true });
      return;
    }

    setSending(true);
    try {
      const stamp = new Date();
      const pdf = await buildPdf({ team, repo, members }, answers, stamp);

      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          team,
          repo,
          members,
          answers,
          pdf: { filename: pdf.filename, base64: pdf.base64 },
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: true; file: string | null; emailed: boolean }
        | { ok: false; error: string }
        | null;

      if (!response.ok || !payload || payload.ok !== true) {
        throw new Error(
          (payload && "error" in payload && payload.error) ||
            `Le serveur a répondu ${response.status}.`,
        );
      }

      setSent({ file: payload.file, emailed: payload.emailed, pdf });
      downloadBlob(pdf.blob, pdf.filename);
      showToast("Réponses envoyées");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Envoi impossible.");
    } finally {
      setSending(false);
    }
  }, [team, repo, members, answers, showToast]);

  // --- Rendu -------------------------------------------------------------

  const missingCount = TOTAL_TIER1 - scores.tier1;
  let tier2Started = false;

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="scores">
            <div className={`sc${scores.palier1Valid ? " done" : ""}`}>
              <span className="lbl">Palier 1</span>
              <b>{scores.tier1}</b>
              <small>/ {TOTAL_TIER1}</small>
              <div className="bar">
                <i className="fill1" style={{ width: `${(100 * scores.tier1) / TOTAL_TIER1}%` }} />
              </div>
            </div>
            <div className="sc">
              <span className="lbl">Bonnes pratiques</span>
              <b>{scores.tier2}</b>
              <small>/ {TOTAL_TIER2}</small>
              <div className="bar">
                <i style={{ width: `${(100 * scores.tier2) / TOTAL_TIER2}%` }} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <h1>Votre EIP est-il prêt pour l&apos;open source ?</h1>
        <p className="lead">
          Auditez votre repo honnêtement, comme si vous étiez un développeur extérieur qui le
          découvre. Cochez uniquement ce qui est vrai aujourd&apos;hui. Le palier 1 est obligatoire :
          c&apos;est l&apos;objectif de jeudi. Les bonnes pratiques, vous choisissez vos priorités
          pour vendredi.
        </p>

        <div className="team">
          <div>
            <label htmlFor="team">Nom du projet / équipe</label>
            <input
              id="team"
              ref={teamRef}
              className={teamMissing ? "missing" : undefined}
              autoComplete="off"
              placeholder="ex. Nimbus"
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                if (e.target.value.trim()) setTeamMissing(false);
              }}
            />
          </div>
          <div>
            <label htmlFor="repo">Lien du repo</label>
            <input
              id="repo"
              autoComplete="off"
              placeholder="https://github.com/…"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>
          <div className="full">
            <label htmlFor="members">Membres (un par ligne ou séparés par des virgules)</label>
            <textarea
              id="members"
              placeholder="Prénom Nom, Prénom Nom…"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
          </div>
        </div>

        {GROUPS.map((group) => {
          const done = group.items.filter((i) => answers[i.id] === "yes").length;
          const idk = group.items.filter((i) => answers[i.id] === "idk").length;
          const isGate = group.tier === 1;
          const intro = !isGate && !tier2Started;
          if (intro) tier2Started = true;

          return (
            <div key={group.id}>
              {intro && (
                <div>
                  <h2 className="tier2-title">Palier 2 — Les bonnes pratiques</h2>
                  <p className="tier2-lead">
                    Ce qui fait qu&apos;un projet est non seulement ouvert, mais utilisé, maintenu et
                    rejoint par d&apos;autres. Choisissez trois chantiers, pas trente.
                  </p>
                </div>
              )}
              <section
                id={group.id}
                className={`grp${isGate ? " gate" : ""}${isGate && scores.palier1Valid ? " done" : ""}`}
              >
                {isGate && (
                  <span className="status">
                    {scores.palier1Valid
                      ? "Palier 1 validé : votre projet est open source"
                      : `Palier 1 : ${missingCount} point${missingCount > 1 ? "s" : ""} manquant${
                          missingCount > 1 ? "s" : ""
                        }${gateIdk ? ` dont ${gateIdk} à vérifier` : ""}`}
                  </span>
                )}
                <h2>
                  {group.title}
                  <span className="n">
                    {done} / {group.items.length}
                    {idk ? <span className="idk-note"> · {idk} à vérifier</span> : null}
                  </span>
                </h2>
                <p className="why">{group.why}</p>
                <ul>
                  {group.items.map((item) => {
                    const value = answers[item.id] ?? "";
                    return (
                      <li key={item.id}>
                        <div
                          id={`item-${item.id}`}
                          className={`item${missingIds.includes(item.id) ? " missing" : ""}`}
                          data-v={value}
                        >
                          <span className="t">{item.label}</span>
                          <span className="meta">
                            {item.required && <span className="tag">requis</span>}
                            <span className="tri" role="group" aria-label="Réponse">
                              {TRI.map((tri) => (
                                <button
                                  key={tri.value}
                                  type="button"
                                  data-v={tri.value}
                                  aria-pressed={value === tri.value}
                                  aria-label={`${item.label} — ${tri.label}`}
                                  onClick={() => toggle(item.id, tri.value)}
                                >
                                  {tri.label}
                                </button>
                              ))}
                            </span>
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          );
        })}

        <div className="foot">
          <h2>Envoyer votre audit</h2>
          <p>
            Le résumé ci-dessous est généré à partir de vos réponses. Envoyez-le à votre coach, et
            gardez le PDF que vous recevrez en retour.
          </p>
          <div className="actions">
            <button className="primary" type="button" onClick={submit} disabled={sending}>
              {sending ? "Envoi…" : "Envoyer mes réponses"}
            </button>
            <button className="secondary" type="button" onClick={copySummary}>
              Copier le résumé
            </button>
            <button className="ghost" type="button" onClick={reset}>
              Tout effacer sur cet appareil
            </button>
          </div>

          {(teamMissing || missingIds.length > 0) && (
            <div className="notice error" role="alert">
              <h3>Il manque des réponses</h3>
              {teamMissing && <p>Le nom du projet / équipe est obligatoire.</p>}
              {missingIds.length > 0 && (
                <>
                  <p>
                    {missingIds.length} question{missingIds.length > 1 ? "s" : ""} sans réponse.
                    Répondez Oui, Non ou ? à chacune.
                  </p>
                  <ul>
                    {missingIds.slice(0, 5).map((id) => (
                      <li key={id}>{ALL_ITEMS.find((i) => i.id === id)?.label}</li>
                    ))}
                    {missingIds.length > 5 && <li>… et {missingIds.length - 5} autres</li>}
                  </ul>
                </>
              )}
            </div>
          )}

          {error && (
            <div className="notice error" role="alert">
              <h3>Envoi impossible</h3>
              <p>{error}</p>
              <p>Vos réponses sont intactes : réessayez dans un instant.</p>
            </div>
          )}

          {sent && (
            <div className="notice sent" role="status">
              <h3>Réponses envoyées</h3>
              <p>
                {sent.file
                  ? "Votre audit a été enregistré."
                  : "Votre audit a été transmis à votre coach."}
                {sent.file && <span className="file mono">{sent.file}</span>}
              </p>
              {!sent.emailed && sent.file && (
                <p>
                  <small>L&apos;e-mail de confirmation n&apos;est pas parti, le fichier est bien écrit.</small>
                </p>
              )}
              <button
                type="button"
                className="link"
                onClick={() => downloadBlob(sent.pdf.blob, sent.pdf.filename)}
              >
                Télécharger le PDF
              </button>
            </div>
          )}

          <pre className="out">{summary}</pre>
        </div>
      </main>

      <div className={`toast${toast ? " show" : ""}`} role="status">
        {toast}
      </div>
    </>
  );
}

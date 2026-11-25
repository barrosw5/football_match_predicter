"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { competitionLabel, formatDate, T, tr } from "@/lib/i18n";
import type { PlayerProfile } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { TeamLogo } from "./team-logo";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Player page, loaded in the browser from /data/player/<id>.json (one static page for all players). */
export function PlayerView() {
  const lang = useLang();
  const id = useSearchParams().get("id");
  const valid = !!id && /^\d+$/.test(id);
  // result of the last fetch, tagged with the id it belongs to
  const [loaded, setLoaded] = useState<{ id: string; player: PlayerProfile | null } | null>(null);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    fetch(`${BASE}/data/player/${id}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p: PlayerProfile) => alive && setLoaded({ id: id!, player: p }))
      .catch(() => alive && setLoaded({ id: id!, player: null }));
    return () => {
      alive = false;
    };
  }, [id, valid]);

  const player = loaded && loaded.id === id ? loaded.player : null;
  const state: "loading" | "ok" | "missing" = !valid ? "missing" : !loaded || loaded.id !== id ? "loading" : player ? "ok" : "missing";

  if (state === "loading") return <p className="py-16 text-center text-ink-3">{tr(lang, "Loading…", "A carregar…")}</p>;
  if (state === "missing" || !player)
    return (
      <p className="py-16 text-center text-ink-2">
        <T en="Player not found." pt="Jogador não encontrado." />
      </p>
    );

  const p = player;
  const goals = Object.entries(p.season.goals);
  const assists = Object.entries(p.season.assists);
  const apps = p.appearances;
  const starts = apps.filter((a) => a.started).length;
  const card = "rounded-2xl border border-line bg-surface p-4 sm:p-6";
  const facts: [string, string | number | null][] = [
    [tr(lang, "Market value", "Valor de mercado"), p.value != null ? `${p.value} M€` : null],
    [tr(lang, "Position", "Posição"), p.posName ?? p.pos],
    [tr(lang, "Shirt", "Número"), p.jersey],
    [tr(lang, "Age", "Idade"), p.age],
    [tr(lang, "Born", "Nascimento"), p.birth ? formatDate(`${p.birth}T12:00:00Z`, "dayMonth", lang) + ` ${p.birth.slice(0, 4)}` : null],
    [tr(lang, "Nationality", "Nacionalidade"), p.nationality],
    [tr(lang, "Height", "Altura"), p.heightCm ? `${p.heightCm} cm` : null],
    [tr(lang, "Weight", "Peso"), p.weightKg ? `${p.weightKg} kg` : null],
  ];

  return (
    <article className="py-6">
      <Link href={`/team/${p.team.slug}/`} className="text-sm text-ink-2 hover:text-ink">
        {tr(lang, "Back to", "Voltar a")} {p.team.name}
      </Link>
      <header className={`mt-4 ${card} flex flex-wrap items-center gap-5`}>
        <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--home)] text-2xl font-semibold text-white">
          {p.jersey ?? initials(p.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.name}</h1>
          <Link href={`/team/${p.team.slug}/`} className="mt-1 inline-flex items-center gap-2 text-sm text-ink-2 hover:text-ink">
            <TeamLogo id={p.team.logo} name={p.team.name} size={18} />
            {p.team.name}
          </Link>
        </div>
        <dl className="tnum grid grid-cols-3 gap-6 text-sm">
          <div>
            <dt className="text-xs text-ink-2">{tr(lang, "Goals", "Golos")}</dt>
            <dd className="text-xl font-semibold">{goals.reduce((s, [, v]) => s + v, 0) || apps.reduce((s, a) => s + a.goals, 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">{tr(lang, "Assists", "Assistências")}</dt>
            <dd className="text-xl font-semibold">{assists.reduce((s, [, v]) => s + v, 0) || apps.reduce((s, a) => s + a.assists, 0)}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-2">{tr(lang, "Starts", "Titular")}</dt>
            <dd className="text-xl font-semibold">
              {starts}/{apps.length}
            </dd>
          </div>
        </dl>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section className={card}>
          <h2 className="font-semibold">{tr(lang, "Profile", "Perfil")}</h2>
          <dl className="mt-3 divide-y divide-line text-sm">
            {facts
              .filter(([, v]) => v !== null && v !== undefined && v !== "")
              .map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-1.5">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="tnum text-right font-medium">{v}</dd>
                </div>
              ))}
          </dl>
          {(goals.length > 0 || assists.length > 0) && (
            <>
              <h3 className="mt-5 text-sm font-medium">{tr(lang, "This season", "Esta época")}</h3>
              <ul className="tnum mt-2 space-y-1 text-sm">
                {[...new Set([...goals.map(([c]) => c), ...assists.map(([c]) => c)])].map((c) => (
                  <li key={c} className="flex justify-between gap-3">
                    <span className="text-ink-2">{competitionLabel(c, lang)}</span>
                    <span>
                      {p.season.goals[c] ?? 0} {tr(lang, "goals", "golos")} · {p.season.assists[c] ?? 0} {tr(lang, "assists", "assist.")}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={card}>
          <h2 className="font-semibold">{tr(lang, "Match by match", "Jogo a jogo")}</h2>
          {apps.length === 0 ? (
            <p className="mt-2 text-sm text-ink-3">
              {tr(lang, "No line-ups recorded for this player yet.", "Ainda não há escalações registadas deste jogador.")}
            </p>
          ) : (
            <div className="scroll-x mt-3">
              <table className="tnum w-full text-sm sm:min-w-[32rem]">
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th className="pb-2 font-normal">{tr(lang, "Date", "Data")}</th>
                    <th className="pb-2 font-normal">{tr(lang, "Opponent", "Adversário")}</th>
                    <th className="pb-2 text-center font-normal">{tr(lang, "Score", "Resultado")}</th>
                    <th className="hidden pb-2 text-center font-normal sm:table-cell">{tr(lang, "Role", "Papel")}</th>
                    <th className="pb-2 text-center font-normal">{tr(lang, "G", "G")}</th>
                    <th className="pb-2 text-center font-normal">{tr(lang, "A", "A")}</th>
                    <th className="hidden pb-2 text-center font-normal sm:table-cell">{tr(lang, "Shots", "Remates")}</th>
                    <th className="pb-2 text-center font-normal">{tr(lang, "Cards", "Cartões")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {apps.map((a, i) => (
                    <tr key={`${a.date}-${i}`}>
                      <td className="py-1.5 pr-2 text-xs text-ink-2">
                        {formatDate(`${a.date}T12:00:00Z`, "dayMonth", lang)}
                        <span className="block text-[10px] text-ink-3">{competitionLabel(a.competition, lang)}</span>
                      </td>
                      <td className="max-w-[8.5rem] py-1.5 pr-2 sm:max-w-48">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="text-xs text-ink-3">{a.home ? "vs" : tr(lang, "at", "em")}</span>
                          <TeamLogo id={a.opponentLogo} name={a.opponent} size={16} />
                          {a.matchId ? (
                            <Link href={`/match/${a.matchId}/`} className="truncate hover:underline">
                              {a.opponent}
                            </Link>
                          ) : (
                            <span className="truncate">{a.opponent}</span>
                          )}
                        </span>
                        {!a.started && <span className="block text-[10px] text-ink-3 sm:hidden">{tr(lang, "sub", "suplente")}</span>}
                      </td>
                      <td className="whitespace-nowrap py-1.5 text-center font-medium">
                        {a.goalsFor ?? "–"}–{a.goalsAgainst ?? "–"}
                      </td>
                      <td className="hidden py-1.5 text-center text-xs text-ink-2 sm:table-cell">{a.started ? tr(lang, "start", "titular") : tr(lang, "sub", "suplente")}</td>
                      <td className="py-1.5 text-center">{a.goals || ""}</td>
                      <td className="py-1.5 text-center">{a.assists || ""}</td>
                      <td className="hidden py-1.5 text-center text-ink-2 sm:table-cell">{a.shots == null ? "" : `${a.shots} (${a.sot ?? 0})`}</td>
                      <td className="py-1.5 text-center">
                        <span className="inline-flex gap-1">
                          {a.yellow && <span className="h-3 w-2 rounded-[1px] bg-[#eda100]" aria-label="yellow" />}
                          {a.red && <span className="h-3 w-2 rounded-[1px] bg-[var(--bad)]" aria-label="red" />}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-ink-3">
            {tr(
              lang,
              "From published line-ups (main leagues, UEFA and Taça de Portugal), most recent first.",
              "A partir das escalações publicadas (ligas principais, UEFA e Taça de Portugal), do mais recente para o mais antigo.",
            )}
          </p>
        </section>
      </div>
    </article>
  );
}

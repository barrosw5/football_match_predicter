import { LocalDate, T } from "@/lib/i18n";

const link = "underline decoration-line underline-offset-2 hover:text-ink";

export function SiteFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <footer className="border-t border-line bg-surface text-sm text-ink-2">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <T en="Data updated" pt="Dados atualizados a" />{" "}
          <span className="tnum text-ink">
            <LocalDate iso={generatedAt} kind="stamp" />
          </span>
          . <T en="Times shown in Lisbon / UK time." pt="Horas de Lisboa." />
        </p>
        <p>
          <T en="Results & odds:" pt="Resultados e odds:" />{" "}
          <a className={link} href="https://www.football-data.co.uk/">
            football-data.co.uk
          </a>{" "}
          <T en="and" pt="e" /> ESPN ·{" "}
          <a className={link} href="https://github.com/barrosw5/football_match_predicter">
            <T en="Source on GitHub" pt="Código no GitHub" />
          </a>
        </p>
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-6 text-xs text-ink-3 sm:px-6">
        <T
          en="Forecasts are probabilities, not certainties. Club crests belong to their clubs. A portfolio project, not betting advice."
          pt="As previsões são probabilidades, não certezas. Os emblemas pertencem aos respetivos clubes. Projeto de portefólio, não é aconselhamento de apostas."
        />
      </p>
    </footer>
  );
}

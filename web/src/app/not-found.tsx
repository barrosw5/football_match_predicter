import Link from "next/link";

import { T } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <h1 className="text-2xl font-semibold">
        <T en="Page not found" pt="Página não encontrada" />
      </h1>
      <p className="mt-2 text-ink-2">
        <T
          en="This match may have dropped out of the published window."
          pt="Este jogo pode já ter saído do período publicado."
        />
      </p>
      <Link href="/" className="mt-6 inline-block text-accent hover:underline">
        <T en="Back to fixtures" pt="Voltar aos jogos" />
      </Link>
    </div>
  );
}

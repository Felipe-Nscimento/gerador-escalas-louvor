"use client";

import { useEffect, useMemo, useState } from "react";
import { Cake, ChevronDown, ChevronUp, X } from "lucide-react";
import { Integrante } from "@/lib/types";
import { KEYS, usePersistedState } from "@/lib/storage";
import { NOMES_MESES } from "@/lib/formularios";

interface Props {
  integrantes: Integrante[];
}

interface Aniversariante {
  id: string;
  nome: string;
  dia: number;
}

/**
 * Aviso dos aniversariantes do mês atual (a partir da data de aniversário do
 * cadastro de Integrantes). Quem controla QUEM vê é o app/page.tsx — este
 * componente só deve ser renderizado para líder/montador.
 * Pode ser fechado; volta a aparecer sozinho no mês seguinte.
 */
export function AniversariantesAviso({ integrantes }: Props) {
  // A data é lida no navegador (depois de montar) para não divergir do HTML pré-renderizado.
  const [hoje, setHoje] = useState<{ ano: number; mes: number; dia: number } | null>(null);
  const [aberto, setAberto] = useState(false);
  const [fechadoNoMes, setFechadoNoMes, carregado] = usePersistedState<string>(
    KEYS.avisoAniversariantes,
    ""
  );

  useEffect(() => {
    const d = new Date();
    setHoje({ ano: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() });
  }, []);

  const lista = useMemo<Aniversariante[]>(() => {
    if (!hoje) return [];
    return integrantes
      .filter(
        (i) =>
          i.ativo !== false &&
          !!i.dataAniversario &&
          /^\d{4}-\d{2}-\d{2}$/.test(i.dataAniversario) &&
          Number(i.dataAniversario.slice(5, 7)) === hoje.mes
      )
      .map((i) => ({
        id: i.id,
        nome: i.nomeExibicao?.trim() || i.nome,
        dia: Number(i.dataAniversario!.slice(8, 10)),
      }))
      .sort((a, b) => a.dia - b.dia || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [integrantes, hoje]);

  if (!hoje || !carregado || lista.length === 0) return null;

  const chaveMes = `${hoje.ano}-${String(hoje.mes).padStart(2, "0")}`;
  if (fechadoNoMes === chaveMes) return null;

  const nomeMes = NOMES_MESES[hoje.mes - 1].toLowerCase();
  const deHoje = lista.filter((a) => a.dia === hoje.dia);

  return (
    <section
      aria-label="Aniversariantes do mês"
      className="no-print mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm"
    >
      <div className="flex items-start gap-3 p-4">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
          <Cake className="h-5 w-5 text-[hsl(var(--accent))]" />
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="flex-1 min-w-0 text-left"
        >
          <p className="font-semibold">
            {lista.length === 1
              ? `1 aniversariante em ${nomeMes}`
              : `${lista.length} aniversariantes em ${nomeMes}`}
          </p>
          <p className="text-sm text-[hsl(var(--muted))] truncate">
            {deHoje.length > 0
              ? `🎉 Hoje: ${deHoje.map((a) => a.nome).join(", ")}`
              : aberto
                ? "Toque para recolher"
                : "Toque para ver quem são"}
          </p>
        </button>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-label={aberto ? "Recolher lista" : "Ver lista"}
          className="p-1.5 rounded-lg text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/40"
        >
          {aberto ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setFechadoNoMes(chaveMes)}
          aria-label="Fechar aviso até o próximo mês"
          title="Fechar até o próximo mês"
          className="p-1.5 rounded-lg text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {aberto && (
        <ul className="border-t border-[hsl(var(--border))] px-4 py-2">
          {lista.map((a) => {
            const ehHoje = a.dia === hoje.dia;
            const jaPassou = a.dia < hoje.dia;
            return (
              <li
                key={a.id}
                className={`flex items-center justify-between gap-3 py-2 text-sm ${
                  jaPassou ? "text-[hsl(var(--muted))]" : ""
                }`}
              >
                <span className={ehHoje ? "font-semibold" : ""}>{a.nome}</span>
                <span className="shrink-0">
                  {ehHoje ? (
                    <span className="rounded-full bg-[hsl(var(--accent))]/15 px-2.5 py-0.5 font-semibold text-[hsl(var(--accent))]">
                      Hoje 🎂
                    </span>
                  ) : (
                    `${String(a.dia).padStart(2, "0")}/${String(hoje.mes).padStart(2, "0")}`
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EfeitoAniversario } from "@/components/EfeitoAniversario";
import { EscalaRemota, payloadValido } from "@/lib/escalasRemoto";
import { ordenarFuncoes } from "@/lib/ordemFuncoes";
import { unificarItens } from "@/lib/scheduleGenerator";
import { EscalaSalva, Instrumento, Integrante } from "@/lib/types";
import { useOrdemFuncoes } from "@/lib/useOrdemFuncoes";

interface Props {
  integrantes: Integrante[];
  instrumentos: Instrumento[];
  historico: EscalaSalva[];
  remotas: EscalaRemota[];
  logado: boolean;
}

interface Linha {
  chave: string;
  nome: string;
  foto?: string;
  instrumentos: Instrumento[]; // todas as funções da pessoa neste culto
  aniversario?: string; // dd/mm, só quando faz aniversário no mês do culto
}

interface CardCulto {
  chave: string;
  dataKey: string; // YYYY-MM-DD
  data: Date;
  titulo: string;
  solo: boolean;
  linhas: Linha[];
  versao: number; // para escolher a versão mais recente quando duas escalas cobrem o mesmo culto
}

const APROVADAS = ["aprovada", "publicada"];

function dataLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

function chaveDeHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

function Foto({ nome, foto }: { nome: string; foto?: string }) {
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={foto} alt={nome} loading="lazy" className="h-16 w-16 shrink-0 rounded-full object-cover bg-[hsl(var(--border))]" />;
  }
  return (
    <div
      aria-label={nome}
      className="h-16 w-16 shrink-0 rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] flex items-center justify-center text-lg font-semibold"
    >
      {iniciais(nome)}
    </div>
  );
}

/**
 * Aba principal "Escala": um card por culto das escalas JÁ APROVADAS pelo líder
 * (aprovada ou publicada), em carrossel paginado — arrasta o dedo para ir ao culto
 * anterior ou ao próximo. Abre no culto de hoje (ou no próximo; se não houver, no último).
 */
export function EscalaPrincipal({ integrantes, instrumentos, historico, remotas, logado }: Props) {
  const ordemFuncoes = useOrdemFuncoes(logado);
  const [hojeKey, setHojeKey] = useState<string | null>(null);
  const [atual, setAtual] = useState(0);
  const [festa, setFesta] = useState<{ nome: string; diaMes: string } | null>(null);
  const trilhoRef = useRef<HTMLDivElement>(null);
  const posicionadoRef = useRef(false);

  // A data é lida no navegador, depois de montar, para não divergir do HTML pré-renderizado.
  useEffect(() => {
    setHojeKey(chaveDeHoje());
  }, []);

  const cards = useMemo<CardCulto[]>(() => {
    const vivos = new Map(integrantes.map((i) => [i.id, i]));
    const instVivos = new Map(instrumentos.map((i) => [i.id, i]));
    const porCulto = new Map<string, CardCulto>();

    function adicionar(
      domingos: EscalaSalva["domingos"],
      extras: EscalaSalva["cultosExtras"],
      snapIntegrantes: Integrante[],
      snapInstrumentos: Instrumento[],
      versao: number
    ) {
      const snapI = new Map(snapIntegrantes.map((i) => [i.id, i]));
      const snapInst = new Map(snapInstrumentos.map((i) => [i.id, i]));
      const ehExtra = new Set(extras.map((c) => c.id));

      for (const item of unificarItens(domingos, extras)) {
        const dataKey = item.data.slice(0, 10);
        const titulo = ehExtra.has(item.id) ? item.rotulo : "Culto de domingo";
        const chave = `${dataKey}|${titulo.trim().toLowerCase()}`;
        const existente = porCulto.get(chave);
        if (existente && existente.versao >= versao) continue;

        // instrumentos usados neste culto, na ordem escolhida (padrão: Voz, Back Vocal, Violão...)
        const usados: Instrumento[] = [];
        for (const instId of Object.keys(item.escalacao.atribuicoes)) {
          if ((item.escalacao.atribuicoes[instId] ?? []).length === 0) continue;
          const inst = instVivos.get(instId) ?? snapInst.get(instId);
          if (inst) usados.push(inst);
        }
        // uma entrada por pessoa: quem tem mais de uma função no culto aparece uma vez só,
        // com todos os instrumentos (a ordem segue a primeira função da pessoa)
        const porPessoa = new Map<string, Linha>();
        const mesDoCulto = Number(dataKey.slice(5, 7));
        for (const inst of ordenarFuncoes(usados, ordemFuncoes)) {
          for (const pid of item.escalacao.atribuicoes[inst.id] ?? []) {
            if (!pid) continue;
            const existente = porPessoa.get(pid);
            if (existente) {
              if (!existente.instrumentos.some((i) => i.id === inst.id)) existente.instrumentos.push(inst);
              continue;
            }
            const p = vivos.get(pid) ?? snapI.get(pid);
            const nasc = p?.dataAniversario;
            const temAniversario =
              !!nasc && /^\d{4}-\d{2}-\d{2}$/.test(nasc) && Number(nasc.slice(5, 7)) === mesDoCulto;
            porPessoa.set(pid, {
              chave: pid,
              nome: p ? p.nomeExibicao?.trim() || p.nome : "Integrante removido",
              foto: p?.foto,
              instrumentos: [inst],
              aniversario: temAniversario ? `${nasc!.slice(8, 10)}/${nasc!.slice(5, 7)}` : undefined,
            });
          }
        }
        const linhas = Array.from(porPessoa.values());

        porCulto.set(chave, {
          chave,
          dataKey,
          data: dataLocal(item.data),
          titulo,
          solo: item.escalacao.solo,
          linhas,
          versao,
        });
      }
    }

    const idsNuvem = new Set(remotas.map((r) => r.id));
    for (const r of remotas) {
      if (!APROVADAS.includes(r.status) || !payloadValido(r.payload)) continue;
      const p = r.payload;
      adicionar(
        p.domingos,
        p.cultosExtras ?? [],
        p.integrantes,
        p.instrumentos,
        new Date(p.atualizadoEm ?? r.approved_at ?? r.created_at).getTime() || 0
      );
    }
    // escalas aprovadas só neste aparelho (sem nuvem); as que já estão na nuvem não entram duas vezes
    for (const e of historico) {
      if (!APROVADAS.includes(e.status) || (e.nuvemId && idsNuvem.has(e.nuvemId))) continue;
      adicionar(
        e.domingos,
        e.cultosExtras ?? [],
        [],
        [],
        new Date(e.atualizadoEm ?? e.criadoEm).getTime() || 0
      );
    }

    return Array.from(porCulto.values()).sort(
      (a, b) => a.dataKey.localeCompare(b.dataKey) || a.titulo.localeCompare(b.titulo, "pt-BR")
    );
  }, [integrantes, instrumentos, historico, remotas, ordemFuncoes]);

  // card de hoje; se não houver, o próximo; se não houver mais nenhum, o último
  const indiceInicial = useMemo(() => {
    if (!hojeKey || cards.length === 0) return 0;
    const i = cards.findIndex((c) => c.dataKey >= hojeKey);
    return i === -1 ? cards.length - 1 : i;
  }, [cards, hojeKey]);

  const indiceProximo = useMemo(() => {
    if (!hojeKey) return -1;
    return cards.findIndex((c) => c.dataKey >= hojeKey);
  }, [cards, hojeKey]);

  useEffect(() => {
    if (posicionadoRef.current || !hojeKey || cards.length === 0) return;
    const el = trilhoRef.current;
    if (!el) return;
    el.scrollTo({ left: indiceInicial * el.clientWidth, behavior: "auto" });
    setAtual(indiceInicial);
    posicionadoRef.current = true;
  }, [cards, hojeKey, indiceInicial]);

  function aoRolar() {
    const el = trilhoRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / el.clientWidth)));
    if (i !== atual) setAtual(i);
  }

  function irPara(i: number) {
    const el = trilhoRef.current;
    if (!el || i < 0 || i > cards.length - 1) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center shadow-sm">
        <CalendarDays className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted))]" />
        <p className="font-semibold">Nenhuma escala aprovada ainda</p>
        <p className="text-sm text-[hsl(var(--muted))] mt-1">
          Quando o líder aprovar uma escala, os cultos aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Escala</h2>
        <div className="flex items-center gap-1">
          {indiceInicial !== atual && (
            <button
              type="button"
              onClick={() => irPara(indiceInicial)}
              className="rounded-full px-3 py-1 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
            >
              {cards[indiceInicial].dataKey === hojeKey ? "Ir para hoje" : "Ir para o próximo"}
            </button>
          )}
          <button
            type="button"
            onClick={() => irPara(atual - 1)}
            disabled={atual === 0}
            aria-label="Culto anterior"
            className="p-1.5 rounded-full hover:bg-[hsl(var(--border))]/50 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-[hsl(var(--muted))] tabular-nums min-w-[3.5rem] text-center">
            {atual + 1} de {cards.length}
          </span>
          <button
            type="button"
            onClick={() => irPara(atual + 1)}
            disabled={atual === cards.length - 1}
            aria-label="Próximo culto"
            className="p-1.5 rounded-full hover:bg-[hsl(var(--border))]/50 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {cards.map((c, idx) => {
          const ehHoje = c.dataKey === hojeKey;
          const passou = !!hojeKey && c.dataKey < hojeKey;
          const ehProximo = !ehHoje && idx === indiceProximo;
          return (
            <article
              key={c.chave}
              aria-label={`${c.titulo}, ${c.data.toLocaleDateString("pt-BR")}`}
              className="w-full shrink-0 snap-center snap-always px-1"
            >
              <div
                className={`rounded-2xl border bg-[hsl(var(--card))] shadow-sm ${
                  ehHoje ? "border-[hsl(var(--accent))]" : "border-[hsl(var(--border))]"
                } ${passou ? "opacity-80" : ""}`}
              >
                <header className="p-4 border-b border-[hsl(var(--border))]">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{c.titulo}</h3>
                    {ehHoje && <Badge className="bg-sky-500/10 text-sky-600">Hoje</Badge>}
                    {ehProximo && <Badge className="bg-emerald-500/10 text-emerald-600">Próximo culto</Badge>}
                    {passou && <Badge className="bg-slate-400/15 text-[hsl(var(--muted))]">Já passou</Badge>}
                    {c.solo && <Badge className="bg-amber-400/10 text-amber-600">Solo</Badge>}
                  </div>
                  <p className="text-sm text-[hsl(var(--muted))] mt-0.5 capitalize">
                    {c.data.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </header>

                {c.linhas.length === 0 ? (
                  <p className="p-6 text-center text-sm text-[hsl(var(--muted))]">
                    Ninguém escalado neste culto.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-4 p-4">
                    {c.linhas.map((l, i) => (
                      <li
                        key={l.chave}
                        // zigue-zague: uma pessoa por linha — 1ª à esquerda, 2ª à direita, 3ª à esquerda...
                        style={{ gridRow: i + 1, gridColumn: i % 2 === 0 ? 1 : 2 }}
                        className="flex items-center gap-2.5 min-w-0"
                      >
                        <Foto nome={l.nome} foto={l.foto} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[17px] font-semibold leading-tight break-words">{l.nome}</p>
                            {l.aniversario && (
                              <button
                                type="button"
                                onClick={() => setFesta({ nome: l.nome, diaMes: l.aniversario! })}
                                aria-label={`Aniversário de ${l.nome} em ${l.aniversario}. Toque para parabenizar`}
                                title="Aniversariante do mês — toque para parabenizar"
                                className="h-8 w-8 shrink-0 rounded-full bg-[hsl(var(--accent))]/15 text-lg leading-none flex items-center justify-center transition-transform active:scale-90 hover:scale-110"
                              >
                                🎂
                              </button>
                            )}
                          </div>
                          <div className="mt-0.5 text-[15px] leading-snug text-[hsl(var(--muted))] break-words">
                            {l.instrumentos.map((inst) => (
                              <p key={inst.id}>
                                {inst.emoji} {inst.nome}
                              </p>
                            ))}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {festa && (
        <EfeitoAniversario nome={festa.nome} diaMes={festa.diaMes} onFechar={() => setFesta(null)} />
      )}
    </div>
  );
}

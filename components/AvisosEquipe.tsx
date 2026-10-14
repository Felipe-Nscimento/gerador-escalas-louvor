"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { gerarUuid } from "@/lib/formularios";
import {
  AvisoEquipe,
  dataISO,
  situacaoDoAviso,
  TipoAviso,
  TIPOS_AVISO,
} from "@/lib/extrasEscalaRemoto";

interface Props {
  avisos: AvisoEquipe[];
  /** Só passa para Líder e Montador: permite criar, editar e excluir avisos. */
  edicao?: {
    salvar: (a: AvisoEquipe) => Promise<void>;
    excluir: (id: string) => Promise<void>;
  };
}

const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function dataLocal(iso: string): Date {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

function emojiDoTipo(tipo: TipoAviso): string {
  return TIPOS_AVISO.find((t) => t.id === tipo)?.emoji ?? "📌";
}

/**
 * Avisos de atividades extra culto (reunião, confraternização, estudo...), abaixo da escala.
 * Cada aviso aparece durante o mês do evento e some depois da data. Líder e Montador também
 * veem os avisos de meses futuros (marcados como "agendado") para poderem editá-los.
 */
export function AvisosEquipe({ avisos, edicao }: Props) {
  // a data é lida no navegador, depois de montar, para não divergir do HTML pré-renderizado
  const [hoje, setHoje] = useState<Date | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [tipo, setTipo] = useState<TipoAviso>("reuniao");
  const [titulo, setTitulo] = useState("");
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [local, setLocal] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setHoje(new Date());
  }, []);

  const { visiveis, agendados } = useMemo(() => {
    const ordenar = (a: AvisoEquipe, b: AvisoEquipe) =>
      a.data.localeCompare(b.data) || (a.horario ?? "99:99").localeCompare(b.horario ?? "99:99");
    const v: AvisoEquipe[] = [];
    const ag: AvisoEquipe[] = [];
    if (hoje) {
      for (const a of avisos) {
        const s = situacaoDoAviso(a.data, hoje);
        if (s === "visivel") v.push(a);
        else if (s === "agendado") ag.push(a);
      }
    }
    return { visiveis: v.sort(ordenar), agendados: ag.sort(ordenar) };
  }, [avisos, hoje]);

  if (!hoje) return null;
  if (!edicao && visiveis.length === 0) return null; // integrantes: sem aviso, não mostra nada

  const hojeKey = dataISO(hoje);

  function novo() {
    setIdEditando(null);
    setTipo("reuniao");
    setTitulo("");
    setData("");
    setHorario("");
    setLocal("");
    setErro(null);
    setFormAberto(true);
  }

  function editar(a: AvisoEquipe) {
    setIdEditando(a.id);
    setTipo(a.tipo);
    setTitulo(a.titulo);
    setData(a.data.slice(0, 10));
    setHorario(a.horario ?? "");
    setLocal(a.local ?? "");
    setErro(null);
    setFormAberto(true);
  }

  async function salvar() {
    if (!titulo.trim()) return setErro("Informe o título do aviso.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro("Informe a data do evento.");
    if (data < hojeKey) return setErro("A data não pode ser anterior a hoje.");
    setSalvando(true);
    setErro(null);
    try {
      await edicao!.salvar({
        id: idEditando ?? gerarUuid(),
        tipo,
        titulo: titulo.trim(),
        data,
        horario: horario || null,
        local: local.trim() || null,
      });
      setFormAberto(false);
    } catch {
      setErro("Não foi possível salvar agora. Confira a conexão e tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(a: AvisoEquipe) {
    if (!window.confirm(`Excluir o aviso "${a.titulo}"?`)) return;
    try {
      await edicao!.excluir(a.id);
    } catch {
      window.alert("Não foi possível excluir agora. Tente de novo.");
    }
  }

  function linha(a: AvisoEquipe, agendado: boolean) {
    const d = dataLocal(a.data);
    const ehHoje = a.data.slice(0, 10) === hojeKey;
    return (
      <li key={a.id} className="flex items-start gap-3 py-3">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-[hsl(var(--accent))]/15 flex items-center justify-center text-xl">
          {emojiDoTipo(a.tipo)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight break-words">
            {a.titulo}
            {ehHoje && (
              <span className="ml-2 align-middle rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600">
                Hoje
              </span>
            )}
            {agendado && (
              <span className="ml-2 align-middle rounded-full bg-slate-400/15 px-2 py-0.5 text-[11px] font-semibold text-[hsl(var(--muted))]">
                Aparece em {NOMES_MESES[d.getMonth()]}
              </span>
            )}
          </p>
          <p className="text-sm text-[hsl(var(--muted))] capitalize">
            {d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
            {a.horario ? ` às ${a.horario.slice(0, 5)}` : ""}
          </p>
          {a.local && <p className="text-sm text-[hsl(var(--muted))] break-words">📍 {a.local}</p>}
        </div>
        {edicao && (
          <div className="flex shrink-0">
            <button
              type="button"
              onClick={() => editar(a)}
              aria-label={`Editar ${a.titulo}`}
              className="p-2 rounded-lg text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/40"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => excluir(a)}
              aria-label={`Excluir ${a.titulo}`}
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <section
      aria-label="Avisos"
      className="no-print rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="h-5 w-5 text-[hsl(var(--accent))]" /> Avisos
        </h2>
        {edicao && !formAberto && (
          <button
            type="button"
            onClick={novo}
            className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--primary))] px-4 py-1.5 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" /> Novo aviso
          </button>
        )}
      </div>

      {edicao && formAberto && (
        <div className="mt-3 space-y-3 rounded-xl border border-[hsl(var(--border))] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="aviso-tipo">
                Tipo
              </label>
              <select
                id="aviso-tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoAviso)}
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm"
              >
                {TIPOS_AVISO.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="aviso-data">
                Data do evento
              </label>
              <Input id="aviso-data" type="date" value={data} min={hojeKey} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="aviso-titulo">
              Título
            </label>
            <Input
              id="aviso-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Reunião do ministério de louvor"
              maxLength={80}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="aviso-horario">
                Horário (opcional)
              </label>
              <Input id="aviso-horario" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-[hsl(var(--muted))]" htmlFor="aviso-local">
                Local ou detalhe (opcional)
              </label>
              <Input
                id="aviso-local"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="Ex.: Salão da igreja"
                maxLength={200}
              />
            </div>
          </div>
          {erro && (
            <p role="alert" className="text-sm text-red-500">
              {erro}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {salvando ? "Salvando…" : idEditando ? "Salvar alterações" : "Publicar aviso"}
            </button>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              disabled={salvando}
              className="rounded-full border border-[hsl(var(--border))] px-5 py-2 text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {visiveis.length === 0 && (
        <p className="mt-3 text-sm text-[hsl(var(--muted))]">Nenhum aviso para este mês.</p>
      )}
      {visiveis.length > 0 && (
        <ul className="mt-1 divide-y divide-[hsl(var(--border))]">{visiveis.map((a) => linha(a, false))}</ul>
      )}

      {edicao && agendados.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted))]">
            Agendados (ainda não aparecem para a equipe)
          </p>
          <ul className="divide-y divide-[hsl(var(--border))]">{agendados.map((a) => linha(a, true))}</ul>
        </div>
      )}
    </section>
  );
}

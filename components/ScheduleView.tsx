"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dices,
  RotateCcw,
  Copy,
  Save,
  FileDown,
  Sparkles,
  Check,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldCheck,
  Clock,
  X,
  Send,
  Lock,
  Undo2,
  Undo,
  CloudOff,
  UserRound,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Select } from "./ui/Select";
import { Input } from "./ui/Input";
import {
  ConfiguracaoEscala,
  Escalacao,
  EscalaSalva,
  Instrumento,
  Integrante,
  PayloadEscala,
  RascunhoAtual,
  STATUS_LABEL,
} from "@/lib/types";
import {
  calcularEstatisticas,
  criarCultoExtra,
  gerarEscala,
  gerarOutraEscala,
  unificarItens,
  validarEscala,
} from "@/lib/scheduleGenerator";
import { gerarTextoWhatsApp, MESES, nomeDiaSemana } from "@/lib/whatsapp";
import { uid } from "@/lib/storage";
import {
  atualizarEscalaRemota,
  criarEscalaRemota,
  EscalaRemota,
} from "@/lib/escalasRemoto";
import { useAuth } from "@/lib/useAuth";

/** Iniciais do nome, para o avatar placeholder (o projeto não tem foto cadastrada). */
function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function AvatarPlaceholder({ nome, vazio }: { nome: string; vazio?: boolean }) {
  if (vazio) {
    return (
      <span className="h-7 w-7 rounded-full bg-[hsl(var(--border))]/60 flex items-center justify-center shrink-0">
        <UserRound className="h-3.5 w-3.5 text-[hsl(var(--muted))]" />
      </span>
    );
  }
  return (
    <span className="h-7 w-7 rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] flex items-center justify-center text-[10px] font-semibold shrink-0">
      {iniciaisDoNome(nome)}
    </span>
  );
}

/** Cor suave por grupo de função (vocal x instrumento), sem depender de nenhum campo novo no cadastro. */
function corDaFuncao(nomeInstrumento: string): string {
  const n = nomeInstrumento.toLowerCase();
  const ehVoz = n.includes("voz") || n.includes("vocal") || n.includes("backing");
  return ehVoz ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-violet-50 dark:bg-violet-500/10";
}

interface Props {
  integrantes: Integrante[];
  instrumentos: Instrumento[];
  config: ConfiguracaoEscala;
  setConfig: (fn: (prev: ConfiguracaoEscala) => ConfiguracaoEscala) => void;
  historico: EscalaSalva[];
  setHistorico: (fn: (prev: EscalaSalva[]) => EscalaSalva[]) => void;
  rascunho: RascunhoAtual;
  setRascunho: (
    fn: RascunhoAtual | ((prev: RascunhoAtual) => RascunhoAtual)
  ) => void;
  remotas: EscalaRemota[];
  auth: ReturnType<typeof useAuth>;
}

export function ScheduleView({
  integrantes,
  instrumentos,
  config,
  setConfig,
  historico,
  setHistorico,
  rascunho,
  setRascunho,
  remotas,
  auth,
}: Props) {
  const [copiado, setCopiado] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [mostrarFormExtra, setMostrarFormExtra] = useState(false);
  const [novaDataExtra, setNovaDataExtra] = useState("");
  const [novoTituloExtra, setNovoTituloExtra] = useState("");

  const { domingos, domingosOriginais, cultosExtras, escalaAtualId, origemRemota } =
    rascunho;

  const remotaVinculada =
    origemRemota && escalaAtualId
      ? remotas.find((r) => r.id === escalaAtualId) ?? null
      : null;
  const localVinculada =
    !origemRemota && escalaAtualId
      ? historico.find((e) => e.id === escalaAtualId) ?? null
      : null;

  const statusAtual = remotaVinculada?.status ?? localVinculada?.status ?? null;
  const motivoDevolucao =
    remotaVinculada?.motivo_devolucao ?? localVinculada?.motivoDevolucao ?? null;

  const souOLider = auth.ehLider;
  const souOAutor = remotaVinculada ? remotaVinculada.created_by === auth.userId : true;
  const bloqueado = remotaVinculada
    ? statusAtual === "aprovada" && !souOLider
    : statusAtual === "aprovada";

  // quando a escala foi carregada de uma linha remota, usamos o "retrato" de
  // integrantes/instrumentos salvo junto — o líder pode estar num aparelho
  // sem esses cadastros locais.
  const integrantesEfetivos = remotaVinculada?.payload?.integrantes ?? integrantes;
  const instrumentosEfetivos = remotaVinculada?.payload?.instrumentos ?? instrumentos;

  const alertas = useMemo(
    () =>
      domingos
        ? validarEscala(domingos, integrantesEfetivos, instrumentosEfetivos, cultosExtras)
        : [],
    [domingos, integrantesEfetivos, instrumentosEfetivos, cultosExtras]
  );
  const estatisticas = useMemo(
    () =>
      domingos
        ? calcularEstatisticas(domingos, integrantesEfetivos, cultosExtras)
        : [],
    [domingos, integrantesEfetivos, cultosExtras]
  );
  const media = estatisticas.length
    ? estatisticas.reduce((a, b) => a + b.participacoes, 0) / estatisticas.length
    : 0;
  const maxParticipacao = Math.max(1, ...estatisticas.map((e) => e.participacoes));

  const listaUnificada = useMemo(
    () => (domingos ? unificarItens(domingos, cultosExtras) : []),
    [domingos, cultosExtras]
  );

  useEffect(() => {
    setErroEnvio(null);
  }, [escalaAtualId, statusAtual]);

  function gerar() {
    const nova = gerarEscala(integrantes, instrumentos, config, historico);
    setRascunho({
      escalaAtualId: null,
      origemRemota: false,
      domingos: nova,
      domingosOriginais: nova,
      cultosExtras: [],
    });
    setSalvo(false);
  }

  function gerarOutra() {
    if (bloqueado) return;
    const nova = gerarOutraEscala(integrantes, instrumentos, config, historico);
    setRascunho((r) => ({
      ...r,
      escalaAtualId: null,
      origemRemota: false,
      domingos: nova,
      domingosOriginais: nova,
    }));
    setSalvo(false);
  }

  function restaurar() {
    if (bloqueado) return;
    setRascunho((r) =>
      r.domingosOriginais ? { ...r, domingos: r.domingosOriginais } : r
    );
  }

  function atualizarEscalacaoItem(
    itemId: string,
    updater: (e: Escalacao) => Escalacao
  ) {
    if (bloqueado) return;
    setRascunho((r) => {
      if (!r.domingos) return r;
      const domIndex = r.domingos.findIndex((d) => d.data === itemId);
      if (domIndex >= 0) {
        const copia = r.domingos.map((d, i) =>
          i === domIndex ? { ...d, escalacao: updater(d.escalacao) } : d
        );
        return { ...r, domingos: copia };
      }
      const extraIndex = r.cultosExtras.findIndex((c) => c.id === itemId);
      if (extraIndex >= 0) {
        const copia = r.cultosExtras.map((c, i) =>
          i === extraIndex ? { ...c, escalacao: updater(c.escalacao) } : c
        );
        return { ...r, cultosExtras: copia };
      }
      return r;
    });
  }

  function setSlot(itemId: string, instId: string, idx: number, valor: string) {
    atualizarEscalacaoItem(itemId, (e) => {
      const arr = [...(e.atribuicoes[instId] ?? [])];
      arr[idx] = valor;
      return { ...e, atribuicoes: { ...e.atribuicoes, [instId]: arr } };
    });
  }

  function addSlot(itemId: string, instId: string) {
    atualizarEscalacaoItem(itemId, (e) => ({
      ...e,
      atribuicoes: {
        ...e.atribuicoes,
        [instId]: [...(e.atribuicoes[instId] ?? []), ""],
      },
    }));
  }

  function removeSlot(itemId: string, instId: string, idx: number) {
    atualizarEscalacaoItem(itemId, (e) => ({
      ...e,
      atribuicoes: {
        ...e.atribuicoes,
        [instId]: (e.atribuicoes[instId] ?? []).filter((_, i) => i !== idx),
      },
    }));
  }

  function adicionarCultoExtra() {
    if (bloqueado || !novaDataExtra) return;
    const iso = new Date(`${novaDataExtra}T12:00:00`).toISOString();
    const novo = criarCultoExtra(iso, novoTituloExtra.trim() || "Culto extra");
    setRascunho((r) => ({
      ...r,
      domingos: r.domingos ?? [],
      cultosExtras: [...r.cultosExtras, novo].sort(
        (a, b) => new Date(a.data).getTime() - new Date(b.data).getTime()
      ),
    }));
    setNovaDataExtra("");
    setNovoTituloExtra("");
    setMostrarFormExtra(false);
  }

  function removerCultoExtra(id: string) {
    if (bloqueado) return;
    setRascunho((r) => ({
      ...r,
      cultosExtras: r.cultosExtras.filter((c) => c.id !== id),
    }));
  }

  function montarPayload(): PayloadEscala | null {
    if (!domingos) return null;
    return {
      config,
      domingos,
      cultosExtras,
      escalacaoOriginal: domingosOriginais ?? undefined,
      integrantes: integrantesEfetivos,
      instrumentos: instrumentosEfetivos,
    };
  }

  // ---------- Fluxo local (sem nuvem, um só aparelho) ----------

  function salvarLocal() {
    if (!domingos) return;
    const agora = new Date().toISOString();
    if (escalaAtualId && !origemRemota && historico.some((e) => e.id === escalaAtualId)) {
      setHistorico((prev) =>
        prev.map((e) =>
          e.id === escalaAtualId
            ? {
                ...e,
                config,
                domingos,
                cultosExtras,
                escalacaoOriginal: domingosOriginais ?? e.escalacaoOriginal,
                atualizadoEm: agora,
              }
            : e
        )
      );
    } else {
      const novoId = uid();
      const escala: EscalaSalva = {
        id: novoId,
        criadoEm: agora,
        config,
        domingos,
        cultosExtras,
        escalacaoOriginal: domingosOriginais ?? undefined,
        status: "rascunho",
      };
      setHistorico((prev) => [...prev, escala]);
      setRascunho((r) => ({ ...r, escalaAtualId: novoId, origemRemota: false }));
    }
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function aprovarLocal() {
    if (!escalaAtualId || origemRemota) return;
    setHistorico((prev) =>
      prev.map((e) =>
        e.id === escalaAtualId
          ? { ...e, status: "aprovada", atualizadoEm: new Date().toISOString() }
          : e
      )
    );
  }

  function cancelarAprovacaoLocal() {
    if (!escalaAtualId || origemRemota) return;
    setHistorico((prev) =>
      prev.map((e) =>
        e.id === escalaAtualId
          ? {
              ...e,
              status: "aguardando_aprovacao",
              atualizadoEm: new Date().toISOString(),
            }
          : e
      )
    );
  }

  // ---------- Fluxo remoto (Supabase) ----------

  async function enviarParaLider() {
    const payload = montarPayload();
    if (!payload || !auth.userId) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      if (origemRemota && escalaAtualId) {
        const novoStatus = statusAtual === "devolvida" ? "aguardando_aprovacao" : "aguardando_aprovacao";
        await atualizarEscalaRemota(escalaAtualId, { payload, status: novoStatus });
      } else {
        const linha = await criarEscalaRemota(payload, auth.userId);
        if (escalaAtualId) {
          setHistorico((prev) => prev.filter((e) => e.id !== escalaAtualId));
        }
        setRascunho((r) => ({ ...r, escalaAtualId: linha.id, origemRemota: true }));
      }
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function aprovarRemoto() {
    const payload = montarPayload();
    if (!payload || !escalaAtualId || !souOLider) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await atualizarEscalaRemota(escalaAtualId, {
        payload,
        status: "aprovada",
        approved_by: auth.userId,
        approved_at: new Date().toISOString(),
      });
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível aprovar.");
    } finally {
      setEnviando(false);
    }
  }

  async function devolverRemoto() {
    if (!escalaAtualId || !souOLider) return;
    const motivo = window.prompt(
      "O que precisa ser ajustado? (o montador vai ver esse texto)"
    );
    if (motivo === null) return;
    const payload = montarPayload();
    setEnviando(true);
    setErroEnvio(null);
    try {
      await atualizarEscalaRemota(escalaAtualId, {
        ...(payload ? { payload } : {}),
        status: "devolvida",
        motivo_devolucao: motivo,
      });
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível devolver.");
    } finally {
      setEnviando(false);
    }
  }

  async function cancelarAprovacaoRemota() {
    if (!escalaAtualId || !souOLider) return;
    setEnviando(true);
    setErroEnvio(null);
    try {
      await atualizarEscalaRemota(escalaAtualId, {
        status: "aguardando_aprovacao",
        approved_by: null,
        approved_at: null,
      });
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Não foi possível cancelar.");
    } finally {
      setEnviando(false);
    }
  }

  async function marcarPublicada() {
    if (!escalaAtualId || !origemRemota) return;
    try {
      await atualizarEscalaRemota(escalaAtualId, { status: "publicada" });
    } catch {
      // não crítico — a cópia pro WhatsApp já aconteceu de qualquer forma
    }
  }

  function copiarWhatsApp() {
    if (!domingos || statusAtual !== "aprovada") return;
    const texto = gerarTextoWhatsApp(
      domingos,
      integrantesEfetivos,
      instrumentosEfetivos,
      config.mes,
      config.ano,
      cultosExtras
    );
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      if (origemRemota) marcarPublicada();
    });
  }

  function exportarPDF() {
    window.print();
  }

  const candidatosPorFuncao = (instId: string) =>
    integrantesEfetivos.filter((i) => i.funcoes.includes(instId));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Escala</h2>
          <p className="text-sm text-[hsl(var(--muted))]">
            {MESES[config.mes - 1]}/{config.ano}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap no-print">
          {domingos && (
            <Button variant="secondary" onClick={gerarOutra} disabled={bloqueado}>
              <Sparkles className="h-4 w-4" /> Surpreenda-me
            </Button>
          )}
          {domingos && domingosOriginais && (
            <Button variant="secondary" onClick={restaurar} disabled={bloqueado}>
              <RotateCcw className="h-4 w-4" /> Restaurar original
            </Button>
          )}
          <Button onClick={gerar} disabled={integrantes.length === 0}>
            <Dices className="h-4 w-4" /> Gerar escala
          </Button>
        </div>
      </div>

      {integrantes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-[hsl(var(--muted))]">
            Cadastre ao menos um integrante antes de gerar a escala.
          </CardContent>
        </Card>
      )}

      {domingos && (
        <>
          {/* Status de aprovação */}
          <Card
            className={`no-print ${
              statusAtual === "aprovada"
                ? "border-emerald-500/40"
                : statusAtual === "devolvida"
                ? "border-red-400/40"
                : "border-amber-400/40"
            }`}
          >
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  {statusAtual === "aprovada" ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-500" />
                  )}
                  <div>
                    <p className="text-sm font-medium">
                      {escalaAtualId
                        ? STATUS_LABEL[statusAtual ?? "rascunho"]
                        : "Ainda não salva"}
                      {origemRemota && (
                        <span className="ml-1.5 text-xs text-[hsl(var(--muted))]">
                          (remota{souOLider ? " — você é o líder" : ""})
                        </span>
                      )}
                    </p>
                    {motivoDevolucao && statusAtual === "devolvida" && (
                      <p className="text-xs text-red-500">
                        Motivo: {motivoDevolucao}
                      </p>
                    )}
                    {!motivoDevolucao && (
                      <p className="text-xs text-[hsl(var(--muted))]">
                        {!escalaAtualId && "Salve a escala para poder enviá-la."}
                        {escalaAtualId &&
                          statusAtual === "rascunho" &&
                          "Ainda é só um rascunho local."}
                        {escalaAtualId &&
                          statusAtual === "aguardando_aprovacao" &&
                          "Esperando o líder revisar."}
                        {escalaAtualId &&
                          statusAtual === "aprovada" &&
                          "Liberada — já pode copiar e enviar no WhatsApp."}
                        {escalaAtualId &&
                          statusAtual === "publicada" &&
                          "Já foi copiada e enviada."}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {/* Ações locais (sem nuvem) */}
                  {escalaAtualId &&
                    !origemRemota &&
                    statusAtual !== "aprovada" && (
                      <Button size="sm" variant="secondary" onClick={aprovarLocal}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Aprovar aqui
                      </Button>
                    )}
                  {escalaAtualId && !origemRemota && statusAtual === "aprovada" && (
                    <Button size="sm" variant="secondary" onClick={cancelarAprovacaoLocal}>
                      <Undo2 className="h-3.5 w-3.5" /> Cancelar aprovação
                    </Button>
                  )}

                  {/* Ações remotas (Supabase) */}
                  {auth.supabaseConfigurado &&
                    auth.logado &&
                    statusAtual !== "aprovada" &&
                    statusAtual !== "publicada" && (
                      <Button size="sm" onClick={enviarParaLider} disabled={enviando}>
                        <Send className="h-3.5 w-3.5" />{" "}
                        {origemRemota ? "Reenviar" : "Enviar para o líder"}
                      </Button>
                    )}
                  {origemRemota &&
                    souOLider &&
                    (statusAtual === "aguardando_aprovacao" ||
                      statusAtual === "devolvida") && (
                      <>
                        <Button size="sm" variant="secondary" onClick={devolverRemoto} disabled={enviando}>
                          <Undo className="h-3.5 w-3.5" /> Devolver
                        </Button>
                        <Button size="sm" onClick={aprovarRemoto} disabled={enviando}>
                          <ShieldCheck className="h-3.5 w-3.5" /> Aprovar
                        </Button>
                      </>
                    )}
                  {origemRemota && souOLider && statusAtual === "aprovada" && (
                    <Button size="sm" variant="secondary" onClick={cancelarAprovacaoRemota} disabled={enviando}>
                      <Undo2 className="h-3.5 w-3.5" /> Cancelar aprovação
                    </Button>
                  )}
                </div>
              </div>
              {erroEnvio && <p className="text-sm text-red-500">{erroEnvio}</p>}
              {!auth.supabaseConfigurado && (
                <p className="text-xs text-[hsl(var(--muted))] flex items-center gap-1.5">
                  <CloudOff className="h-3.5 w-3.5" /> Aprovação remota desligada —
                  configure o Supabase para o líder aprovar de outro aparelho (veja o
                  README).
                </p>
              )}
              {auth.supabaseConfigurado && !auth.logado && (
                <p className="text-xs text-[hsl(var(--muted))]">
                  Entre com sua conta na aba Histórico para enviar esta escala ao líder.
                </p>
              )}
            </CardContent>
          </Card>

          {bloqueado && (
            <div className="no-print flex items-center gap-2 text-xs text-[hsl(var(--muted))] px-1">
              <Lock className="h-3.5 w-3.5" /> Escala aprovada: edição bloqueada
              {origemRemota ? " (só o líder pode alterar ou cancelar)." : " até cancelar a aprovação."}
            </div>
          )}

          <div id="print-area" className="space-y-3">
            <h1 className="hidden print:block text-xl font-bold mb-4">
              Escala do Grupo de Louvor – {MESES[config.mes - 1]}/{config.ano}
            </h1>

            {/* Layout usado só na impressão/PDF — inalterado, um bloco por dia */}
            <div className="hidden print:block space-y-3">
              {listaUnificada.map((item) => {
                const data = new Date(item.data);
                const ehExtra = !item.rotulo.startsWith("Domingo");
                return (
                  <div
                    key={item.id}
                    className="border border-[hsl(var(--border))] rounded-xl p-4"
                  >
                    <p className="font-medium mb-1">
                      {data.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                      })}{" "}
                      {ehExtra
                        ? `— ${item.rotulo} (${nomeDiaSemana(data)})`
                        : "(Domingo)"}
                      {item.escalacao.solo && " · Solo"}
                    </p>
                    {item.escalacao.solo ? (
                      <p className="text-sm">
                        🎤🎸{" "}
                        {integrantesEfetivos.find(
                          (i) => i.id === item.escalacao.atribuicoes["violao"]?.[0]
                        )?.nome ?? "-"}{" "}
                        (voz e violão, sozinho)
                      </p>
                    ) : (
                      <div className="text-sm space-y-0.5">
                        {instrumentosEfetivos.map((inst) =>
                          (item.escalacao.atribuicoes[inst.id] ?? []).map((id) => (
                            <p key={`${inst.id}-${id}`}>
                              {inst.emoji}{" "}
                              {integrantesEfetivos.find((i) => i.id === id)?.nome}
                            </p>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tabela interativa (tela): colunas = datas, linhas = funções */}
            <div className="no-print rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-b border-[hsl(var(--border))] bg-[hsl(var(--card))] text-xs text-[hsl(var(--muted))]">
                {(
                  [
                    ["rascunho", "bg-slate-400"],
                    ["aguardando_aprovacao", "bg-amber-400"],
                    ["devolvida", "bg-red-400"],
                    ["aprovada", "bg-emerald-500"],
                    ["publicada", "bg-blue-400"],
                  ] as const
                ).map(([chave, cor]) => (
                  <span key={chave} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${cor}`} />
                    {STATUS_LABEL[chave]}
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-[hsl(var(--card))] text-left px-4 py-3 min-w-[140px] border-b border-r border-[hsl(var(--border))]">
                        Funções
                      </th>
                      {listaUnificada.map((item) => {
                        const data = new Date(item.data);
                        const ehExtra = !item.rotulo.startsWith("Domingo");
                        return (
                          <th
                            key={item.id}
                            className="px-4 py-3 min-w-[170px] text-left align-top border-b border-[hsl(var(--border))] bg-[hsl(var(--primary))]/5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-[hsl(var(--primary))] whitespace-nowrap">
                                  {nomeDiaSemana(data)},{" "}
                                  {data.toLocaleDateString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                  })}
                                </p>
                                <p className="text-xs font-normal text-[hsl(var(--muted))]">
                                  {ehExtra ? item.rotulo : "Culto domingo"}
                                  {item.escalacao.solo && " · Solo"}
                                </p>
                              </div>
                              {ehExtra && !bloqueado && (
                                <button
                                  onClick={() => removerCultoExtra(item.id)}
                                  className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 shrink-0"
                                  aria-label="Remover culto extra"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {instrumentosEfetivos.map((inst, rowIdx) => (
                      <tr
                        key={inst.id}
                        className={
                          rowIdx % 2 === 0
                            ? "bg-[hsl(var(--card))]"
                            : "bg-[hsl(var(--background))]"
                        }
                      >
                        <td
                          className={`sticky left-0 z-10 px-4 py-3 font-medium align-top border-r border-b border-[hsl(var(--border))] ${corDaFuncao(
                            inst.nome
                          )}`}
                        >
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            {inst.emoji} {inst.nome}
                          </span>
                        </td>
                        {listaUnificada.map((item) => {
                          const solo = item.escalacao.solo;
                          const slots = item.escalacao.atribuicoes[inst.id] ?? [];
                          const usadosNoInstrumento = new Set(slots);
                          return (
                            <td
                              key={item.id}
                              className="px-3 py-2.5 align-top border-b border-[hsl(var(--border))] min-w-[170px]"
                            >
                              {solo && slots.length === 0 ? (
                                <span className="text-xs text-[hsl(var(--muted))]">—</span>
                              ) : (
                                <div className="space-y-1.5">
                                  {slots.length === 0 && (
                                    <button
                                      onClick={() => addSlot(item.id, inst.id)}
                                      disabled={bloqueado}
                                      className="w-full flex items-center gap-2 rounded-xl border border-dashed border-[hsl(var(--border))] px-2.5 py-1.5 text-left hover:bg-[hsl(var(--border))]/30 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      <AvatarPlaceholder nome="" vazio />
                                      <span className="text-xs text-[hsl(var(--muted))]">
                                        Sem voluntário
                                      </span>
                                    </button>
                                  )}
                                  {slots.map((valor, idx) => {
                                    const pessoa = integrantesEfetivos.find(
                                      (i) => i.id === valor
                                    );
                                    return (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        <AvatarPlaceholder
                                          nome={pessoa?.nome ?? ""}
                                          vazio={!valor}
                                        />
                                        <Select
                                          value={valor}
                                          disabled={bloqueado}
                                          onChange={(e) =>
                                            setSlot(item.id, inst.id, idx, e.target.value)
                                          }
                                          className="text-xs py-1.5 pr-7"
                                        >
                                          <option value="">— ninguém —</option>
                                          {candidatosPorFuncao(inst.id)
                                            .filter(
                                              (p) =>
                                                p.id === valor ||
                                                !usadosNoInstrumento.has(p.id)
                                            )
                                            .map((p) => (
                                              <option key={p.id} value={p.id}>
                                                {p.nome}
                                              </option>
                                            ))}
                                        </Select>
                                        {!bloqueado && (
                                          <button
                                            onClick={() => removeSlot(item.id, inst.id, idx)}
                                            className="p-1 rounded-lg hover:bg-red-500/10 text-red-500 shrink-0"
                                            aria-label="Remover"
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {!bloqueado && slots.length > 0 && (
                                    <button
                                      onClick={() => addSlot(item.id, inst.id)}
                                      className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1 pl-1"
                                    >
                                      <Plus className="h-3 w-3" /> adicionar
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Adicionar culto extra */}
          {!bloqueado && (
            <div className="no-print">
              {mostrarFormExtra ? (
                <Card>
                  <CardContent className="pt-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-sm">Novo culto extra</h3>
                      <button onClick={() => setMostrarFormExtra(false)}>
                        <X className="h-4 w-4 opacity-60" />
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium mb-1 block">Data</label>
                        <Input
                          type="date"
                          value={novaDataExtra}
                          onChange={(e) => setNovaDataExtra(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium mb-1 block">
                          Título (opcional)
                        </label>
                        <Input
                          value={novoTituloExtra}
                          onChange={(e) => setNovoTituloExtra(e.target.value)}
                          placeholder="Ex: Culto de oração, Vigília"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={adicionarCultoExtra}
                      disabled={!novaDataExtra}
                      className="w-full"
                    >
                      Adicionar culto
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Button variant="secondary" onClick={() => setMostrarFormExtra(true)}>
                  <Plus className="h-4 w-4" /> Adicionar culto extra
                </Button>
              )}
            </div>
          )}

          {alertas.length > 0 && (
            <Card className="no-print border-amber-400/40">
              <CardContent className="pt-5 space-y-1.5">
                <p className="font-medium flex items-center gap-1.5 text-amber-500">
                  <AlertTriangle className="h-4 w-4" /> Avisos
                </p>
                {alertas.map((a, i) => (
                  <p key={i} className="text-sm text-[hsl(var(--muted))]">
                    {a.mensagem}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="no-print">
            <CardContent className="pt-5 space-y-2">
              <p className="font-medium mb-1">Participações</p>
              {estatisticas.map((e) => (
                <div key={e.id} className="flex items-center gap-3">
                  <span className="text-sm w-28 truncate">{e.nome}</span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(var(--border))]/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        e.participacoes > media
                          ? "bg-[hsl(var(--primary))]"
                          : "bg-[hsl(var(--border))]"
                      }`}
                      style={{
                        width: `${(e.participacoes / maxParticipacao) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm w-6 text-right">{e.participacoes}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex gap-2 flex-wrap no-print">
            <Button
              onClick={copiarWhatsApp}
              variant="secondary"
              disabled={statusAtual !== "aprovada"}
              title={statusAtual !== "aprovada" ? "Aguardando aprovação" : undefined}
            >
              {copiado ? (
                <>
                  <Check className="h-4 w-4" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Copiar para WhatsApp
                </>
              )}
            </Button>
            {!origemRemota && (
              <Button onClick={salvarLocal} variant="secondary">
                {salvo ? (
                  <>
                    <Check className="h-4 w-4" /> Salvo!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Salvar
                  </>
                )}
              </Button>
            )}
            <Button onClick={exportarPDF} variant="secondary">
              <FileDown className="h-4 w-4" /> Exportar PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

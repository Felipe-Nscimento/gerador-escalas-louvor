"use client";

import { useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  Users,
  Search,
  UserCheck,
  UserX,
  Camera,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import {
  DiaSemana,
  DIAS_SEMANA_LABEL,
  DisponibilidadeDia,
  EscalaSalva,
  Instrumento,
  Integrante,
  NIVEL_LABEL,
  NivelExperiencia,
  NivelPorFuncao,
} from "@/lib/types";
import { pessoasDoItem, unificarItens } from "@/lib/scheduleGenerator";
import { uid } from "@/lib/storage";

interface Props {
  integrantes: Integrante[];
  setIntegrantes: (fn: (prev: Integrante[]) => Integrante[]) => void;
  instrumentos: Instrumento[];
  historico?: EscalaSalva[];
}

type FiltroStatus = "ativos" | "inativos" | "todos";

function iniciaisDoNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Avatar({
  foto,
  nome,
  tamanho = 40,
}: {
  foto?: string;
  nome: string;
  tamanho?: number;
}) {
  const estilo = { width: tamanho, height: tamanho };
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={foto}
        alt={nome}
        style={estilo}
        className="rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <span
      style={estilo}
      className="rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] flex items-center justify-center text-xs font-semibold shrink-0"
    >
      {iniciaisDoNome(nome)}
    </span>
  );
}

/** Lê o arquivo, recorta em quadrado e reduz — mantém as fotos pequenas (cabem bem no LocalStorage e em qualquer payload enviado para a nuvem). */
function redimensionarImagem(file: File, tamanho = 240): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas indisponível."));
          return;
        }
        const lado = Math.min(img.width, img.height);
        const sx = (img.width - lado) / 2;
        const sy = (img.height - lado) / 2;
        ctx.drawImage(img, sx, sy, lado, lado, 0, 0, tamanho, tamanho);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TELEFONE_REGEX = /^[0-9()+\-\s]{8,}$/;

export function MembersManager({
  integrantes,
  setIntegrantes,
  instrumentos,
  historico = [],
}: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);

  const [nome, setNome] = useState("");
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [foto, setFoto] = useState<string | undefined>(undefined);
  const [ativo, setAtivo] = useState(true);
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [niveis, setNiveis] = useState<Record<string, NivelExperiencia>>({});
  const [observacoes, setObservacoes] = useState("");
  const [dispo, setDispo] = useState<DisponibilidadeDia[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("ativos");
  const [detalheId, setDetalheId] = useState<string | null>(null);

  function limparFormulario() {
    setNome("");
    setNomeExibicao("");
    setTelefone("");
    setEmail("");
    setFoto(undefined);
    setAtivo(true);
    setFuncoes([]);
    setNiveis({});
    setObservacoes("");
    setDispo([]);
    setErro(null);
  }

  function iniciarNovo() {
    setEditandoId(null);
    limparFormulario();
    setMostrarForm(true);
  }

  function iniciarEdicao(pessoa: Integrante) {
    setEditandoId(pessoa.id);
    setNome(pessoa.nome);
    setNomeExibicao(pessoa.nomeExibicao ?? "");
    setTelefone(pessoa.telefone ?? "");
    setEmail(pessoa.email ?? "");
    setFoto(pessoa.foto);
    setAtivo(pessoa.ativo ?? true);
    setFuncoes(pessoa.funcoes);
    setNiveis(
      Object.fromEntries((pessoa.niveis ?? []).map((n) => [n.instrumentoId, n.nivel]))
    );
    setObservacoes(pessoa.observacoesMusicais ?? "");
    setDispo(pessoa.disponibilidade?.dias ?? []);
    setErro(null);
    setMostrarForm(true);
  }

  function alternarFuncao(id: string) {
    setFuncoes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function definirStatusDia(dia: DiaSemana, status: "disponivel" | "indisponivel") {
    setDispo((prev) => {
      const semEsse = prev.filter((d) => d.dia !== dia);
      if (status === "indisponivel") {
        return [...semEsse, { dia, status, diaTodo: false, periodos: [] }];
      }
      const existente = prev.find((d) => d.dia === dia);
      return [
        ...semEsse,
        existente && existente.status === "disponivel"
          ? existente
          : { dia, status: "disponivel" as const, diaTodo: true, periodos: [] },
      ];
    });
  }

  function marcarNaoInformado(dia: DiaSemana) {
    setDispo((prev) => prev.filter((d) => d.dia !== dia));
  }

  function alternarDiaTodo(dia: DiaSemana) {
    setDispo((prev) =>
      prev.map((d) => {
        if (d.dia !== dia) return d;
        const diaTodo = !d.diaTodo;
        return {
          ...d,
          diaTodo,
          periodos: diaTodo ? [] : d.periodos.length ? d.periodos : [{ inicio: "", fim: "" }],
        };
      })
    );
  }

  function adicionarPeriodo(dia: DiaSemana) {
    setDispo((prev) =>
      prev.map((d) =>
        d.dia === dia ? { ...d, periodos: [...d.periodos, { inicio: "", fim: "" }] } : d
      )
    );
  }

  function removerPeriodo(dia: DiaSemana, idx: number) {
    setDispo((prev) =>
      prev.map((d) =>
        d.dia === dia ? { ...d, periodos: d.periodos.filter((_, i) => i !== idx) } : d
      )
    );
  }

  function atualizarPeriodo(
    dia: DiaSemana,
    idx: number,
    campo: "inicio" | "fim",
    valor: string
  ) {
    setDispo((prev) =>
      prev.map((d) =>
        d.dia === dia
          ? {
              ...d,
              periodos: d.periodos.map((p, i) => (i === idx ? { ...p, [campo]: valor } : p)),
            }
          : d
      )
    );
  }

  async function selecionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await redimensionarImagem(file);
      setFoto(url);
    } catch {
      setErro("Não foi possível carregar essa foto. Tente outra imagem.");
    }
  }

  function validar(): string | null {
    if (!nome.trim()) return "Nome completo é obrigatório.";
    const duplicado = integrantes.some(
      (p) =>
        p.id !== editandoId &&
        p.nome.trim().toLowerCase() === nome.trim().toLowerCase()
    );
    if (duplicado) return "Já existe um integrante cadastrado com esse nome.";
    if (telefone.trim() && !TELEFONE_REGEX.test(telefone.trim())) {
      return "Telefone em formato inválido.";
    }
    if (email.trim() && !EMAIL_REGEX.test(email.trim())) {
      return "E-mail inválido.";
    }
    if (funcoes.length === 0) {
      return "Selecione ao menos uma função ou instrumento.";
    }
    for (const d of dispo) {
      if (d.status === "disponivel" && !d.diaTodo) {
        if (d.periodos.length === 0) {
          return `Informe um horário para ${DIAS_SEMANA_LABEL[d.dia]} ou marque "Dia todo".`;
        }
        for (const p of d.periodos) {
          if (!p.inicio || !p.fim) {
            return `Preencha os horários de ${DIAS_SEMANA_LABEL[d.dia]}.`;
          }
          if (p.inicio >= p.fim) {
            return `Em ${DIAS_SEMANA_LABEL[d.dia]}, o horário inicial precisa ser antes do final.`;
          }
        }
      }
    }
    return null;
  }

  function salvar() {
    const mensagem = validar();
    if (mensagem) {
      setErro(mensagem);
      return;
    }
    const niveisArray: NivelPorFuncao[] = funcoes
      .filter((f) => niveis[f])
      .map((f) => ({ instrumentoId: f, nivel: niveis[f] }));

    const dados = {
      nome: nome.trim(),
      nomeExibicao: nomeExibicao.trim() || undefined,
      telefone: telefone.trim() || undefined,
      email: email.trim() || undefined,
      foto,
      ativo,
      funcoes,
      niveis: niveisArray,
      observacoesMusicais: observacoes.trim() || undefined,
      disponibilidade: dispo.length > 0 ? { dias: dispo } : undefined,
    };

    if (editandoId) {
      setIntegrantes((prev) =>
        prev.map((p) => (p.id === editandoId ? { ...p, ...dados } : p))
      );
    } else {
      setIntegrantes((prev) => [...prev, { id: uid(), ...dados }]);
    }
    setMostrarForm(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  function excluir(id: string) {
    if (
      !window.confirm(
        "Excluir remove o integrante permanentemente. Se ele já apareceu em alguma escala salva, prefira Desativar em vez de excluir. Excluir mesmo assim?"
      )
    ) {
      return;
    }
    setIntegrantes((prev) => prev.filter((p) => p.id !== id));
  }

  function alternarAtivo(id: string) {
    setIntegrantes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ativo: !(p.ativo ?? true) } : p))
    );
  }

  function nomeInstrumento(id: string) {
    return instrumentos.find((i) => i.id === id)?.nome ?? id;
  }

  function emojiInstrumento(id: string) {
    return instrumentos.find((i) => i.id === id)?.emoji ?? "🎵";
  }

  function historicoDoIntegrante(id: string) {
    return historico
      .map((e) => {
        const itens = unificarItens(e.domingos, e.cultosExtras ?? []);
        const dias = itens.filter((item) =>
          new Set(pessoasDoItem(item.escalacao)).has(id)
        ).length;
        return { mes: e.config.mes, ano: e.config.ano, dias };
      })
      .filter((r) => r.dias > 0)
      .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
  }

  const termoBusca = busca.trim().toLowerCase();
  const integrantesFiltrados = integrantes.filter((p) => {
    const ativoAtual = p.ativo ?? true;
    const combinaStatus =
      filtroStatus === "todos" ||
      (filtroStatus === "ativos" && ativoAtual) ||
      (filtroStatus === "inativos" && !ativoAtual);
    const combinaBusca =
      !termoBusca ||
      p.nome.toLowerCase().includes(termoBusca) ||
      (p.nomeExibicao ?? "").toLowerCase().includes(termoBusca);
    return combinaStatus && combinaBusca;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold">Integrantes</h2>
          <p className="text-sm text-[hsl(var(--muted))]">
            Cadastre uma vez e reutilize em todas as escalas.
          </p>
        </div>
        <Button onClick={iniciarNovo} disabled={instrumentos.length === 0}>
          <Plus className="h-4 w-4" /> Novo integrante
        </Button>
      </div>

      {instrumentos.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-[hsl(var(--muted))]">
            Cadastre ao menos um instrumento na aba Instrumentos antes de
            adicionar integrantes.
          </CardContent>
        </Card>
      )}

      {mostrarForm && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editandoId ? "Editar integrante" : "Novo integrante"}
              </h3>
              <button onClick={() => setMostrarForm(false)}>
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative group shrink-0"
                aria-label="Selecionar foto"
              >
                <Avatar foto={foto} nome={nome || "?"} tamanho={64} />
                <span className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={selecionarFoto}
              />
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-[hsl(var(--primary))] hover:underline text-left"
                >
                  {foto ? "Trocar foto" : "Adicionar foto"}
                </button>
                {foto && (
                  <button
                    type="button"
                    onClick={() => setFoto(undefined)}
                    className="text-xs text-red-500 hover:underline text-left"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Nome completo
                </label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Felipe Nascimento"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Nome de exibição (opcional)
                </label>
                <Input
                  value={nomeExibicao}
                  onChange={(e) => setNomeExibicao(e.target.value)}
                  placeholder="Ex: Felipe"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  WhatsApp (opcional)
                </label>
                <Input
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(85) 99999-9999"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  E-mail (opcional)
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nome@exemplo.com"
                />
              </div>
            </div>

            <Checkbox
              label="Integrante ativo"
              checked={ativo}
              onChange={() => setAtivo((a) => !a)}
            />

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Instrumentos / funções
              </label>
              <div className="space-y-1">
                {instrumentos.map((inst) => {
                  const marcado = funcoes.includes(inst.id);
                  return (
                    <div key={inst.id} className="flex items-center gap-3">
                      <Checkbox
                        label={`${inst.emoji} ${inst.nome}`}
                        checked={marcado}
                        onChange={() => alternarFuncao(inst.id)}
                      />
                      {marcado && (
                        <Select
                          value={niveis[inst.id] ?? ""}
                          onChange={(e) =>
                            setNiveis((prev) => ({
                              ...prev,
                              [inst.id]: e.target.value as NivelExperiencia,
                            }))
                          }
                          className="w-auto text-xs py-1"
                        >
                          <option value="">Nível (opcional)</option>
                          {(Object.keys(NIVEL_LABEL) as NivelExperiencia[]).map((n) => (
                            <option key={n} value={n}>
                              {NIVEL_LABEL[n]}
                            </option>
                          ))}
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Observações musicais (opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40"
                placeholder="Ex: prefere tocar violão em tom mais grave, canta segunda voz..."
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Disponibilidade (opcional)
              </label>
              <p className="text-xs text-[hsl(var(--muted))] mb-2">
                Quando este integrante normalmente pode servir. Ainda não é
                usada na geração automática da escala.
              </p>
              <div className="space-y-2">
                {([0, 1, 2, 3, 4, 5, 6] as DiaSemana[]).map((dia) => {
                  const info = dispo.find((d) => d.dia === dia);
                  const status = info?.status ?? "nao_informado";
                  return (
                    <div
                      key={dia}
                      className="rounded-xl border border-[hsl(var(--border))] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-sm font-medium w-20 shrink-0">
                          {DIAS_SEMANA_LABEL[dia]}
                        </span>
                        <div className="flex rounded-lg border border-[hsl(var(--border))] overflow-hidden text-xs">
                          <button
                            type="button"
                            onClick={() => marcarNaoInformado(dia)}
                            className={`px-2.5 py-1.5 whitespace-nowrap ${
                              status === "nao_informado"
                                ? "bg-[hsl(var(--border))]"
                                : "hover:bg-[hsl(var(--border))]/40"
                            }`}
                          >
                            ⚪ Não informado
                          </button>
                          <button
                            type="button"
                            onClick={() => definirStatusDia(dia, "disponivel")}
                            className={`px-2.5 py-1.5 whitespace-nowrap ${
                              status === "disponivel"
                                ? "bg-emerald-500 text-white"
                                : "hover:bg-[hsl(var(--border))]/40"
                            }`}
                          >
                            🟢 Disponível
                          </button>
                          <button
                            type="button"
                            onClick={() => definirStatusDia(dia, "indisponivel")}
                            className={`px-2.5 py-1.5 whitespace-nowrap ${
                              status === "indisponivel"
                                ? "bg-red-500 text-white"
                                : "hover:bg-[hsl(var(--border))]/40"
                            }`}
                          >
                            🔴 Indisponível
                          </button>
                        </div>
                      </div>

                      {status === "disponivel" && info && (
                        <div className="mt-2.5 pl-1 space-y-2">
                          <Checkbox
                            label="Dia todo"
                            checked={info.diaTodo}
                            onChange={() => alternarDiaTodo(dia)}
                          />
                          {!info.diaTodo && (
                            <div className="space-y-1.5">
                              {info.periodos.map((p, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-1.5 flex-wrap"
                                >
                                  <Input
                                    type="time"
                                    value={p.inicio}
                                    onChange={(e) =>
                                      atualizarPeriodo(dia, idx, "inicio", e.target.value)
                                    }
                                    className="w-auto"
                                  />
                                  <span className="text-xs text-[hsl(var(--muted))]">
                                    até
                                  </span>
                                  <Input
                                    type="time"
                                    value={p.fim}
                                    onChange={(e) =>
                                      atualizarPeriodo(dia, idx, "fim", e.target.value)
                                    }
                                    className="w-auto"
                                  />
                                  {info.periodos.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removerPeriodo(dia, idx)}
                                      className="p-1 rounded-lg hover:bg-red-500/10 text-red-500"
                                      aria-label="Remover horário"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => adicionarPeriodo(dia)}
                                className="text-xs text-[hsl(var(--primary))] hover:underline flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" /> Adicionar horário
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {erro && <p className="text-sm text-red-500">{erro}</p>}

            <div className="flex gap-2">
              <Button onClick={salvar} className="flex-1">
                Salvar integrante
              </Button>
              <Button variant="secondary" onClick={() => setMostrarForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {salvo && !mostrarForm && (
        <p className="text-sm text-emerald-500">Integrante salvo!</p>
      )}

      {integrantes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted))]" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar integrante"
              className="pl-8"
            />
          </div>
          <div className="flex rounded-xl border border-[hsl(var(--border))] overflow-hidden text-xs">
            {(["ativos", "inativos", "todos"] as FiltroStatus[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltroStatus(f)}
                className={`px-3 py-2 capitalize ${
                  filtroStatus === f
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "hover:bg-[hsl(var(--border))]/40"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {integrantes.length === 0 && !mostrarForm && (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2 text-[hsl(var(--muted))]">
            <Users className="h-8 w-8" />
            <p className="text-sm">Nenhum integrante cadastrado ainda.</p>
          </CardContent>
        </Card>
      )}

      {integrantes.length > 0 && integrantesFiltrados.length === 0 && (
        <p className="text-sm text-[hsl(var(--muted))]">
          Nenhum integrante encontrado com esse filtro.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {integrantesFiltrados.map((p) => {
          const ativoAtual = p.ativo ?? true;
          const aberto = detalheId === p.id;
          const hist = aberto ? historicoDoIntegrante(p.id) : [];
          return (
            <Card key={p.id} className="sm:col-span-1">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="flex items-start gap-3 text-left flex-1 min-w-0"
                    onClick={() => setDetalheId(aberto ? null : p.id)}
                  >
                    <Avatar foto={p.foto} nome={p.nomeExibicao || p.nome} />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {p.nomeExibicao || p.nome}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.funcoes.map((f) => (
                          <span
                            key={f}
                            className="text-xs rounded-full bg-[hsl(var(--border))]/60 px-2 py-0.5"
                          >
                            {emojiInstrumento(f)} {nomeInstrumento(f)}
                          </span>
                        ))}
                      </div>
                      <p
                        className={`text-xs mt-1.5 flex items-center gap-1 ${
                          ativoAtual ? "text-emerald-500" : "text-[hsl(var(--muted))]"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            ativoAtual ? "bg-emerald-500" : "bg-[hsl(var(--muted))]"
                          }`}
                        />
                        {ativoAtual ? "Ativo" : "Inativo"}
                        {aberto ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </p>
                    </div>
                  </button>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => iniciarEdicao(p)}
                      className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))]/60"
                      aria-label="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => alternarAtivo(p.id)}
                      className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))]/60"
                      aria-label={ativoAtual ? "Desativar" : "Ativar"}
                      title={ativoAtual ? "Desativar" : "Ativar"}
                    >
                      {ativoAtual ? (
                        <UserX className="h-3.5 w-3.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => excluir(p.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {aberto && (
                  <div className="mt-4 pt-4 border-t border-[hsl(var(--border))] space-y-2 text-sm">
                    {p.nomeExibicao && p.nomeExibicao !== p.nome && (
                      <p>
                        <span className="text-[hsl(var(--muted))]">Nome completo: </span>
                        {p.nome}
                      </p>
                    )}
                    {p.telefone && (
                      <p>
                        <span className="text-[hsl(var(--muted))]">WhatsApp: </span>
                        {p.telefone}
                      </p>
                    )}
                    {p.email && (
                      <p>
                        <span className="text-[hsl(var(--muted))]">E-mail: </span>
                        {p.email}
                      </p>
                    )}
                    {(p.niveis?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[hsl(var(--muted))]">Nível por função:</p>
                        <ul className="ml-4 list-disc">
                          {p.niveis!.map((n) => (
                            <li key={n.instrumentoId}>
                              {nomeInstrumento(n.instrumentoId)}: {NIVEL_LABEL[n.nivel]}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {p.observacoesMusicais && (
                      <p>
                        <span className="text-[hsl(var(--muted))]">Observações: </span>
                        {p.observacoesMusicais}
                      </p>
                    )}
                    <div>
                      <p className="text-[hsl(var(--muted))] mb-1">Disponibilidade:</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {([0, 1, 2, 3, 4, 5, 6] as DiaSemana[]).map((dia) => {
                          const info = p.disponibilidade?.dias.find((d) => d.dia === dia);
                          let texto: string;
                          if (!info) texto = "⚪ Não informado";
                          else if (info.status === "indisponivel") texto = "🔴 Indisponível";
                          else if (info.diaTodo) texto = "🟢 Dia todo";
                          else
                            texto = `🟢 ${
                              info.periodos
                                .filter((per) => per.inicio && per.fim)
                                .map((per) => `${per.inicio}–${per.fim}`)
                                .join(", ") || "Disponível"
                            }`;
                          return (
                            <p key={dia}>
                              <span className="text-[hsl(var(--muted))]">
                                {DIAS_SEMANA_LABEL[dia]}:{" "}
                              </span>
                              {texto}
                            </p>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-[hsl(var(--muted))]">
                        Histórico de participação (escalas salvas neste aparelho):
                      </p>
                      {hist.length === 0 ? (
                        <p className="text-[hsl(var(--muted))] text-xs mt-0.5">
                          Nenhuma participação registrada ainda.
                        </p>
                      ) : (
                        <ul className="ml-4 list-disc">
                          {hist.map((h) => (
                            <li key={`${h.mes}-${h.ano}`}>
                              {h.mes}/{h.ano}: {h.dias} {h.dias === 1 ? "dia" : "dias"}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

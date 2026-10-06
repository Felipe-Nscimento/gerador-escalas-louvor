"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ClipboardList,
  Copy,
  Eye,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { Card, CardContent } from "./ui/Card";
import { Input } from "./ui/Input";
import { Select } from "./ui/Select";
import { AuthForm } from "./auth/AuthForm";
import { FormularioCadastroForm, FotoAcao, InstrumentoOpcao } from "./FormularioCadastroForm";
import { FormulariosRelatorio, TipoRelatorio, TIPOS_RELATORIO } from "./FormulariosRelatorio";
import { useAuth } from "@/lib/useAuth";
import { KEYS, usePersistedState } from "@/lib/storage";
import { carregarNomeEquipeRemoto, salvarNomeEquipeRemoto } from "@/lib/preferenciasRemoto";
import {
  assinarFormularios,
  atualizarFormulario,
  criarFormulario,
  enviarFotoFormulario,
  excluirFormulario,
  gerarLinkFormulario,
  listarFormularios,
  removerFotoDoStorage,
} from "@/lib/formulariosRemoto";
import { assinarInstrumentosRemotos, listarInstrumentosRemotos } from "@/lib/instrumentosRemoto";
import {
  DIAS_VALIDADE_LINK,
  FormularioCadastro,
  gerarUuid,
  formatarDataBR,
  formatarInstagram,
  formatarWhatsapp,
  linkExpirado,
  linkInstagram,
  linkWhatsAppConvite,
  mensagemErro,
  resumoCelula,
  resumoSimNao,
  rotulosTrajetoria,
  STATUS_FORMULARIO_LABEL,
  urlDoFormulario,
  DadosFormulario,
} from "@/lib/formularios";

interface Props {
  auth: ReturnType<typeof useAuth>;
  onUsarComoIntegrante: (formulario: FormularioCadastro) => void;
}

type FiltroStatus = "todos" | "aguardando" | "pendente" | "utilizado";
type StatusPdf = "todos" | "pendente" | "utilizado";
type Editor = { modo: "novo" } | { modo: "editar"; formulario: FormularioCadastro } | null;

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function Avatar({ f, tamanho = 44 }: { f: FormularioCadastro; tamanho?: number }) {
  const estilo = { width: tamanho, height: tamanho };
  if (f.foto_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={f.foto_url} alt={f.nome ?? ""} style={estilo} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <span
      style={estilo}
      className="rounded-full bg-[hsl(var(--primary))]/15 text-[hsl(var(--primary))] flex items-center justify-center text-xs font-semibold shrink-0"
    >
      {f.nome ? iniciais(f.nome) : <ClipboardList className="h-4 w-4" />}
    </span>
  );
}

function BadgeStatus({ f }: { f: FormularioCadastro }) {
  if (f.status === "aguardando") {
    return linkExpirado(f) ? (
      <Badge className="bg-red-500/10 text-red-500">🔴 Link expirado</Badge>
    ) : (
      <Badge className="bg-slate-400/15 text-[hsl(var(--muted))]">⚪ Aguardando preenchimento</Badge>
    );
  }
  if (f.status === "pendente") return <Badge className="bg-amber-400/10 text-amber-500">🟡 Pendente</Badge>;
  return <Badge className="bg-emerald-500/10 text-emerald-500">🟢 Utilizado</Badge>;
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = texto;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

function dataDoCadastro(f: FormularioCadastro): string {
  return new Date(f.enviado_em ?? f.created_at).toLocaleDateString("pt-BR");
}

export function FormulariosManager({ auth, onUsarComoIntegrante }: Props) {
  const ehEquipe = auth.perfil?.role === "lider" || auth.perfil?.role === "montador";
  const autorizado = auth.supabaseConfigurado && auth.logado && ehEquipe;

  const [formularios, setFormularios] = useState<FormularioCadastro[]>([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [filtroInstrumento, setFiltroInstrumento] = useState("");

  const [editor, setEditor] = useState<Editor>(null);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkGerado, setLinkGerado] = useState<FormularioCadastro | null>(null);

  const [pdfAberto, setPdfAberto] = useState(false);
  const [pdfTipo, setPdfTipo] = useState<TipoRelatorio>("completo");
  const [pdfStatus, setPdfStatus] = useState<StatusPdf>("todos");
  const [pdfBusca, setPdfBusca] = useState("");
  const [pdfInstrumento, setPdfInstrumento] = useState("");
  // Nome que aparece no título do PDF; fica salvo no aparelho e na nuvem (todos os aparelhos).
  const [nomeEquipe, setNomeEquipe] = usePersistedState<string>(KEYS.nomeEquipe, "Equipe de Louvor");
  const [relatorio, setRelatorio] = useState<{
    tipo: TipoRelatorio;
    itens: FormularioCadastro[];
    descricao: string;
  } | null>(null);
  const [imprimindo, setImprimindo] = useState(false);

  const recarregar = useCallback(() => {
    listarFormularios()
      .then((lista) => {
        setFormularios(lista);
        setErroLista(null);
      })
      .catch((e) => setErroLista(mensagemErro(e, "Não foi possível carregar os formulários agora.")))
      .finally(() => setCarregando(false));
  }, []);

  const recarregarInstrumentos = useCallback(() => {
    // Fonte única dos instrumentos: a MESMA tabela do cadastro de Instrumentos.
    listarInstrumentosRemotos()
      .then((lista) =>
        setInstrumentos(lista.map((i) => ({ id: i.id, nome: i.nome, emoji: i.emoji })))
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!autorizado) return;
    recarregar();
    recarregarInstrumentos();
    const cancelarForms = assinarFormularios(recarregar);
    const cancelarInst = assinarInstrumentosRemotos(recarregarInstrumentos);
    return () => {
      cancelarForms();
      cancelarInst();
    };
  }, [autorizado, recarregar, recarregarInstrumentos]);

  useEffect(() => {
    if (!autorizado) return;
    let ativo = true;
    carregarNomeEquipeRemoto()
      .then((remoto) => {
        if (ativo && remoto !== undefined) setNomeEquipe(remoto);
      })
      .catch(() => {
        /* sem a nuvem, segue com o nome salvo no aparelho */
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autorizado]);

  const nomeInstrumento = useMemo(
    () => new Map(instrumentos.map((i) => [i.id, `${i.emoji} ${i.nome}`])),
    [instrumentos]
  );

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return formularios.filter((f) => {
      if (filtroStatus !== "todos" && f.status !== filtroStatus) return false;
      if (filtroInstrumento && !f.instrumentos.includes(filtroInstrumento)) return false;
      if (termo && !(f.nome ?? "").toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [formularios, busca, filtroStatus, filtroInstrumento]);

  function mostrarAviso(texto: string) {
    setAviso(texto);
    setTimeout(() => setAviso(null), 2500);
  }

  // ---------------------------------------------------------------
  // Links
  // ---------------------------------------------------------------
  async function gerarLink() {
    if (!auth.userId || gerandoLink) return;
    setGerandoLink(true);
    setErroLista(null);
    try {
      const novo = await gerarLinkFormulario(auth.userId);
      setLinkGerado(novo);
      recarregar();
    } catch (e) {
      setErroLista(mensagemErro(e, "Não foi possível gerar o link agora."));
    } finally {
      setGerandoLink(false);
    }
  }

  async function copiarLink(f: FormularioCadastro) {
    if (!f.token) return;
    const ok = await copiarTexto(urlDoFormulario(f.token));
    mostrarAviso(ok ? "Link copiado!" : "Não foi possível copiar. Selecione o link e copie manualmente.");
  }

  function enviarPorWhatsApp(f: FormularioCadastro) {
    if (!f.token) return;
    window.open(linkWhatsAppConvite(urlDoFormulario(f.token)), "_blank", "noopener,noreferrer");
  }

  // ---------------------------------------------------------------
  // Criar / editar / excluir
  // ---------------------------------------------------------------
  async function salvarEditor(dados: DadosFormulario, foto: FotoAcao) {
    if (!auth.userId || !editor) return;
    if (editor.modo === "novo") {
      const id = gerarUuid();
      let fotoPath: string | null = null;
      if (foto.tipo === "nova") {
        try {
          fotoPath = await enviarFotoFormulario(id, foto.foto);
        } catch (e) {
          throw new Error(mensagemErro(e, "Não foi possível enviar a foto. Tente de novo ou salve sem foto."));
        }
      }
      try {
        await criarFormulario(id, dados, auth.userId, fotoPath);
      } catch (e) {
        if (fotoPath) removerFotoDoStorage(fotoPath).catch(() => {});
        throw new Error(mensagemErro(e, "Não foi possível salvar o cadastro. Tente novamente."));
      }
    } else {
      let fotoPath: string | null | undefined = undefined;
      if (foto.tipo === "remover") fotoPath = null;
      if (foto.tipo === "nova") {
        try {
          fotoPath = await enviarFotoFormulario(editor.formulario.id, foto.foto);
        } catch (e) {
          throw new Error(mensagemErro(e, "Não foi possível enviar a foto. Tente de novo ou salve sem trocá-la."));
        }
      }
      try {
        await atualizarFormulario(editor.formulario, dados, fotoPath);
      } catch (e) {
        if (typeof fotoPath === "string") removerFotoDoStorage(fotoPath).catch(() => {});
        throw new Error(mensagemErro(e, "Não foi possível salvar as alterações. Tente novamente."));
      }
    }
    setEditor(null);
    mostrarAviso("Cadastro salvo!");
    recarregar();
  }

  async function excluir(f: FormularioCadastro) {
    const mensagem =
      f.status === "aguardando"
        ? "Excluir este link? Quem ainda não preencheu não conseguirá mais usá-lo."
        : f.status === "utilizado"
        ? `Excluir o cadastro de ${f.nome}? O integrante já criado NÃO será afetado e continua com a foto.`
        : `Excluir o cadastro de ${f.nome}? Isso também remove a foto enviada.`;
    if (!window.confirm(mensagem)) return;
    setErroLista(null);
    try {
      await excluirFormulario(f);
      if (linkGerado?.id === f.id) setLinkGerado(null);
      recarregar();
    } catch (e) {
      setErroLista(mensagemErro(e, "Não foi possível excluir agora."));
    }
  }

  // ---------------------------------------------------------------
  // PDF (mesmo padrão do app: impressão do navegador -> "Salvar como PDF")
  // ---------------------------------------------------------------
  function gerarRelatorioFiltrado() {
    const termo = pdfBusca.trim().toLowerCase();
    const itens = formularios.filter((f) => {
      if (f.status === "aguardando") return false; // link ainda sem dados
      if (pdfStatus !== "todos" && f.status !== pdfStatus) return false;
      if (pdfInstrumento && !f.instrumentos.includes(pdfInstrumento)) return false;
      if (termo && !(f.nome ?? "").toLowerCase().includes(termo)) return false;
      return true;
    });
    if (itens.length === 0) {
      setErroLista("Nenhum cadastro corresponde aos filtros escolhidos.");
      return;
    }
    setErroLista(null);
    if (auth.userId) {
      salvarNomeEquipeRemoto(nomeEquipe.trim(), auth.userId).catch(() => {
        /* o nome continua salvo neste aparelho */
      });
    }
    const partes = [
      pdfStatus === "todos" ? "todos os status" : pdfStatus === "pendente" ? "somente pendentes" : "somente utilizados",
    ];
    if (pdfInstrumento) partes.push(`instrumento: ${nomeInstrumento.get(pdfInstrumento) ?? ""}`);
    if (pdfBusca.trim()) partes.push(`nome contém "${pdfBusca.trim()}"`);
    setRelatorio({ tipo: pdfTipo, itens, descricao: partes.join(" · ") });
    setPdfAberto(false);
  }

  function pdfIndividual(f: FormularioCadastro) {
    setRelatorio({ tipo: "completo", itens: [f], descricao: "cadastro individual" });
  }

  async function imprimir() {
    setImprimindo(true);
    try {
      // espera as fotos carregarem para saírem no PDF
      const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("#print-area img"));
      await Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              })
        )
      );
      window.print();
    } finally {
      setImprimindo(false);
    }
  }

  // ---------------------------------------------------------------
  // Acesso
  // ---------------------------------------------------------------
  if (!auth.supabaseConfigurado) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[hsl(var(--muted))]">
          Os formulários precisam do Supabase configurado. Veja o README do projeto.
        </CardContent>
      </Card>
    );
  }
  if (!auth.logado) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[hsl(var(--muted))]">
          Entre com sua conta de líder ou montador para gerenciar os formulários.
        </p>
        {!auth.carregando && <AuthForm />}
      </div>
    );
  }
  if (!ehEquipe) {
    return (
      <Card>
        <CardContent className="pt-5 text-sm text-[hsl(var(--muted))]">
          {auth.perfil
            ? "Seu perfil não tem acesso à área de formulários. Ela é exclusiva de líderes e montadores."
            : "Verificando seu perfil de líder/montador... Se esta mensagem não sumir, saia e entre novamente."}
        </CardContent>
      </Card>
    );
  }

  // ---------------------------------------------------------------
  // Visualização do relatório
  // ---------------------------------------------------------------
  if (relatorio) {
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={() => setRelatorio(null)}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={imprimir} disabled={imprimindo}>
            {imprimindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            Imprimir / Salvar PDF
          </Button>
        </div>
        <p className="no-print text-xs text-[hsl(var(--muted))]">
          Na janela que abrir, escolha <strong>Salvar como PDF</strong> como destino da impressão.
        </p>
        <FormulariosRelatorio
          tipo={relatorio.tipo}
          itens={relatorio.itens}
          instrumentos={instrumentos}
          descricaoFiltros={relatorio.descricao}
          nomeEquipe={nomeEquipe}
        />
      </div>
    );
  }

  // ---------------------------------------------------------------
  // Tela principal
  // ---------------------------------------------------------------
  const urlGerada = linkGerado?.token ? urlDoFormulario(linkGerado.token) : "";

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold">Formulários de Cadastro</h2>
          <p className="text-sm text-[hsl(var(--muted))]">
            Gerencie os cadastros enviados pelo formulário de novos integrantes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setEditor({ modo: "novo" });
              setPdfAberto(false);
            }}
            disabled={instrumentos.length === 0}
          >
            <Plus className="h-4 w-4" /> Novo Formulário
          </Button>
          <Button variant="secondary" onClick={gerarLink} disabled={gerandoLink}>
            {gerandoLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Gerar Link
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setPdfAberto((a) => !a);
              setEditor(null);
            }}
          >
            <FileText className="h-4 w-4" /> Gerar PDF
          </Button>
        </div>
      </div>

      {aviso && (
        <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
          {aviso}
        </p>
      )}
      {erroLista && (
        <p role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {erroLista}
        </p>
      )}

      {instrumentos.length === 0 && (
        <Card>
          <CardContent className="pt-5 text-sm text-[hsl(var(--muted))]">
            Cadastre ao menos um instrumento na aba Instrumentos para usar os formulários.
          </CardContent>
        </Card>
      )}

      {linkGerado && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Link do formulário</h3>
              <button onClick={() => setLinkGerado(null)} aria-label="Fechar">
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
            <Input readOnly value={urlGerada} onFocus={(e) => e.currentTarget.select()} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copiarLink(linkGerado)}>
                <Copy className="h-4 w-4" /> Copiar link
              </Button>
              <Button onClick={() => enviarPorWhatsApp(linkGerado)}>
                <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
              </Button>
            </div>
            <p className="text-xs text-[hsl(var(--muted))]">
              Válido por {DIAS_VALIDADE_LINK} dias e pode ser preenchido uma única vez. Quem receber não precisa de
              login e só vê o formulário.
            </p>
          </CardContent>
        </Card>
      )}

      {pdfAberto && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Gerar PDF</h3>
              <button onClick={() => setPdfAberto(false)} aria-label="Fechar">
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Tipo de relatório</p>
              {TIPOS_RELATORIO.map((t) => (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${
                    pdfTipo === t.id
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5"
                      : "border-[hsl(var(--border))]"
                  }`}
                >
                  <input
                    type="radio"
                    name="tipo-pdf"
                    className="mt-1"
                    checked={pdfTipo === t.id}
                    onChange={() => setPdfTipo(t.id)}
                  />
                  <span>
                    <span className="block text-sm font-medium">{t.titulo}</span>
                    <span className="block text-xs text-[hsl(var(--muted))]">{t.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Status</label>
                <Select value={pdfStatus} onChange={(e) => setPdfStatus(e.target.value as StatusPdf)}>
                  <option value="todos">Todos</option>
                  <option value="pendente">Somente pendentes</option>
                  <option value="utilizado">Somente utilizados</option>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Instrumento</label>
                <Select value={pdfInstrumento} onChange={(e) => setPdfInstrumento(e.target.value)}>
                  <option value="">Todos</option>
                  {instrumentos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.emoji} {i.nome}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome contém</label>
                <Input value={pdfBusca} onChange={(e) => setPdfBusca(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome da igreja / equipe (título do PDF)</label>
              <Input
                value={nomeEquipe}
                maxLength={60}
                onChange={(e) => setNomeEquipe(e.target.value)}
                placeholder="Equipe de Louvor"
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={gerarRelatorioFiltrado}>
                <FileText className="h-4 w-4" /> Visualizar relatório
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {editor && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editor.modo === "novo" ? "Novo formulário" : "Editar cadastro"}
              </h3>
              <button onClick={() => setEditor(null)} aria-label="Fechar">
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
            <FormularioCadastroForm
              key={editor.modo === "novo" ? "novo" : editor.formulario.id}
              instrumentos={instrumentos}
              valoresIniciais={
                editor.modo === "editar"
                  ? {
                      nome: editor.formulario.nome ?? "",
                      whatsapp: editor.formulario.whatsapp ?? "",
                      instagram: editor.formulario.instagram ?? "",
                      endereco: editor.formulario.endereco ?? "",
                      dataAniversario: editor.formulario.data_aniversario ?? "",
                      instrumentos: editor.formulario.instrumentos,
                      participaCelula: editor.formulario.participa_celula,
                      celulaNome: editor.formulario.celula_nome ?? "",
                      celulaLider: editor.formulario.celula_lider ?? "",
                      trajetoria: editor.formulario.trajetoria,
                      serveMinisterio: editor.formulario.serve_ministerio,
                      ministerioNome: editor.formulario.ministerio_nome ?? "",
                    }
                  : undefined
              }
              fotoAtualUrl={editor.modo === "editar" ? editor.formulario.foto_url : null}
              rotuloEnviar="Salvar"
              onEnviar={salvarEditor}
              onCancelar={() => setEditor(null)}
            />
          </CardContent>
        </Card>
      )}

      {/* Busca e filtros */}
      <div className="grid sm:grid-cols-[1fr,auto,auto] gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <Input
            className="pl-8"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
          />
        </div>
        <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}>
          <option value="todos">Todos os status</option>
          <option value="pendente">Pendentes</option>
          <option value="utilizado">Utilizados</option>
          <option value="aguardando">Aguardando preenchimento</option>
        </Select>
        <Select value={filtroInstrumento} onChange={(e) => setFiltroInstrumento(e.target.value)}>
          <option value="">Todos os instrumentos</option>
          {instrumentos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.emoji} {i.nome}
            </option>
          ))}
        </Select>
      </div>

      {/* Lista */}
      {carregando ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-[hsl(var(--muted))]">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : filtrados.length === 0 ? (
        <Card>
          <CardContent className="pt-6 pb-6 text-center text-sm text-[hsl(var(--muted))]">
            {formularios.length === 0
              ? "Nenhum cadastro ainda. Use “Gerar Link” para enviar o formulário a alguém ou “Novo Formulário” para cadastrar você mesmo."
              : "Nenhum cadastro encontrado com esses filtros."}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {filtrados.map((f) => {
            const aberto = detalheId === f.id;
            const insts = f.instrumentos.map((id) => nomeInstrumento.get(id)).filter(Boolean) as string[];
            const ehLink = f.status === "aguardando";
            return (
              <li key={f.id}>
                <Card>
                  <CardContent className="pt-4 pb-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <Avatar f={f} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium truncate">
                            {f.nome ?? "Link aguardando preenchimento"}
                          </p>
                          <BadgeStatus f={f} />
                        </div>
                        {ehLink ? (
                          <p className="text-xs text-[hsl(var(--muted))]">
                            Criado em {dataDoCadastro(f)}
                            {f.link_expira_em && ` · expira em ${new Date(f.link_expira_em).toLocaleDateString("pt-BR")}`}
                          </p>
                        ) : (
                          <>
                            <p className="text-xs text-[hsl(var(--muted))] flex flex-wrap gap-x-3">
                              {f.whatsapp && <span>{formatarWhatsapp(f.whatsapp)}</span>}
                              {f.instagram && (
                                <a
                                  href={linkInstagram(f.instagram)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:underline"
                                >
                                  {formatarInstagram(f.instagram)}
                                </a>
                              )}
                              {f.data_aniversario && <span>🎂 {formatarDataBR(f.data_aniversario)}</span>}
                            </p>
                            {insts.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {insts.map((n) => (
                                  <Badge key={n}>{n}</Badge>
                                ))}
                              </div>
                            )}
                            <p className="text-[11px] text-[hsl(var(--muted))]">Cadastro em {dataDoCadastro(f)}</p>
                          </>
                        )}
                      </div>
                    </div>

                    {aberto && !ehLink && (
                      <div className="rounded-xl bg-[hsl(var(--border))]/30 p-3 text-sm space-y-1">
                        <p>
                          <span className="text-[hsl(var(--muted))]">Endereço:</span> {f.endereco || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">WhatsApp:</span>{" "}
                          {formatarWhatsapp(f.whatsapp) || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Instagram:</span>{" "}
                          {formatarInstagram(f.instagram) || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Aniversário:</span>{" "}
                          {formatarDataBR(f.data_aniversario) || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Instrumentos:</span>{" "}
                          {insts.length > 0 ? insts.join(", ") : "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Célula:</span>{" "}
                          {resumoCelula(f) || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Trajetória:</span>{" "}
                          {rotulosTrajetoria(f.trajetoria).join(", ") || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Ministério:</span>{" "}
                          {resumoSimNao(f.serve_ministerio, f.ministerio_nome) || "—"}
                        </p>
                        <p>
                          <span className="text-[hsl(var(--muted))]">Status:</span> {STATUS_FORMULARIO_LABEL[f.status]}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5">
                      {ehLink ? (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => copiarLink(f)}>
                            <Copy className="h-3.5 w-3.5" /> Copiar link
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => enviarPorWhatsApp(f)}>
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="secondary" onClick={() => setDetalheId(aberto ? null : f.id)}>
                            <Eye className="h-3.5 w-3.5" /> {aberto ? "Ocultar" : "Visualizar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditor({ modo: "editar", formulario: f });
                              setPdfAberto(false);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                          {f.status === "pendente" && (
                            <Button size="sm" onClick={() => onUsarComoIntegrante(f)}>
                              <UserPlus className="h-3.5 w-3.5" /> Usar como Integrante
                            </Button>
                          )}
                          <Button size="sm" variant="secondary" onClick={() => pdfIndividual(f)}>
                            <FileText className="h-3.5 w-3.5" /> PDF
                          </Button>
                        </>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => excluir(f)} aria-label="Excluir">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Tipos e funções puras do Formulário de Cadastro.
 * Usado pela área administrativa E pelo formulário público — por isso não
 * importa nada do Supabase aqui.
 */

export type StatusFormulario = "aguardando" | "pendente" | "utilizado";

export const STATUS_FORMULARIO_LABEL: Record<StatusFormulario, string> = {
  aguardando: "Aguardando preenchimento",
  pendente: "Pendente",
  utilizado: "Utilizado",
};

export interface FormularioCadastro {
  id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  origem: "admin" | "link";
  status: StatusFormulario;
  token: string | null;
  link_expira_em: string | null;
  enviado_em: string | null;
  nome: string | null;
  whatsapp: string | null; // só dígitos, sem +55
  instagram: string | null; // sem "@"
  endereco: string | null;
  data_aniversario: string | null; // YYYY-MM-DD
  foto_path: string | null;
  /** Derivada de foto_path (bucket público) — não é gravada no banco. */
  foto_url: string | null;
  integrante_id: string | null;
  instrumentos: string[]; // ids reais da tabela instrumentos
  link_multiplo: boolean; // link reutilizável: cada envio vira um cadastro novo
  participa_celula: boolean | null; // null = não respondeu
  celula_nome: string | null;
  celula_lider: string | null; // nome do líder da célula
  trajetoria: string[]; // ids de ETAPAS_TRAJETORIA
  serve_ministerio: boolean | null;
  ministerio_nome: string | null;
}

/** Etapas da trajetória na igreja (checklist). O id é o valor gravado no banco. */
export const ETAPAS_TRAJETORIA = [
  { id: "acompanhamento_inicial", label: "Acompanhamento inicial" },
  { id: "cafe_com_pastor", label: "Café com pastor" },
  { id: "estacao_dna", label: "Estação DNA" },
  { id: "batismo", label: "Batismo" },
] as const;

const IDS_TRAJETORIA: string[] = ETAPAS_TRAJETORIA.map((e) => e.id);

export function rotulosTrajetoria(ids: string[]): string[] {
  return ETAPAS_TRAJETORIA.filter((e) => ids.includes(e.id)).map((e) => e.label);
}

/** Célula: "Sim — Nome (líder: Fulano)", "Sim", "Não" ou "" (não respondeu). */
export function resumoCelula(
  f: Pick<FormularioCadastro, "participa_celula" | "celula_nome" | "celula_lider">
): string {
  const base = resumoSimNao(f.participa_celula, f.celula_nome);
  return base && f.participa_celula && f.celula_lider ? `${base} (líder: ${f.celula_lider})` : base;
}

/** "Sim — Nome", "Sim", "Não" ou "" (não respondeu). */
export function resumoSimNao(resposta: boolean | null, qual: string | null): string {
  if (resposta === null) return "";
  if (!resposta) return "Não";
  return qual ? `Sim — ${qual}` : "Sim";
}

/** Valores digitados no formulário (ainda não normalizados). */
export interface DadosFormulario {
  nome: string;
  whatsapp: string;
  instagram: string;
  endereco: string;
  dataAniversario: string; // YYYY-MM-DD ou ""
  instrumentos: string[];
  participaCelula: boolean | null; // null = não respondeu
  celulaNome: string;
  celulaLider: string;
  trajetoria: string[];
  serveMinisterio: boolean | null;
  ministerioNome: string;
}

export const DADOS_FORMULARIO_VAZIOS: DadosFormulario = {
  nome: "",
  whatsapp: "",
  instagram: "",
  endereco: "",
  dataAniversario: "",
  instrumentos: [],
  participaCelula: null,
  celulaNome: "",
  celulaLider: "",
  trajetoria: [],
  serveMinisterio: null,
  ministerioNome: "",
};

export const DIAS_VALIDADE_LINK = 30;
export const LIMITE_FOTO_ENTRADA_MB = 10;
export const TIPOS_FOTO_ACEITOS = ["image/jpeg", "image/png", "image/webp"];
const EXTENSOES_FOTO_ACEITAS = ["jpg", "jpeg", "png", "webp"];

// ---------------------------------------------------------------------
// Nome
// ---------------------------------------------------------------------
export function normalizarNome(valor: string): string {
  return valor.replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------
// WhatsApp (telefone brasileiro). No banco: só dígitos, sem +55.
// ---------------------------------------------------------------------
export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function normalizarWhatsapp(valor: string): string | null {
  let digitos = somenteDigitos(valor);
  if (!digitos) return null;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  return digitos;
}

export function whatsappValido(valor: string): boolean {
  const n = normalizarWhatsapp(valor);
  if (n === null) return true; // opcional
  return /^[0-9]{10,11}$/.test(n) && !n.startsWith("0");
}

/** Máscara amigável enquanto digita: (85) 99999-9999 ou (85) 9999-9999. */
export function mascararWhatsapp(valor: string): string {
  let d = somenteDigitos(valor);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function formatarWhatsapp(armazenado: string | null | undefined): string {
  return armazenado ? mascararWhatsapp(armazenado) : "";
}

// ---------------------------------------------------------------------
// Instagram. No banco: sem "@". Aceita @usuario, usuario ou o link do perfil.
// ---------------------------------------------------------------------
export function normalizarInstagram(valor: string): string | null {
  let v = valor.trim();
  if (!v) return null;
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  v = v.split(/[/?#]/)[0];
  v = v.replace(/^@+/, "").trim();
  return v || null;
}

export function instagramValido(valor: string): boolean {
  const n = normalizarInstagram(valor);
  if (n === null) return true; // opcional
  return /^[A-Za-z0-9._]{1,30}$/.test(n);
}

export function formatarInstagram(armazenado: string | null | undefined): string {
  return armazenado ? `@${armazenado}` : "";
}

export function linkInstagram(armazenado: string): string {
  return `https://instagram.com/${armazenado}`;
}

// ---------------------------------------------------------------------
// Datas — sem passar por Date para não sofrer com fuso horário.
// ---------------------------------------------------------------------
export function formatarDataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

export function hojeISO(): string {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Chave para ordenar aniversariantes por mês e dia (ignora o ano). */
export function chaveMesDia(iso: string | null | undefined): number {
  if (!iso) return 9999;
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return Number(mes) * 100 + Number(dia);
}

export const NOMES_MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

// ---------------------------------------------------------------------
// Validação do formulário (o banco valida de novo — isto é só para dar
// mensagens amigáveis antes de enviar).
// ---------------------------------------------------------------------
export function validarDadosFormulario(d: DadosFormulario): string | null {
  const nome = normalizarNome(d.nome);
  if (nome.length < 2) return "Informe seu nome completo.";
  if (nome.length > 120) return "O nome está muito longo.";
  if (!whatsappValido(d.whatsapp)) {
    return "WhatsApp inválido. Use o formato (85) 99999-9999.";
  }
  if (!instagramValido(d.instagram)) {
    return "Instagram inválido. Use apenas letras, números, ponto e sublinhado (ex: @seu.usuario).";
  }
  if (d.endereco.trim().length > 300) return "O endereço está muito longo (máximo 300 caracteres).";
  if (d.dataAniversario) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dataAniversario)) return "Data de aniversário inválida.";
    if (d.dataAniversario < "1900-01-01" || d.dataAniversario > hojeISO()) {
      return "Data de aniversário inválida.";
    }
  }
  if (d.celulaNome.trim().length > 100) return "O nome da célula está muito longo (máximo 100 caracteres).";
  if (d.celulaLider.trim().length > 100) return "O nome do líder da célula está muito longo (máximo 100 caracteres).";
  if (d.ministerioNome.trim().length > 100) return "O nome do ministério está muito longo (máximo 100 caracteres).";
  if (d.trajetoria.some((t) => !IDS_TRAJETORIA.includes(t))) return "Etapa da trajetória inválida.";
  return null;
}

// ---------------------------------------------------------------------
// Foto
// ---------------------------------------------------------------------
export function validarArquivoFoto(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const tipoOk = TIPOS_FOTO_ACEITOS.includes(file.type);
  // alguns celulares não informam o tipo; nesse caso confiamos na extensão
  const extOk = EXTENSOES_FOTO_ACEITAS.includes(ext);
  if (!tipoOk && !(file.type === "" && extOk)) {
    return "Formato de imagem não aceito. Use JPG, PNG ou WebP.";
  }
  if (file.size > LIMITE_FOTO_ENTRADA_MB * 1024 * 1024) {
    return `A foto é muito grande (máximo ${LIMITE_FOTO_ENTRADA_MB} MB).`;
  }
  return null;
}

// ---------------------------------------------------------------------
// Token e link
// ---------------------------------------------------------------------
/** UUID v4. Usa crypto.randomUUID quando existe (só em HTTPS/localhost) e um fallback seguro. */
export function gerarUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** 32 bytes aleatórios criptograficamente seguros, em hexadecimal (64 caracteres). */
export function gerarToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function urlDoFormulario(token: string): string {
  return `${window.location.origin}/formulario/${token}`;
}

export function mensagemConvite(url: string): string {
  return `Olá! Gostaríamos que você preenchesse seu cadastro para nossa equipe de louvor.\n\nAcesse o formulário pelo link:\n\n${url}\n\nObrigado!`;
}

/** Link padrão do WhatsApp (sem API paga): abre o app com a mensagem pronta. */
export function linkWhatsAppConvite(url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagemConvite(url))}`;
}

export function linkExpirado(f: Pick<FormularioCadastro, "link_expira_em">): boolean {
  return !!f.link_expira_em && new Date(f.link_expira_em).getTime() <= Date.now();
}

// ---------------------------------------------------------------------
// Mensagens de erro amigáveis (nunca expõem detalhes internos)
// ---------------------------------------------------------------------
const MOTIVOS_PUBLICOS: Record<string, string> = {
  invalido: "Este link não é válido. Peça um novo link para a equipe.",
  expirado: "Este link expirou. Peça um novo link para a equipe.",
  ja_enviado: "Este link já foi utilizado. Se precisar corrigir algo, fale com a equipe.",
  nome_invalido: "Confira o nome informado.",
  whatsapp_invalido: "Confira o número de WhatsApp informado.",
  instagram_invalido: "Confira o Instagram informado.",
  endereco_invalido: "O endereço está muito longo.",
  data_invalida: "Confira a data de aniversário.",
  instrumento_inexistente:
    "Um dos instrumentos escolhidos não existe mais. Atualize a página e escolha novamente.",
  foto_invalida: "Não foi possível usar essa foto. Tente enviar outra.",
  celula_invalida: "Confira o nome da célula e do líder (máximo 100 caracteres cada).",
  ministerio_invalido: "Confira o nome do ministério (máximo 100 caracteres).",
  limite_atingido: "Este link atingiu o limite de cadastros. Peça um novo link para a equipe.",
  celula_lider_invalido: "Confira o nome do líder da célula (máximo 100 caracteres).",
  trajetoria_invalida: "Confira as etapas da trajetória marcadas.",
};

export function mensagemMotivoPublico(motivo: string | undefined): string {
  return (motivo && MOTIVOS_PUBLICOS[motivo]) || "Não foi possível concluir. Tente novamente.";
}

export function mensagemErro(e: unknown, padrao: string): string {
  const texto = e instanceof Error ? e.message : typeof e === "object" && e ? String((e as { message?: unknown }).message ?? "") : "";
  const codigo = typeof e === "object" && e ? String((e as { code?: unknown }).code ?? "") : "";
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(texto)) {
    return "Sem conexão com a internet. Verifique sua rede e tente novamente.";
  }
  if (codigo === "42501" || /row-level security|permission denied|not authorized|unauthorized/i.test(texto)) {
    return "Você não tem permissão para fazer isso.";
  }
  if (/mime type|invalid_mime|not supported|payload too large|exceeded the maximum/i.test(texto)) {
    return "Não foi possível enviar a foto (formato ou tamanho não aceito).";
  }
  return padrao;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Search, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import {
  DADOS_FORMULARIO_VAZIOS,
  DadosFormulario,
  hojeISO,
  mascararWhatsapp,
  mensagemErro,
  validarArquivoFoto,
  validarDadosFormulario,
} from "@/lib/formularios";
import { FotoPreparada, prepararFoto } from "@/lib/imagemUpload";

export interface InstrumentoOpcao {
  id: string;
  nome: string;
  emoji: string;
}

export type FotoAcao =
  | { tipo: "manter" }
  | { tipo: "remover" }
  | { tipo: "nova"; foto: FotoPreparada };

interface Props {
  instrumentos: InstrumentoOpcao[];
  valoresIniciais?: Partial<DadosFormulario>;
  fotoAtualUrl?: string | null;
  rotuloEnviar: string;
  /** Campos maiores — usado no formulário público, aberto pelo celular. */
  grande?: boolean;
  /** Deve lançar um Error com mensagem amigável se falhar. */
  onEnviar: (dados: DadosFormulario, foto: FotoAcao) => Promise<void>;
  onCancelar?: () => void;
}

const classeCampo = (grande?: boolean) => (grande ? "py-3.5 text-base" : "");

export function FormularioCadastroForm({
  instrumentos,
  valoresIniciais,
  fotoAtualUrl,
  rotuloEnviar,
  grande,
  onEnviar,
  onCancelar,
}: Props) {
  const inicial = { ...DADOS_FORMULARIO_VAZIOS, ...valoresIniciais };
  const [nome, setNome] = useState(inicial.nome);
  const [whatsapp, setWhatsapp] = useState(mascararWhatsapp(inicial.whatsapp));
  const [instagram, setInstagram] = useState(inicial.instagram);
  const [endereco, setEndereco] = useState(inicial.endereco);
  const [dataAniversario, setDataAniversario] = useState(inicial.dataAniversario);
  const [selecionados, setSelecionados] = useState<string[]>(inicial.instrumentos);
  const [buscaInstrumento, setBuscaInstrumento] = useState("");

  const [fotoNova, setFotoNova] = useState<FotoPreparada | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoRemovida, setFotoRemovida] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false); // trava síncrona contra clique duplo
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  const fotoExibida = fotoPreview ?? (fotoRemovida ? null : fotoAtualUrl ?? null);

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErro(null);
    const problema = validarArquivoFoto(file);
    if (problema) {
      setErro(problema);
      return;
    }
    setProcessandoFoto(true);
    try {
      const preparada = await prepararFoto(file);
      setFotoNova(preparada);
      setFotoRemovida(false);
      setFotoPreview(URL.createObjectURL(preparada.blob));
    } catch {
      setErro("Não foi possível carregar essa foto. Tente outra imagem.");
    } finally {
      setProcessandoFoto(false);
    }
  }

  function removerFoto() {
    setFotoNova(null);
    setFotoPreview(null);
    setFotoRemovida(true);
  }

  function alternarInstrumento(id: string) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const instrumentosFiltrados = useMemo(() => {
    const termo = buscaInstrumento.trim().toLowerCase();
    return termo ? instrumentos.filter((i) => i.nome.toLowerCase().includes(termo)) : instrumentos;
  }, [instrumentos, buscaInstrumento]);

  async function enviar() {
    if (enviandoRef.current || processandoFoto) return;
    const dados: DadosFormulario = {
      nome,
      whatsapp,
      instagram,
      endereco,
      dataAniversario,
      instrumentos: selecionados,
    };
    const problema = validarDadosFormulario(dados);
    if (problema) {
      setErro(problema);
      return;
    }
    enviandoRef.current = true;
    setEnviando(true);
    setErro(null);
    try {
      const foto: FotoAcao = fotoNova
        ? { tipo: "nova", foto: fotoNova }
        : fotoRemovida
        ? { tipo: "remover" }
        : { tipo: "manter" };
      await onEnviar(dados, foto);
    } catch (e) {
      setErro(mensagemErro(e, e instanceof Error && e.message ? e.message : "Não foi possível enviar. Tente novamente."));
    } finally {
      enviandoRef.current = false;
      setEnviando(false);
    }
  }

  const campo = classeCampo(grande);
  const rotulo = "text-sm font-medium mb-1.5 block";

  return (
    <div className="space-y-5">
      {/* Foto */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processandoFoto || enviando}
          aria-label="Adicionar foto"
          className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-dashed border-[hsl(var(--primary))]/50 bg-[hsl(var(--primary))]/5 flex items-center justify-center"
        >
          {processandoFoto ? (
            <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--primary))]" />
          ) : fotoExibida ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoExibida} alt="Pré-visualização da foto" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-7 w-7 text-[hsl(var(--primary))]" />
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={aoEscolherFoto}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={processandoFoto || enviando}
            className="text-sm font-medium text-[hsl(var(--primary))] hover:underline"
          >
            {fotoExibida ? "Trocar foto" : "Adicionar foto"}
          </button>
          {fotoExibida && (
            <button
              type="button"
              onClick={removerFoto}
              disabled={enviando}
              className="text-sm text-red-500 hover:underline"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={rotulo} htmlFor="fc-nome">
          Nome completo
        </label>
        <Input
          id="fc-nome"
          className={campo}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome completo"
          autoComplete="name"
          maxLength={120}
        />
      </div>

      <div>
        <label className={rotulo} htmlFor="fc-whatsapp">
          WhatsApp
        </label>
        <Input
          id="fc-whatsapp"
          className={campo}
          value={whatsapp}
          onChange={(e) => setWhatsapp(mascararWhatsapp(e.target.value))}
          placeholder="(85) 99999-9999"
          inputMode="tel"
          autoComplete="tel-national"
        />
      </div>

      <div>
        <label className={rotulo} htmlFor="fc-instagram">
          Instagram
        </label>
        <Input
          id="fc-instagram"
          className={campo}
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
          placeholder="@seu.usuario"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={80}
        />
      </div>

      <div>
        <label className={rotulo} htmlFor="fc-endereco">
          Endereço
        </label>
        <textarea
          id="fc-endereco"
          rows={2}
          maxLength={300}
          value={endereco}
          onChange={(e) => setEndereco(e.target.value)}
          placeholder="Rua, número, bairro, cidade"
          autoComplete="street-address"
          className={`w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/40 ${
            grande ? "py-3.5 text-base" : ""
          }`}
        />
      </div>

      <div>
        <label className={rotulo} htmlFor="fc-aniversario">
          Data de aniversário
        </label>
        <Input
          id="fc-aniversario"
          type="date"
          className={campo}
          value={dataAniversario}
          onChange={(e) => setDataAniversario(e.target.value)}
          min="1900-01-01"
          max={hojeISO()}
        />
      </div>

      <div>
        <label className={rotulo}>Instrumentos que toca</label>
        {instrumentos.length === 0 ? (
          <p className="text-sm text-[hsl(var(--muted))]">Nenhum instrumento disponível.</p>
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-2">
            {instrumentos.length > 6 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
                <Input
                  className={`pl-8 ${campo}`}
                  value={buscaInstrumento}
                  onChange={(e) => setBuscaInstrumento(e.target.value)}
                  placeholder="Buscar instrumento..."
                />
              </div>
            )}
            {selecionados.length > 0 && (
              <p className="text-xs text-[hsl(var(--muted))]">
                {selecionados.length} selecionado{selecionados.length > 1 ? "s" : ""}
              </p>
            )}
            <div className="max-h-56 overflow-y-auto">
              {instrumentosFiltrados.map((inst) => (
                <Checkbox
                  key={inst.id}
                  label={`${inst.emoji} ${inst.nome}`}
                  checked={selecionados.includes(inst.id)}
                  onChange={() => alternarInstrumento(inst.id)}
                  className={grande ? "py-2.5" : ""}
                />
              ))}
              {instrumentosFiltrados.length === 0 && (
                <p className="text-sm text-[hsl(var(--muted))] py-2">Nenhum instrumento encontrado.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-400/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-500"
        >
          <span className="flex-1">{erro}</span>
          <button type="button" onClick={() => setErro(null)} aria-label="Fechar aviso">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`flex gap-2 ${grande ? "flex-col" : "flex-col-reverse sm:flex-row sm:justify-end"}`}>
        {onCancelar && (
          <Button type="button" variant="secondary" onClick={onCancelar} disabled={enviando}>
            Cancelar
          </Button>
        )}
        <Button
          type="button"
          size={grande ? "lg" : "md"}
          onClick={enviar}
          disabled={enviando || processandoFoto}
          className={grande ? "w-full" : ""}
        >
          {enviando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
            </>
          ) : (
            rotuloEnviar
          )}
        </Button>
      </div>
    </div>
  );
}

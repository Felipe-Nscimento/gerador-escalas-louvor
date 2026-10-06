"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Search, X } from "lucide-react";
import { Button } from "./ui/Button";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import {
  DADOS_FORMULARIO_VAZIOS,
  DadosFormulario,
  ETAPAS_TRAJETORIA,
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

/** Botões Sim / Não. Tocar de novo na opção marcada desmarca (volta a "não respondeu"). */
function SimNao({
  valor,
  onChange,
  grande,
}: {
  valor: boolean | null;
  onChange: (v: boolean | null) => void;
  grande?: boolean;
}) {
  const classe = (ativo: boolean) =>
    `flex-1 rounded-full border px-4 font-semibold transition-colors ${
      grande ? "py-3 text-base" : "py-2 text-sm"
    } ${
      ativo
        ? "bg-[hsl(var(--primary))] border-[hsl(var(--primary))] text-white"
        : "border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--border))]/40"
    }`;
  return (
    <div className="flex gap-2">
      <button
        type="button"
        aria-pressed={valor === true}
        onClick={() => onChange(valor === true ? null : true)}
        className={classe(valor === true)}
      >
        Sim
      </button>
      <button
        type="button"
        aria-pressed={valor === false}
        onClick={() => onChange(valor === false ? null : false)}
        className={classe(valor === false)}
      >
        Não
      </button>
    </div>
  );
}

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
  const [participaCelula, setParticipaCelula] = useState<boolean | null>(inicial.participaCelula);
  const [celulaNome, setCelulaNome] = useState(inicial.celulaNome);
  const [celulaLider, setCelulaLider] = useState(inicial.celulaLider);
  const [trajetoria, setTrajetoria] = useState<string[]>(inicial.trajetoria);
  const [serveMinisterio, setServeMinisterio] = useState<boolean | null>(inicial.serveMinisterio);
  const [ministerioNome, setMinisterioNome] = useState(inicial.ministerioNome);
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

  function alternarEtapa(id: string) {
    setTrajetoria((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      participaCelula,
      celulaNome,
      celulaLider,
      trajetoria,
      serveMinisterio,
      ministerioNome,
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

      <div>
        <label className={rotulo}>Participa de célula?</label>
        <SimNao valor={participaCelula} onChange={setParticipaCelula} grande={grande} />
        {participaCelula && (
          <Input
            className={`mt-2 ${campo}`}
            value={celulaNome}
            onChange={(e) => setCelulaNome(e.target.value)}
            placeholder="Qual célula?"
            maxLength={100}
            aria-label="Qual célula?"
          />
        )}
        {participaCelula && (
          <Input
            className={`mt-2 ${campo}`}
            value={celulaLider}
            onChange={(e) => setCelulaLider(e.target.value)}
            placeholder="Nome do líder da célula"
            maxLength={100}
            aria-label="Nome do líder da célula"
          />
        )}
      </div>

      <div>
        <label className={rotulo}>Sua trajetória na igreja</label>
        <div className="rounded-xl border border-[hsl(var(--border))] p-3">
          {ETAPAS_TRAJETORIA.map((etapa) => (
            <Checkbox
              key={etapa.id}
              label={etapa.label}
              checked={trajetoria.includes(etapa.id)}
              onChange={() => alternarEtapa(etapa.id)}
              className={grande ? "py-2.5" : ""}
            />
          ))}
        </div>
      </div>

      <div>
        <label className={rotulo}>Serve em algum ministério da igreja?</label>
        <SimNao valor={serveMinisterio} onChange={setServeMinisterio} grande={grande} />
        {serveMinisterio && (
          <Input
            className={`mt-2 ${campo}`}
            value={ministerioNome}
            onChange={(e) => setMinisterioNome(e.target.value)}
            placeholder="Qual ministério?"
            maxLength={100}
            aria-label="Qual ministério?"
          />
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

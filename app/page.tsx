"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Users,
  SlidersHorizontal,
  CalendarDays,
  CalendarPlus,
  History,
  Music2,
  ClipboardList,
} from "lucide-react";
import { usePersistedState, KEYS, uid } from "@/lib/storage";
import {
  ConfiguracaoEscala,
  EscalaSalva,
  INSTRUMENTOS_PADRAO,
  Instrumento,
  Integrante,
  RASCUNHO_VAZIO,
  RascunhoAtual,
  REGRAS_PADRAO,
} from "@/lib/types";
import { AniversariantesAviso } from "@/components/AniversariantesAviso";
import { EscalaPrincipal } from "@/components/EscalaPrincipal";
import { NavegacaoApp } from "@/components/NavegacaoApp";
import { useAuth } from "@/lib/useAuth";
import { chaveMigracao, decidirMigracao, jaMigrou, marcarMigrou } from "@/lib/migracaoLocal";
import {
  assinarEscalasRemotas,
  EscalaRemota,
  listarEscalasRemotas,
} from "@/lib/escalasRemoto";
import {
  assinarIntegrantesRemotos,
  listarIntegrantesRemotos,
} from "@/lib/integrantesRemoto";
import {
  assinarInstrumentosRemotos,
  criarInstrumentoRemoto,
  listarInstrumentosRemotos,
} from "@/lib/instrumentosRemoto";
import { MembersManager } from "@/components/MembersManager";
import { InstrumentsManager } from "@/components/InstrumentsManager";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScheduleView } from "@/components/ScheduleView";
import { HistoryView } from "@/components/HistoryView";
import { FormulariosManager } from "@/components/FormulariosManager";
import { FormularioCadastro } from "@/lib/formularios";

type Aba = "principal" | "integrantes" | "instrumentos" | "formularios" | "config" | "escala" | "historico";

const INTEGRANTES_INICIAIS: Integrante[] = [
  { id: uid(), nome: "Felipe", funcoes: ["voz", "violao"] },
  { id: uid(), nome: "Cristiano", funcoes: ["baixo", "bateria"] },
  { id: uid(), nome: "Junior", funcoes: ["baixo", "teclado"] },
  { id: uid(), nome: "Karine", funcoes: ["voz"] },
  { id: uid(), nome: "Maduh", funcoes: ["voz"] },
  { id: uid(), nome: "Leanderson", funcoes: ["voz", "violao"] },
  { id: uid(), nome: "Isaac", funcoes: ["bateria"] },
  { id: uid(), nome: "Daniel", funcoes: ["teclado"] },
];

const hoje = new Date();
const CONFIG_INICIAL: ConfiguracaoEscala = {
  mes: hoje.getMonth() + 1,
  ano: hoje.getFullYear(),
  quantidadeDomingos: 4,
  domingoSolo: null,
  regras: REGRAS_PADRAO,
};

const ABAS: { id: Aba; label: string; icon: typeof Users }[] = [
  { id: "principal", label: "Escala", icon: CalendarDays },
  { id: "integrantes", label: "Integrantes", icon: Users },
  { id: "instrumentos", label: "Instrumentos", icon: Music2 },
  { id: "formularios", label: "Formulários", icon: ClipboardList },
  { id: "config", label: "Configurações", icon: SlidersHorizontal },
  { id: "escala", label: "Gerar escala", icon: CalendarPlus },
  { id: "historico", label: "Histórico", icon: History },
];

export default function Home() {
  // A aba "Escala" (cards das escalas aprovadas) é a principal: o app sempre abre nela.
  const [aba, setAba] = useState<Aba>("principal");
  const [integrantes, setIntegrantes, integrantesCarregados] =
    usePersistedState<Integrante[]>(KEYS.integrantes, INTEGRANTES_INICIAIS);
  const [instrumentos, setInstrumentos, instrumentosCarregados] = usePersistedState<Instrumento[]>(
    KEYS.instrumentos,
    INSTRUMENTOS_PADRAO
  );
  const [config, setConfig] = usePersistedState<ConfiguracaoEscala>(
    KEYS.config,
    CONFIG_INICIAL
  );
  const [historico, setHistorico] = usePersistedState<EscalaSalva[]>(
    KEYS.escalas,
    []
  );
  const [tema, setTema] = usePersistedState<"claro" | "escuro">(
    KEYS.tema,
    "claro"
  );
  const [rascunho, setRascunho] = usePersistedState<RascunhoAtual>(
    KEYS.escalaAtual,
    RASCUNHO_VAZIO
  );

  const auth = useAuth();
  // cadastro vindo da aba Formulários ("Usar como Integrante")
  const [formularioParaImportar, setFormularioParaImportar] =
    useState<FormularioCadastro | null>(null);
  // A aba só aparece para líder/montador (ou enquanto ainda não há login/perfil
  // carregado, para dar acesso ao login). A proteção real está no banco (RLS).
  // Aviso de aniversariantes: só para quem está logado como líder ou montador
  // (sem perfil carregado, não mostra).
  const ehLiderOuMontador =
    auth.supabaseConfigurado &&
    auth.logado &&
    (auth.perfil?.role === "lider" || auth.perfil?.role === "montador");

  const mostrarAbaFormularios =
    auth.supabaseConfigurado &&
    (!auth.logado ||
      !auth.perfil ||
      auth.perfil.role === "lider" ||
      auth.perfil.role === "montador");
  const [remotas, setRemotas] = useState<EscalaRemota[]>([]);
  const [integrantesRemotos, setIntegrantesRemotos] = useState<Integrante[]>([]);
  const [integrantesRemotosCarregados, setIntegrantesRemotosCarregados] = useState(false);
  const [migracaoPronta, setMigracaoPronta] = useState(false);
  const [instrumentosRemotos, setInstrumentosRemotos] = useState<Instrumento[]>([]);
  const [instrumentosRemotosCarregados, setInstrumentosRemotosCarregados] = useState(false);
  const [migracaoInstrumentosPronta, setMigracaoInstrumentosPronta] = useState(false);
  const migracaoInstrumentosFeitaRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  const recarregarRemotas = useCallback(() => {
    if (!auth.logado) return;
    listarEscalasRemotas()
      .then(setRemotas)
      .catch(() => {
        /* silencioso — tela mostra o que já tinha em cache */
      });
  }, [auth.logado]);

  useEffect(() => {
    if (!auth.logado) {
      setRemotas([]);
      return;
    }
    recarregarRemotas();
    const cancelar = assinarEscalasRemotas(recarregarRemotas);
    return cancelar;
  }, [auth.logado, recarregarRemotas]);

  const recarregarIntegrantesRemotos = useCallback(() => {
    if (!auth.logado) return;
    listarIntegrantesRemotos()
      .then((lista) => {
        setIntegrantesRemotos(lista);
        setIntegrantesRemotosCarregados(true);
      })
      .catch(() => {
        // Falha ao ler NÃO pode virar "lista vazia carregada": a migração reenviaria
        // tudo o que está no aparelho e criaria duplicados. Segue com o cache local.
      });
  }, [auth.logado]);

  useEffect(() => {
    if (!auth.logado) {
      setIntegrantesRemotos([]);
      setIntegrantesRemotosCarregados(false);
      setMigracaoPronta(false);
      return;
    }
    recarregarIntegrantesRemotos();
    const cancelar = assinarIntegrantesRemotos(recarregarIntegrantesRemotos);
    return cancelar;
  }, [auth.logado, recarregarIntegrantesRemotos]);

  // Com login, a nuvem é a ÚNICA fonte dos integrantes: o app NÃO reenvia mais para o
  // Supabase o que está guardado no aparelho. Esse reenvio automático recriava
  // cadastros apagados ou renomeados (e os exemplos do app) toda vez que um aparelho
  // com dados antigos abria o app. Integrantes novos só entram pela tela de Integrantes.
  useEffect(() => {
    if (auth.logado && integrantesRemotosCarregados) setMigracaoPronta(true);
  }, [auth.logado, integrantesRemotosCarregados]);

  // Fonte oficial: Supabase quando disponível e a migração já rodou; até lá
  // (ou offline/deslogado), continua mostrando o cache local — evita um
  // "pisca" de lista vazia logo após o login, antes da migração terminar.
  const integrantesEfetivos =
    auth.supabaseConfigurado && auth.logado && migracaoPronta
      ? integrantesRemotos
      : integrantes;

  const recarregarInstrumentosRemotos = useCallback(() => {
    if (!auth.logado) return;
    listarInstrumentosRemotos()
      .then((lista) => {
        setInstrumentosRemotos(lista);
        setInstrumentosRemotosCarregados(true);
      })
      .catch(() => {
        // mesma regra dos integrantes: falha ao ler não vira "lista vazia carregada"
      });
  }, [auth.logado]);

  useEffect(() => {
    if (!auth.logado) {
      setInstrumentosRemotos([]);
      setInstrumentosRemotosCarregados(false);
      setMigracaoInstrumentosPronta(false);
      migracaoInstrumentosFeitaRef.current = false;
      return;
    }
    recarregarInstrumentosRemotos();
    const cancelar = assinarInstrumentosRemotos(recarregarInstrumentosRemotos);
    return cancelar;
  }, [auth.logado, recarregarInstrumentosRemotos]);

  // Mesma migração controlada dos integrantes: só insere no Supabase os
  // instrumentos locais (inclusive os padrão) cujo id ainda não existe lá,
  // e também confere por nome pelo mesmo motivo (evita duplicar "Voz",
  // "Violão" etc. quando um aparelho novo loga pela primeira vez).
  useEffect(() => {
    if (
      !auth.logado ||
      !auth.userId ||
      !instrumentosCarregados ||
      !instrumentosRemotosCarregados ||
      migracaoInstrumentosFeitaRef.current
    ) {
      return;
    }
    migracaoInstrumentosFeitaRef.current = true;
    const chave = chaveMigracao("instrumentos", auth.userId);
    if (decidirMigracao(instrumentosRemotos.length, jaMigrou(chave)) === "pular") {
      marcarMigrou(chave);
      setMigracaoInstrumentosPronta(true);
      return;
    }
    const idsRemotos = new Set(instrumentosRemotos.map((i) => i.id));
    const nomesRemotos = new Set(
      instrumentosRemotos.map((i) => i.nome.trim().toLowerCase())
    );
    const faltantes = instrumentos.filter(
      (i) => !idsRemotos.has(i.id) && !nomesRemotos.has(i.nome.trim().toLowerCase())
    );
    if (faltantes.length === 0) {
      marcarMigrou(chave);
      setMigracaoInstrumentosPronta(true);
      return;
    }
    Promise.all(
      faltantes.map((i) => criarInstrumentoRemoto(i, auth.userId!).catch(() => null))
    ).then(() => {
      marcarMigrou(chave);
      recarregarInstrumentosRemotos();
      setMigracaoInstrumentosPronta(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.logado, auth.userId, instrumentosCarregados, instrumentosRemotosCarregados]);

  const instrumentosEfetivos =
    auth.supabaseConfigurado && auth.logado && migracaoInstrumentosPronta
      ? instrumentosRemotos
      : instrumentos;

  function abrirEscalaDoHistorico(escala: EscalaSalva) {
    setConfig(() => escala.config);
    setRascunho({
      escalaAtualId: escala.id,
      origemRemota: false,
      domingos: escala.domingos,
      domingosOriginais: escala.escalacaoOriginal ?? escala.domingos,
      cultosExtras: escala.cultosExtras ?? [],
    });
    setAba("escala");
  }

  function abrirEscalaRemota(escala: EscalaRemota) {
    if (!escala.payload?.config || !escala.payload?.domingos) {
      window.alert(
        "Essa escala está com dados incompletos e não pode ser aberta."
      );
      return;
    }
    setConfig(() => escala.payload.config);
    setRascunho({
      escalaAtualId: escala.id,
      origemRemota: true,
      domingos: escala.payload.domingos,
      domingosOriginais: escala.payload.escalacaoOriginal ?? escala.payload.domingos,
      cultosExtras: escala.payload.cultosExtras ?? [],
    });
    setAba("escala");
  }

  if (!integrantesCarregados) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <NavegacaoApp
        itens={ABAS.filter(({ id }) => id !== "formularios" || mostrarAbaFormularios)}
        ativo={aba}
        principais={["principal", "escala", "integrantes", "formularios"]}
        onSelecionar={(id) => setAba(id as Aba)}
        tema={tema}
        onAlternarTema={() => setTema((t) => (t === "claro" ? "escuro" : "claro"))}
      />

      <main className="max-w-3xl mx-auto px-4 pt-2 pb-28">
        {ehLiderOuMontador && <AniversariantesAviso integrantes={integrantesEfetivos} />}
        {aba === "principal" && (
          <EscalaPrincipal
            integrantes={integrantesEfetivos}
            instrumentos={instrumentosEfetivos}
            historico={historico}
            remotas={remotas}
            logado={auth.logado}
          />
        )}
        {aba === "integrantes" && (
          <MembersManager
            integrantes={integrantesEfetivos}
            setIntegrantes={setIntegrantes}
            instrumentos={instrumentosEfetivos}
            historico={historico}
            auth={auth}
            formularioParaImportar={formularioParaImportar}
            onFormularioImportado={() => setFormularioParaImportar(null)}
          />
        )}
        {aba === "instrumentos" && (
          <InstrumentsManager
            instrumentos={instrumentosEfetivos}
            setInstrumentos={setInstrumentos}
            auth={auth}
          />
        )}
        {aba === "formularios" && (
          <FormulariosManager
            auth={auth}
            onUsarComoIntegrante={(f) => {
              setFormularioParaImportar(f);
              setAba("integrantes");
            }}
          />
        )}
        {aba === "config" && (
          <SettingsPanel config={config} setConfig={setConfig} />
        )}
        {aba === "escala" && (
          <ScheduleView
            integrantes={integrantesEfetivos}
            instrumentos={instrumentosEfetivos}
            config={config}
            setConfig={setConfig}
            historico={historico}
            setHistorico={setHistorico}
            rascunho={rascunho}
            setRascunho={setRascunho}
            remotas={remotas}
            auth={auth}
          />
        )}
        {aba === "historico" && (
          <HistoryView
            historico={historico}
            setHistorico={setHistorico}
            onAbrirLocal={abrirEscalaDoHistorico}
            onAbrirRemota={abrirEscalaRemota}
            escalaAtualId={rascunho.escalaAtualId}
            remotas={remotas}
            auth={auth}
          />
        )}
      </main>
    </div>
  );
}

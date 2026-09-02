"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  SlidersHorizontal,
  CalendarDays,
  History,
  Moon,
  Sun,
  Music,
  Music2,
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
import { useAuth } from "@/lib/useAuth";
import {
  assinarEscalasRemotas,
  EscalaRemota,
  listarEscalasRemotas,
} from "@/lib/escalasRemoto";
import { MembersManager } from "@/components/MembersManager";
import { InstrumentsManager } from "@/components/InstrumentsManager";
import { SettingsPanel } from "@/components/SettingsPanel";
import { ScheduleView } from "@/components/ScheduleView";
import { HistoryView } from "@/components/HistoryView";

type Aba = "integrantes" | "instrumentos" | "config" | "escala" | "historico";

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
  { id: "integrantes", label: "Integrantes", icon: Users },
  { id: "instrumentos", label: "Instrumentos", icon: Music2 },
  { id: "config", label: "Configurações", icon: SlidersHorizontal },
  { id: "escala", label: "Escala", icon: CalendarDays },
  { id: "historico", label: "Histórico", icon: History },
];

export default function Home() {
  const [aba, setAba] = usePersistedState<Aba>("louvor:aba", "escala");
  const [integrantes, setIntegrantes, integrantesCarregados] =
    usePersistedState<Integrante[]>(KEYS.integrantes, INTEGRANTES_INICIAIS);
  const [instrumentos, setInstrumentos] = usePersistedState<Instrumento[]>(
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
  const [remotas, setRemotas] = useState<EscalaRemota[]>([]);

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
      <header className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/90 backdrop-blur no-print">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[hsl(var(--primary))]/15 flex items-center justify-center">
              <Music className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">
                Gerador de Escalas
              </p>
              <p className="text-xs text-[hsl(var(--muted))] leading-tight">
                de Louvor
              </p>
            </div>
          </div>
          <button
            onClick={() => setTema((t) => (t === "claro" ? "escuro" : "claro"))}
            className="p-2 rounded-xl hover:bg-[hsl(var(--border))]/40"
            aria-label="Alternar tema"
          >
            {tema === "claro" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>
        </div>
        <nav className="max-w-3xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                aba === id
                  ? "bg-[hsl(var(--primary))] text-white"
                  : "hover:bg-[hsl(var(--border))]/40 text-[hsl(var(--foreground))]"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {aba === "integrantes" && (
          <MembersManager
            integrantes={integrantes}
            setIntegrantes={setIntegrantes}
            instrumentos={instrumentos}
          />
        )}
        {aba === "instrumentos" && (
          <InstrumentsManager
            instrumentos={instrumentos}
            setInstrumentos={setInstrumentos}
          />
        )}
        {aba === "config" && (
          <SettingsPanel config={config} setConfig={setConfig} />
        )}
        {aba === "escala" && (
          <ScheduleView
            integrantes={integrantes}
            instrumentos={instrumentos}
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

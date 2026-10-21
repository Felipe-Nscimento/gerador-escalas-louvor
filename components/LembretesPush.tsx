"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  ativarLembretes,
  desativarLembretes,
  EstadoLembretes,
  estadoDosLembretes,
  ModoLembretes,
} from "@/lib/notificacoes";

/**
 * Lembretes no celular, em versão compacta: um sino que liga/desliga os avisos e um "?" que abre
 * a explicação num balão (por cima da tela, sem ocupar espaço). Na semana em que a pessoa estiver
 * escalado, chega uma notificação lembrando da escala e de estudar as músicas.
 */
export function LembretesPush({ modo }: { modo: ModoLembretes }) {
  const [estado, setEstado] = useState<EstadoLembretes | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [deslocamento, setDeslocamento] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ativo = true;
    estadoDosLembretes()
      .then((e) => ativo && setEstado(e))
      .catch(() => ativo && setEstado("indisponivel"));
    return () => {
      ativo = false;
    };
  }, []);

  // fecha o balão ao tocar fora ou com Esc
  useEffect(() => {
    if (!aberto) return;
    function aoTocar(e: PointerEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("pointerdown", aoTocar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("pointerdown", aoTocar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  // mantém o balão dentro da tela, mesmo em celulares estreitos
  useLayoutEffect(() => {
    if (!aberto || !painel.current) {
      setDeslocamento(0);
      return;
    }
    const r = painel.current.getBoundingClientRect();
    const folga = 8;
    let d = 0;
    if (r.right > window.innerWidth - folga) d = window.innerWidth - folga - r.right;
    if (r.left + d < folga) d = folga - r.left;
    setDeslocamento(d);
  }, [aberto]);

  // confirmação rápida (some sozinha, sem mexer no layout)
  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  if (estado === null || estado === "indisponivel") return null;

  async function alternar() {
    if (ocupado) return;
    // iPhone sem instalar / notificações bloqueadas: o sino só mostra a explicação do que fazer
    if (estado === "ios_instalar" || estado === "bloqueado") {
      setAberto(true);
      return;
    }
    setOcupado(true);
    setErro(null);
    if (estado === "ativo") {
      await desativarLembretes(modo).catch(() => {});
      setAviso("Lembretes desativados");
    } else {
      const r = await ativarLembretes(modo);
      if (r.ok) setAviso("Lembretes ativados");
      else {
        setErro(r.mensagem);
        setAberto(true);
      }
    }
    setEstado(await estadoDosLembretes().catch(() => "desativado" as const));
    setOcupado(false);
  }

  const rotuloSino =
    estado === "ativo"
      ? "Lembretes ativados. Toque para desativar"
      : estado === "desativado"
        ? "Lembretes desativados. Toque para ativar"
        : "Lembretes no celular";

  return (
    <div ref={raiz} className="no-print relative inline-flex items-center gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={ocupado}
        aria-pressed={estado === "ativo"}
        aria-label={rotuloSino}
        title={rotuloSino}
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
          estado === "ativo"
            ? "bg-[hsl(var(--accent))]/15 text-[hsl(var(--accent))]"
            : "text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/50"
        } ${ocupado ? "animate-pulse" : ""}`}
      >
        {estado === "ativo" ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
      </button>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-label="O que são os lembretes?"
        title="O que são os lembretes?"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-[hsl(var(--border))] text-xs font-bold text-[hsl(var(--muted))] hover:bg-[hsl(var(--border))]/50"
      >
        ?
      </button>

      {aviso && !aberto && (
        <span
          role="status"
          className="absolute left-0 top-full z-30 mt-1 whitespace-nowrap rounded-full bg-[hsl(var(--foreground))] px-3 py-1 text-xs font-medium text-[hsl(var(--background))] shadow"
        >
          {aviso}
        </span>
      )}

      {aberto && (
        <div
          ref={painel}
          role="dialog"
          aria-label="Lembretes no celular"
          style={deslocamento ? { transform: `translateX(${deslocamento}px)` } : undefined}
          className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 text-sm font-normal shadow-lg"
        >
          <p className="font-semibold">Lembretes no celular</p>
          <p className="mt-1 text-[hsl(var(--muted))]">
            Receba um aviso na semana em que você estiver escalado, lembrando da escala e de estudar as músicas.
          </p>

          {estado === "desativado" && (
            <p className="mt-2 text-[hsl(var(--muted))]">Toque no sino para ativar neste aparelho.</p>
          )}
          {estado === "ativo" && (
            <p className="mt-2 text-[hsl(var(--muted))]">
              Ativados neste aparelho. Toque no sino para desativar.
            </p>
          )}
          {estado === "ios_instalar" && (
            <p className="mt-2 text-[hsl(var(--muted))]">
              No iPhone, primeiro toque em Compartilhar e em &quot;Adicionar à Tela de Início&quot;. Depois abra o app
              pelo ícone e volte aqui para ativar.
            </p>
          )}
          {estado === "bloqueado" && (
            <p className="mt-2 text-[hsl(var(--muted))]">
              As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador (ou do app) e
              volte aqui.
            </p>
          )}
          {erro && (
            <p role="alert" className="mt-2 text-red-500">
              {erro}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

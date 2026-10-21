"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import {
  ativarLembretes,
  desativarLembretes,
  EstadoLembretes,
  estadoDosLembretes,
  ModoLembretes,
} from "@/lib/notificacoes";

/**
 * Cartão para ligar/desligar os lembretes no celular: na semana em que o integrante estiver
 * escalado, chega uma notificação lembrando da escala e de estudar as músicas.
 */
export function LembretesPush({ modo }: { modo: ModoLembretes }) {
  const [estado, setEstado] = useState<EstadoLembretes | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    estadoDosLembretes()
      .then((e) => ativo && setEstado(e))
      .catch(() => ativo && setEstado("indisponivel"));
    return () => {
      ativo = false;
    };
  }, []);

  if (estado === null || estado === "indisponivel") return null;

  async function ativar() {
    setOcupado(true);
    setErro(null);
    const r = await ativarLembretes(modo);
    if (!r.ok) setErro(r.mensagem);
    setEstado(await estadoDosLembretes().catch(() => "desativado" as const));
    setOcupado(false);
  }

  async function desativar() {
    setOcupado(true);
    setErro(null);
    await desativarLembretes(modo).catch(() => {});
    setEstado(await estadoDosLembretes().catch(() => "desativado" as const));
    setOcupado(false);
  }

  return (
    <section
      aria-label="Lembretes no celular"
      className="no-print mb-4 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
          {estado === "ativo" ? (
            <Bell className="h-5 w-5 text-[hsl(var(--accent))]" />
          ) : (
            <BellOff className="h-5 w-5 text-[hsl(var(--muted))]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">Lembretes no celular</p>

          {estado === "ios_instalar" && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">
              No iPhone, primeiro toque em Compartilhar e em &quot;Adicionar à Tela de Início&quot;. Depois abra o app
              pelo ícone e volte aqui para ativar os lembretes.
            </p>
          )}
          {estado === "bloqueado" && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">
              As notificações estão bloqueadas neste aparelho. Libere nas configurações do navegador (ou do app) e volte
              aqui.
            </p>
          )}
          {estado === "desativado" && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">
              Receba um aviso na semana em que você estiver escalado, lembrando da escala e de estudar as músicas.
            </p>
          )}
          {estado === "ativo" && (
            <p className="mt-0.5 text-sm text-[hsl(var(--muted))]">
              Ativados neste aparelho. Você será avisado na semana em que estiver escalado.
            </p>
          )}

          {erro && (
            <p role="alert" className="mt-2 text-sm text-red-500">
              {erro}
            </p>
          )}

          {estado === "desativado" && (
            <button
              type="button"
              onClick={ativar}
              disabled={ocupado}
              className="mt-3 rounded-full bg-[hsl(var(--primary))] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {ocupado ? "Ativando…" : "Ativar lembretes"}
            </button>
          )}
          {estado === "ativo" && (
            <button
              type="button"
              onClick={desativar}
              disabled={ocupado}
              className="mt-3 rounded-full border border-[hsl(var(--border))] px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {ocupado ? "Desativando…" : "Desativar neste aparelho"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

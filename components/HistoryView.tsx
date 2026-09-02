"use client";

import {
  Copy,
  Trash2,
  FolderOpen,
  History as HistoryIcon,
  ShieldCheck,
  Clock,
  LogOut,
  Cloud,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { AuthForm } from "./auth/AuthForm";
import { EscalaSalva, STATUS_LABEL } from "@/lib/types";
import { MESES } from "@/lib/whatsapp";
import { uid } from "@/lib/storage";
import { EscalaRemota, excluirEscalaRemota } from "@/lib/escalasRemoto";
import { useAuth } from "@/lib/useAuth";

interface Props {
  historico: EscalaSalva[];
  setHistorico: (fn: (prev: EscalaSalva[]) => EscalaSalva[]) => void;
  onAbrirLocal: (escala: EscalaSalva) => void;
  onAbrirRemota: (escala: EscalaRemota) => void;
  escalaAtualId: string | null;
  remotas: EscalaRemota[];
  auth: ReturnType<typeof useAuth>;
}

function mesAnoDaRemota(r: EscalaRemota): string {
  const config = r.payload?.config;
  if (!config || !config.mes || !config.ano) return "Dados incompletos";
  return `${MESES[config.mes - 1]}/${config.ano}`;
}

function payloadValido(r: EscalaRemota): boolean {
  return Boolean(r.payload?.config && r.payload?.domingos);
}

function statusCor(status: EscalaSalva["status"]) {
  if (status === "aprovada") return "bg-emerald-500/10 text-emerald-500";
  if (status === "devolvida") return "bg-red-500/10 text-red-500";
  if (status === "publicada") return "bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]";
  return "bg-amber-400/10 text-amber-500";
}

export function HistoryView({
  historico,
  setHistorico,
  onAbrirLocal,
  onAbrirRemota,
  escalaAtualId,
  remotas,
  auth,
}: Props) {
  function excluirLocal(id: string) {
    setHistorico((prev) => prev.filter((e) => e.id !== id));
  }

  function duplicarLocal(escala: EscalaSalva) {
    setHistorico((prev) => [
      ...prev,
      {
        ...escala,
        id: uid(),
        criadoEm: new Date().toISOString(),
        atualizadoEm: undefined,
        status: "rascunho",
        motivoDevolucao: undefined,
      },
    ]);
  }

  async function excluirRemota(id: string) {
    try {
      await excluirEscalaRemota(id);
    } catch {
      // a lista atualiza sozinha via realtime; se a exclusão falhar (RLS),
      // a linha simplesmente continua aparecendo
    }
  }

  const ordenadoLocal = [...historico].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Histórico</h2>
        <p className="text-sm text-[hsl(var(--muted))]">
          Escalas salvas neste aparelho e escalas enviadas para aprovação remota.
        </p>
      </div>

      {/* Bloco de aprovação remota */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cloud className="h-4 w-4 text-[hsl(var(--muted))]" />
          <h3 className="font-medium text-sm">Aprovação remota</h3>
        </div>

        {!auth.supabaseConfigurado && (
          <Card>
            <CardContent className="pt-5 text-sm text-[hsl(var(--muted))]">
              Não configurado. Veja o README do projeto para conectar um
              projeto Supabase e permitir que o líder aprove de qualquer
              aparelho.
            </CardContent>
          </Card>
        )}

        {auth.supabaseConfigurado && !auth.logado && !auth.carregando && (
          <AuthForm />
        )}

        {auth.supabaseConfigurado && auth.logado && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[hsl(var(--muted))]">
                {auth.email} {auth.ehLider && "· líder"}
              </p>
              <button
                onClick={auth.sair}
                className="text-xs text-[hsl(var(--muted))] hover:underline flex items-center gap-1"
              >
                <LogOut className="h-3 w-3" /> Sair
              </button>
            </div>

            {remotas.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-sm text-[hsl(var(--muted))]">
                  Nenhuma escala enviada ainda. Monte uma na aba Escala e use
                  "Enviar para o líder".
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {remotas.map((r) => (
                  <Card
                    key={r.id}
                    className={r.id === escalaAtualId ? "border-[hsl(var(--primary))]/50" : ""}
                  >
                    <CardContent className="pt-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{mesAnoDaRemota(r)}</p>
                        <span
                          className={`text-xs rounded-full px-2.5 py-0.5 flex items-center gap-1 ${statusCor(
                            r.status
                          )}`}
                        >
                          {r.status === "aprovada" ? (
                            <ShieldCheck className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {STATUS_LABEL[r.status]}
                        </span>
                      </div>
                      {!payloadValido(r) && (
                        <p className="text-xs text-red-500">
                          Esta escala está com dados incompletos e não pode ser
                          aberta — pode excluir com segurança.
                        </p>
                      )}
                      <p className="text-xs text-[hsl(var(--muted))]">
                        Enviada em{" "}
                        {new Date(r.created_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {r.created_by === auth.userId && " · por você"}
                      </p>
                      {r.motivo_devolucao && r.status === "devolvida" && (
                        <p className="text-xs text-red-500">
                          Motivo: {r.motivo_devolucao}
                        </p>
                      )}
                      <div className="flex gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onAbrirRemota(r)}
                          disabled={!payloadValido(r)}
                        >
                          <FolderOpen className="h-3.5 w-3.5" /> Abrir
                        </Button>
                        {(r.created_by === auth.userId || auth.ehLider) && (
                          <Button size="sm" variant="danger" onClick={() => excluirRemota(r.id)}>
                            <Trash2 className="h-3.5 w-3.5" /> Excluir
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Rascunhos locais */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-[hsl(var(--muted))]" />
          <h3 className="font-medium text-sm">Rascunhos neste aparelho</h3>
        </div>

        {ordenadoLocal.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-sm text-[hsl(var(--muted))]">
              Nenhum rascunho local ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {ordenadoLocal.map((e) => (
              <Card
                key={e.id}
                className={e.id === escalaAtualId ? "border-[hsl(var(--primary))]/50" : ""}
              >
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">
                      {MESES[e.config.mes - 1]}/{e.config.ano}
                    </p>
                    <span
                      className={`text-xs rounded-full px-2.5 py-0.5 flex items-center gap-1 ${statusCor(
                        e.status
                      )}`}
                    >
                      {e.status === "aprovada" ? (
                        <ShieldCheck className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {STATUS_LABEL[e.status]}
                    </span>
                  </div>
                  <p className="text-xs text-[hsl(var(--muted))]">
                    Salvo em{" "}
                    {new Date(e.criadoEm).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex gap-2 pt-1 flex-wrap">
                    <Button size="sm" variant="secondary" onClick={() => onAbrirLocal(e)}>
                      <FolderOpen className="h-3.5 w-3.5" /> Abrir
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => duplicarLocal(e)}>
                      <Copy className="h-3.5 w-3.5" /> Duplicar
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => excluirLocal(e.id)}>
                      <Trash2 className="h-3.5 w-3.5" /> Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

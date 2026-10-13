"use client";

import Link from "next/link";
import { LogOut, Music } from "lucide-react";
import { AuthForm } from "@/components/auth/AuthForm";
import { BotaoTema } from "@/components/BotaoTema";
import { Tema } from "@/lib/useTema";

function Moldura({
  tema,
  onAlternarTema,
  children,
}: {
  tema: Tema;
  onAlternarTema: () => void;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen px-4 py-6">
      <div className="max-w-md mx-auto">
        <div className="flex justify-end">
          <BotaoTema tema={tema} onClick={onAlternarTema} />
        </div>
        <div className="mt-2 text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
            <Music className="h-6 w-6 text-[hsl(var(--accent))]" />
          </div>
          <h1 className="mt-3 text-xl font-semibold">Gerador de Escalas de Louvor</h1>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
      </div>
    </main>
  );
}

function LinkIntegrante() {
  return (
    <p className="text-center text-sm text-[hsl(var(--muted))]">
      É integrante da equipe?{" "}
      <Link href="/escala" className="font-semibold text-[hsl(var(--primary))] underline">
        Ver a escala
      </Link>
    </p>
  );
}

/** Tela inicial para quem não fez login (Líder e Montador entram por aqui). */
export function TelaLogin({ tema, onAlternarTema }: { tema: Tema; onAlternarTema: () => void }) {
  return (
    <Moldura tema={tema} onAlternarTema={onAlternarTema}>
      <p className="text-center text-sm text-[hsl(var(--muted))]">
        Acesso de Líder e Montador. Entre com o e-mail que está cadastrado em Integrantes.
      </p>
      <AuthForm />
      <LinkIntegrante />
    </Moldura>
  );
}

/** Login feito, mas o e-mail não está cadastrado como Líder ou Montador. */
export function TelaSemAcesso({
  email,
  tema,
  onAlternarTema,
  onSair,
}: {
  email: string | null;
  tema: Tema;
  onAlternarTema: () => void;
  onSair: () => void;
}) {
  return (
    <Moldura tema={tema} onAlternarTema={onAlternarTema}>
      <div className="rounded-2xl bg-[hsl(var(--card))] p-5 shadow-sm space-y-3 text-center">
        <p className="font-semibold">Acesso não autorizado</p>
        <p className="text-sm text-[hsl(var(--muted))]">
          O e-mail <span className="font-medium text-[hsl(var(--foreground))]">{email ?? "do seu login"}</span> não
          está cadastrado como Líder ou Montador. Peça ao líder para cadastrar esse e-mail em Integrantes, ou confira
          se você confirmou o e-mail da sua conta.
        </p>
        <button
          type="button"
          onClick={onSair}
          className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(var(--border))] px-4 py-2 text-sm font-semibold hover:bg-[hsl(var(--border))]/40"
        >
          <LogOut className="h-4 w-4" /> Sair e entrar com outro e-mail
        </button>
      </div>
      <LinkIntegrante />
    </Moldura>
  );
}

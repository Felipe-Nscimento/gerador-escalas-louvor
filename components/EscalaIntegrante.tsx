"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LogOut, Music } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { EscalaPrincipal } from "@/components/EscalaPrincipal";
import {
  DadosAcessoIntegrante,
  entrarComoIntegrante,
  lerCache,
  lerCredenciais,
  MOTIVOS_ACESSO,
  normalizarSenha,
  sairDoAcesso,
  salvarCache,
  salvarCredenciais,
} from "@/lib/acessoIntegrante";
import { EscalaSalva } from "@/lib/types";

/**
 * Página /escala: o integrante vê SOMENTE a aba Escala. Entra com o nome e, como senha,
 * a data de aniversário só com números (ddmmaaaa). O banco confere nome + senha e devolve
 * apenas o que os cards precisam.
 */
export function EscalaIntegrante() {
  const [fase, setFase] = useState<"carregando" | "login" | "pronto">("carregando");
  const [dados, setDados] = useState<DadosAcessoIntegrante | null>(null);
  const [offline, setOffline] = useState(false);
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async (n: string, s: string, silencioso: boolean) => {
    const r = await entrarComoIntegrante(n, s);
    if (r.ok) {
      setDados(r.dados);
      setOffline(false);
      setFase("pronto");
      salvarCache(r.dados);
      return true;
    }
    if (r.motivo === "sem_conexao") {
      // sem internet: mostra a última escala salva neste aparelho, se houver
      const cache = lerCache();
      if (cache) {
        setDados(cache);
        setOffline(true);
        setFase("pronto");
        return true;
      }
    } else if (r.motivo === "credenciais_invalidas" || r.motivo === "dados_invalidos") {
      sairDoAcesso();
    }
    if (!silencioso) setErro(MOTIVOS_ACESSO[r.motivo] ?? "Não foi possível entrar. Tente de novo.");
    setFase("login");
    return false;
  }, []);

  useEffect(() => {
    const salvas = lerCredenciais();
    if (!salvas) {
      setFase("login");
      return;
    }
    setNome(salvas.nome);
    carregar(salvas.nome, salvas.senha, false);
  }, [carregar]);

  // ao voltar para o app, busca a escala mais recente
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState !== "visible") return;
      const salvas = lerCredenciais();
      if (salvas) carregar(salvas.nome, salvas.senha, true);
    }
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [carregar]);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    setEnviando(true);
    const ok = await carregar(nome, senha, false);
    if (ok) salvarCredenciais(nome.trim(), senha);
    setEnviando(false);
  }

  function sair() {
    sairDoAcesso();
    setDados(null);
    setSenha("");
    setErro(null);
    setFase("login");
  }

  if (fase === "carregando") {
    return <p className="p-8 text-center text-[hsl(var(--muted))]">Carregando…</p>;
  }

  if (fase === "login" || !dados) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-8">
        <form
          onSubmit={entrar}
          className="w-full max-w-sm rounded-3xl bg-[hsl(var(--card))] p-6 shadow-sm space-y-4"
        >
          <div className="text-center">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-[hsl(var(--accent))]/15 flex items-center justify-center">
              <Music className="h-6 w-6 text-[hsl(var(--accent))]" />
            </div>
            <h1 className="mt-3 text-xl font-semibold">Escala do Louvor</h1>
            <p className="text-sm text-[hsl(var(--muted))]">Entre para ver a escala da equipe.</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="acesso-nome">
              Seu nome
            </label>
            <Input
              id="acesso-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Daniel"
              autoComplete="name"
              maxLength={80}
              className="py-3 text-base"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block" htmlFor="acesso-senha">
              Senha
            </label>
            <Input
              id="acesso-senha"
              type="password"
              inputMode="numeric"
              value={senha}
              onChange={(e) => setSenha(normalizarSenha(e.target.value).slice(0, 8))}
              placeholder="Data de aniversário: ddmmaaaa"
              autoComplete="current-password"
              maxLength={8}
              className="py-3 text-base"
            />
            <p className="mt-1 text-xs text-[hsl(var(--muted))]">
              Sua data de aniversário só com números. Ex.: 15/10/1990 vira 15101990.
            </p>
          </div>

          {erro && (
            <div role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {erro}
            </div>
          )}

          <Button type="submit" className="w-full py-3 text-base" disabled={enviando || !nome.trim() || senha.length !== 8}>
            {enviando ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </main>
    );
  }

  // escalas "enxutas" do banco no formato que a aba Escala já sabe desenhar
  const historico = dados.escalas.map((e) => ({
    id: e.id,
    status: "aprovada",
    criadoEm: e.atualizadoEm,
    atualizadoEm: e.atualizadoEm,
    domingos: e.domingos,
    cultosExtras: e.cultosExtras,
  })) as unknown as EscalaSalva[];

  return (
    <main className="max-w-3xl mx-auto px-4 py-4 pb-10">
      <header className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="text-sm text-[hsl(var(--muted))] leading-tight">Olá,</p>
          <p className="text-lg font-semibold leading-tight truncate">{dados.nome}</p>
        </div>
        <button
          type="button"
          onClick={sair}
          className="flex items-center gap-1.5 rounded-full bg-[hsl(var(--card))] px-4 py-2 text-sm font-semibold shadow-sm"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </header>

      {offline && (
        <p className="mb-3 rounded-xl bg-amber-400/10 px-3 py-2 text-sm text-amber-600">
          Sem conexão. Mostrando a última escala salva neste aparelho.
        </p>
      )}

      <EscalaPrincipal
        integrantes={dados.integrantes}
        instrumentos={dados.instrumentos}
        historico={historico}
        remotas={[]}
        logado={false}
        ordemFuncoes={dados.ordemFuncoes}
      />
    </main>
  );
}

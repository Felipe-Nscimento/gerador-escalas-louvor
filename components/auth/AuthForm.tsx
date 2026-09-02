"use client";

import { useState } from "react";
import { LogIn, UserPlus } from "lucide-react";
import { Button } from "../ui/Button";
import { Card, CardContent } from "../ui/Card";
import { Input } from "../ui/Input";
import { supabase } from "@/lib/supabase";

export function AuthForm() {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    if (!supabase || !email.trim() || !senha) return;
    setCarregando(true);
    setErro(null);
    setMensagem(null);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: senha,
        });
        if (error) throw error;
        setMensagem(
          "Conta criada! Se a confirmação por e-mail estiver ativada no seu projeto Supabase, confira sua caixa de entrada antes de entrar."
        );
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div>
          <h3 className="font-medium">
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </h3>
          <p className="text-sm text-[hsl(var(--muted))]">
            Necessário para enviar e aprovar escalas remotamente.
          </p>
        </div>
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && enviar()}
          />
        </div>
        {erro && <p className="text-sm text-red-500">{erro}</p>}
        {mensagem && (
          <p className="text-sm text-emerald-500">{mensagem}</p>
        )}
        <Button
          onClick={enviar}
          disabled={carregando || !email.trim() || !senha}
          className="w-full"
        >
          {modo === "entrar" ? (
            <>
              <LogIn className="h-4 w-4" /> Entrar
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" /> Criar conta
            </>
          )}
        </Button>
        <button
          onClick={() => setModo((m) => (m === "entrar" ? "cadastrar" : "entrar"))}
          className="text-xs text-[hsl(var(--muted))] hover:underline w-full text-center"
        >
          {modo === "entrar"
            ? "Ainda não tem conta? Criar uma"
            : "Já tem conta? Entrar"}
        </button>
      </CardContent>
    </Card>
  );
}

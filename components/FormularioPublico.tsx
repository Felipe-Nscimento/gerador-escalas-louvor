"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Music, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { FormularioCadastroForm, FotoAcao } from "./FormularioCadastroForm";
import { supabaseConfigurado } from "@/lib/supabase";
import {
  buscarFormularioPublico,
  enviarFormularioPublico,
  enviarFotoFormulario,
  InstrumentoPublico,
} from "@/lib/formulariosRemoto";
import { DadosFormulario, mensagemErro, mensagemMotivoPublico } from "@/lib/formularios";

type Estado =
  | { tipo: "carregando" }
  | { tipo: "erro"; mensagem: string; podeTentarDeNovo?: boolean }
  | { tipo: "formulario"; formularioId: string; instrumentos: InstrumentoPublico[] }
  | { tipo: "enviado" };

export function FormularioPublico({ token }: { token: string }) {
  const [estado, setEstado] = useState<Estado>({ tipo: "carregando" });
  // se o envio falhar depois do upload, a nova tentativa reaproveita a mesma foto (sem arquivo órfão)
  const fotoEnviadaRef = useRef<{ blob: Blob; caminho: string } | null>(null);

  async function carregar() {
    setEstado({ tipo: "carregando" });
    if (!supabaseConfigurado) {
      setEstado({ tipo: "erro", mensagem: "Este formulário está indisponível no momento." });
      return;
    }
    try {
      const info = await buscarFormularioPublico(token);
      if (!info.ok) {
        setEstado({ tipo: "erro", mensagem: mensagemMotivoPublico(info.motivo) });
        return;
      }
      setEstado({ tipo: "formulario", formularioId: info.formularioId, instrumentos: info.instrumentos });
    } catch (e) {
      setEstado({
        tipo: "erro",
        mensagem: mensagemErro(e, "Não foi possível abrir o formulário agora. Tente novamente em instantes."),
        podeTentarDeNovo: true,
      });
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function enviar(dados: DadosFormulario, foto: FotoAcao) {
    if (estado.tipo !== "formulario") return;
    let fotoPath: string | null = null;
    if (foto.tipo === "nova") {
      try {
        if (fotoEnviadaRef.current?.blob === foto.foto.blob) {
          fotoPath = fotoEnviadaRef.current.caminho;
        } else {
          fotoPath = await enviarFotoFormulario(estado.formularioId, foto.foto);
          fotoEnviadaRef.current = { blob: foto.foto.blob, caminho: fotoPath };
        }
      } catch (e) {
        throw new Error(
          mensagemErro(e, "Não foi possível enviar a foto. Tente de novo ou envie o cadastro sem foto.")
        );
      }
    }
    let resultado;
    try {
      resultado = await enviarFormularioPublico(token, dados, fotoPath);
    } catch (e) {
      throw new Error(mensagemErro(e, "Não foi possível enviar seu cadastro. Tente novamente."));
    }
    if (!resultado.ok) {
      // link já usado/expirado: não adianta tentar de novo
      if (["ja_enviado", "expirado", "invalido"].includes(resultado.motivo)) {
        setEstado({ tipo: "erro", mensagem: mensagemMotivoPublico(resultado.motivo) });
        return;
      }
      throw new Error(mensagemMotivoPublico(resultado.motivo));
    }
    setEstado({ tipo: "enviado" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-[hsl(var(--primary))]/15 flex items-center justify-center">
            <Music className="h-4 w-4 text-[hsl(var(--primary))]" />
          </div>
          <p className="text-sm font-semibold">Equipe de Louvor</p>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-12">
        {estado.tipo === "carregando" && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-[hsl(var(--muted))]">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando formulário...
          </div>
        )}

        {estado.tipo === "erro" && (
          <Card>
            <CardContent className="pt-6 pb-6 text-center space-y-3">
              <TriangleAlert className="h-10 w-10 mx-auto text-amber-500" />
              <p className="font-semibold">Não foi possível abrir o formulário</p>
              <p className="text-sm text-[hsl(var(--muted))]">{estado.mensagem}</p>
              {estado.podeTentarDeNovo && (
                <Button variant="secondary" onClick={carregar}>
                  Tentar novamente
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {estado.tipo === "enviado" && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center space-y-3">
              <CheckCircle2 className="h-14 w-14 mx-auto text-emerald-500" />
              <p className="text-xl font-semibold">Cadastro enviado com sucesso!</p>
              <p className="text-sm text-[hsl(var(--muted))]">
                Obrigado! Suas informações foram enviadas para a equipe.
              </p>
            </CardContent>
          </Card>
        )}

        {estado.tipo === "formulario" && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-semibold">Cadastro da equipe de louvor</h1>
              <p className="text-sm text-[hsl(var(--muted))] mt-1">
                Preencha seus dados abaixo. Só o nome é obrigatório.
              </p>
            </div>
            <Card>
              <CardContent className="pt-5 pb-5">
                <FormularioCadastroForm
                  grande
                  instrumentos={estado.instrumentos}
                  rotuloEnviar="Enviar cadastro"
                  onEnviar={enviar}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

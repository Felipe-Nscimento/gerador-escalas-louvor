"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Music2 } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { Instrumento } from "@/lib/types";
import { uid } from "@/lib/storage";

interface Props {
  instrumentos: Instrumento[];
  setInstrumentos: (fn: (prev: Instrumento[]) => Instrumento[]) => void;
}

const EMOJIS_SUGERIDOS = ["🎤", "🎸", "🎹", "🥁", "🎻", "🎷", "🪕", "🪘", "🎺", "🎵"];

export function InstrumentsManager({ instrumentos, setInstrumentos }: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [emoji, setEmoji] = useState("🎵");
  const [obrigatorio, setObrigatorio] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);

  function iniciarNovo() {
    setEditandoId(null);
    setNome("");
    setEmoji("🎵");
    setObrigatorio(false);
    setMostrarForm(true);
  }

  function iniciarEdicao(inst: Instrumento) {
    setEditandoId(inst.id);
    setNome(inst.nome);
    setEmoji(inst.emoji);
    setObrigatorio(inst.obrigatorio);
    setMostrarForm(true);
  }

  function salvar() {
    if (!nome.trim()) return;
    if (editandoId) {
      setInstrumentos((prev) =>
        prev.map((i) =>
          i.id === editandoId
            ? { ...i, nome: nome.trim(), emoji: emoji || "🎵", obrigatorio }
            : i
        )
      );
    } else {
      setInstrumentos((prev) => [
        ...prev,
        { id: uid(), nome: nome.trim(), emoji: emoji || "🎵", obrigatorio },
      ]);
    }
    setMostrarForm(false);
  }

  function excluir(id: string) {
    setInstrumentos((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Instrumentos</h2>
          <p className="text-sm text-[hsl(var(--muted))]">
            Funções que os integrantes podem exercer na escala.
          </p>
        </div>
        <Button onClick={iniciarNovo}>
          <Plus className="h-4 w-4" /> Novo instrumento
        </Button>
      </div>

      {mostrarForm && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editandoId ? "Editar instrumento" : "Novo instrumento"}
              </h3>
              <button onClick={() => setMostrarForm(false)}>
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
            <div className="grid grid-cols-[1fr,auto] gap-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Nome</label>
                <Input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Percussão, Segunda voz, Violino"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Emoji</label>
                <Input
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="w-16 text-center"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS_SUGERIDOS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className="h-8 w-8 rounded-lg border border-[hsl(var(--border))] hover:bg-[hsl(var(--border))]/40 flex items-center justify-center"
                >
                  {e}
                </button>
              ))}
            </div>
            <Checkbox
              label="Obrigatório em todo culto (a geração automática sempre tenta preencher)"
              checked={obrigatorio}
              onChange={() => setObrigatorio((v) => !v)}
            />
            <Button onClick={salvar} className="w-full">
              Salvar instrumento
            </Button>
          </CardContent>
        </Card>
      )}

      {instrumentos.length === 0 && !mostrarForm && (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2 text-[hsl(var(--muted))]">
            <Music2 className="h-8 w-8" />
            <p className="text-sm">Nenhum instrumento cadastrado ainda.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {instrumentos.map((inst) => (
          <Card key={inst.id}>
            <CardContent className="pt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{inst.emoji}</span>
                <div>
                  <p className="font-medium">{inst.nome}</p>
                  {inst.obrigatorio && (
                    <span className="text-xs text-[hsl(var(--primary))]">
                      Obrigatório
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => iniciarEdicao(inst)}
                  className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))]/60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => excluir(inst.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

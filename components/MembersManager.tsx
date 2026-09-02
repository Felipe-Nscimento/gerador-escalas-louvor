"use client";

import { useState } from "react";
import { Plus, Trash2, Pencil, X, Users } from "lucide-react";
import { Button } from "./ui/Button";
import { Card, CardContent } from "./ui/Card";
import { Checkbox } from "./ui/Checkbox";
import { Input } from "./ui/Input";
import { Instrumento, Integrante } from "@/lib/types";
import { uid } from "@/lib/storage";

interface Props {
  integrantes: Integrante[];
  setIntegrantes: (fn: (prev: Integrante[]) => Integrante[]) => void;
  instrumentos: Instrumento[];
}

export function MembersManager({ integrantes, setIntegrantes, instrumentos }: Props) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [funcoes, setFuncoes] = useState<string[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);

  function iniciarNovo() {
    setEditandoId(null);
    setNome("");
    setFuncoes([]);
    setMostrarForm(true);
  }

  function iniciarEdicao(pessoa: Integrante) {
    setEditandoId(pessoa.id);
    setNome(pessoa.nome);
    setFuncoes(pessoa.funcoes);
    setMostrarForm(true);
  }

  function alternarFuncao(id: string) {
    setFuncoes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function salvar() {
    if (!nome.trim() || funcoes.length === 0) return;
    if (editandoId) {
      setIntegrantes((prev) =>
        prev.map((p) =>
          p.id === editandoId ? { ...p, nome: nome.trim(), funcoes } : p
        )
      );
    } else {
      setIntegrantes((prev) => [
        ...prev,
        { id: uid(), nome: nome.trim(), funcoes },
      ]);
    }
    setMostrarForm(false);
  }

  function excluir(id: string) {
    setIntegrantes((prev) => prev.filter((p) => p.id !== id));
  }

  function nomeInstrumento(id: string) {
    return instrumentos.find((i) => i.id === id)?.nome ?? id;
  }

  function emojiInstrumento(id: string) {
    return instrumentos.find((i) => i.id === id)?.emoji ?? "🎵";
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Integrantes</h2>
          <p className="text-sm text-[hsl(var(--muted))]">
            Cadastre uma vez e reutilize em todas as escalas.
          </p>
        </div>
        <Button onClick={iniciarNovo} disabled={instrumentos.length === 0}>
          <Plus className="h-4 w-4" /> Novo integrante
        </Button>
      </div>

      {instrumentos.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-[hsl(var(--muted))]">
            Cadastre ao menos um instrumento na aba Instrumentos antes de
            adicionar integrantes.
          </CardContent>
        </Card>
      )}

      {mostrarForm && (
        <Card>
          <CardContent className="pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">
                {editandoId ? "Editar integrante" : "Novo integrante"}
              </h3>
              <button onClick={() => setMostrarForm(false)}>
                <X className="h-4 w-4 opacity-60" />
              </button>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Nome</label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Felipe"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Instrumentos / funções
              </label>
              <div className="grid grid-cols-2 gap-1">
                {instrumentos.map((inst) => (
                  <Checkbox
                    key={inst.id}
                    label={`${inst.emoji} ${inst.nome}`}
                    checked={funcoes.includes(inst.id)}
                    onChange={() => alternarFuncao(inst.id)}
                  />
                ))}
              </div>
            </div>
            <Button onClick={salvar} className="w-full">
              Salvar integrante
            </Button>
          </CardContent>
        </Card>
      )}

      {integrantes.length === 0 && !mostrarForm && (
        <Card>
          <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-2 text-[hsl(var(--muted))]">
            <Users className="h-8 w-8" />
            <p className="text-sm">Nenhum integrante cadastrado ainda.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        {integrantes.map((p) => (
          <Card key={p.id}>
            <CardContent className="pt-5 flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{p.nome}</p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {p.funcoes.map((f) => (
                    <span
                      key={f}
                      className="text-xs rounded-full bg-[hsl(var(--border))]/60 px-2 py-0.5"
                    >
                      {emojiInstrumento(f)} {nomeInstrumento(f)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => iniciarEdicao(p)}
                  className="p-1.5 rounded-lg hover:bg-[hsl(var(--border))]/60"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => excluir(p.id)}
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

-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Ele SÓ cria a tabela nova "integrantes" — não mexe em escalas_aprovacao,
-- profiles nem em nenhuma policy existente.
--
-- DECISÃO IMPORTANTE: id como TEXT (não uuid).
-- Os integrantes já cadastrados localmente têm ids gerados no navegador
-- (ex: "a3f9k2mz1i2j3k4"), não são UUIDs. Para não perder a referência
-- desses ids dentro de escalas já salvas (local ou no Supabase, que guardam
-- os integrantes "congelados" dentro do próprio payload da escala), a
-- migração preserva o id original tal como está — por isso a coluna é
-- text, e cada integrante novo continua sendo criado pelo mesmo gerador de
-- id que o app já usa (uid() no cliente), em vez de um default do banco.

create table if not exists public.integrantes (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  nome text not null,
  nome_exibicao text,
  telefone text,
  email text,
  foto text,
  ativo boolean not null default true,
  funcoes jsonb not null default '[]'::jsonb,
  niveis jsonb not null default '[]'::jsonb,
  observacoes_musicais text,
  disponibilidade jsonb
);

alter table public.integrantes enable row level security;

-- Mesmo padrão de "compartilhado entre o time" já usado em escalas_aprovacao
-- (ex: "authenticated can read scales" using (true)) — qualquer pessoa
-- logada (montador ou líder) lista, cadastra e edita. Não existe policy de
-- delete de propósito: o cadastro usa ativo/inativo em vez de apagar de
-- verdade, pra não quebrar o histórico de escalas que já referenciam esse
-- integrante.
create policy "authenticated can read integrantes"
  on public.integrantes for select to authenticated using (true);

create policy "authenticated can insert integrantes"
  on public.integrantes for insert to authenticated with check (true);

create policy "authenticated can update integrantes"
  on public.integrantes for update to authenticated using (true) with check (true);

-- Mantém updated_at correto sozinho a cada edição (pra mostrar "atualizado em" e
-- resolver o mesmo tipo de comparação usada nas escalas online, se precisar depois).
create or replace function public.integrantes_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists integrantes_updated_at on public.integrantes;
create trigger integrantes_updated_at
before update on public.integrantes
for each row execute procedure public.integrantes_set_updated_at();

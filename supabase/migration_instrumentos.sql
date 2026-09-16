-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Só cria a tabela nova "instrumentos" — não mexe em integrantes,
-- escalas_aprovacao, profiles nem em nenhuma policy existente.
--
-- MESMA DECISÃO da migração de integrantes: id como TEXT (não uuid).
-- Os instrumentos já cadastrados (inclusive os padrão: "voz", "violao",
-- "teclado", "bateria", "baixo") têm ids fixos ou gerados no navegador —
-- não são UUIDs. Integrante.funcoes guarda esses ids, e escalas (locais e
-- já salvas no Supabase) guardam os instrumentos "congelados" dentro do
-- próprio payload. Preservando o id original tal como está, nada disso
-- quebra — por isso a coluna é text, sem default: cada instrumento novo
-- continua sendo criado pelo mesmo gerador de id que o app já usa (uid()
-- no cliente).

create table if not exists public.instrumentos (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  nome text not null,
  emoji text not null default '🎵',
  obrigatorio boolean not null default false
);

alter table public.instrumentos enable row level security;

-- Mesmo padrão já usado em integrantes e escalas_aprovacao: qualquer
-- pessoa logada (montador ou líder) lista, cadastra e edita. Sem policy de
-- delete de propósito — um instrumento excluído de verdade poderia deixar
-- órfã a referência em Integrante.funcoes ou em escalas antigas; o cadastro
-- continua com o botão de excluir funcionando só localmente/offline, como
-- já era.
create policy "authenticated can read instrumentos"
  on public.instrumentos for select to authenticated using (true);

create policy "authenticated can insert instrumentos"
  on public.instrumentos for insert to authenticated with check (true);

create policy "authenticated can update instrumentos"
  on public.instrumentos for update to authenticated using (true) with check (true);

-- Mesmo trigger de updated_at usado em integrantes.
create or replace function public.instrumentos_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists instrumentos_updated_at on public.instrumentos;
create trigger instrumentos_updated_at
before update on public.instrumentos
for each row execute procedure public.instrumentos_set_updated_at();

-- Execute este arquivo no SQL Editor do seu projeto Supabase.
-- Só cria a tabela nova "preferencias_app" — não mexe em integrantes,
-- instrumentos, escalas_aprovacao, profiles nem em nenhuma policy existente.
--
-- Guarda preferências COMPARTILHADAS do app (a mesma para todo mundo logado).
-- Hoje só tem uma: chave "ordem_funcoes" = lista de ids de instrumentos na
-- ordem em que devem aparecer na aba Escala, no PDF e no texto do WhatsApp.
-- Lista vazia [] significa "usar a ordem padrão".

create table if not exists public.preferencias_app (
  chave text primary key,
  valor jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.preferencias_app enable row level security;

-- Mesmo padrão de instrumentos/integrantes: qualquer pessoa logada
-- (montador ou líder) lê, cria e edita. Sem policy de delete de propósito.
drop policy if exists "authenticated can read preferencias_app" on public.preferencias_app;
create policy "authenticated can read preferencias_app"
  on public.preferencias_app for select to authenticated using (true);

drop policy if exists "authenticated can insert preferencias_app" on public.preferencias_app;
create policy "authenticated can insert preferencias_app"
  on public.preferencias_app for insert to authenticated with check (true);

drop policy if exists "authenticated can update preferencias_app" on public.preferencias_app;
create policy "authenticated can update preferencias_app"
  on public.preferencias_app for update to authenticated using (true) with check (true);

create or replace function public.preferencias_app_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists preferencias_app_updated_at on public.preferencias_app;
create trigger preferencias_app_updated_at
before update on public.preferencias_app
for each row execute procedure public.preferencias_app_set_updated_at();

-- Atualização em tempo real entre aparelhos (ignora se já estiver habilitado).
do $$
begin
  alter publication supabase_realtime add table public.preferencias_app;
exception when duplicate_object then null;
end $$;

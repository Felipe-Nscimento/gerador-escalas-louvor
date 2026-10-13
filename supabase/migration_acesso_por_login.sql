-- Execute este arquivo no SQL Editor do Supabase. Pode ser executado mais de uma vez.
-- NÃO apaga nenhum dado.
--
-- ACESSO POR LOGIN, COM O PERFIL DEFINIDO NO CADASTRO DE INTEGRANTES
--   * Líder   = acesso completo (inclusive aprovar escalas e definir quem tem acesso)
--   * Montador = acesso limitado (cadastros e geração de escalas; não aprova nem define acessos)
-- Quem faz login é reconhecido pelo E-MAIL cadastrado no integrante (e confirmado no
-- login). Quem não está cadastrado como Líder ou Montador não acessa nenhum dado.
-- Os integrantes continuam entrando só na página /escala, com nome + data de aniversário.
--
-- TRANSIÇÃO SEGURA: enquanto NINGUÉM tiver perfil de acesso definido em Integrantes, o
-- banco continua usando o perfil antigo (tabela profiles), para você não ficar sem acesso.
-- Assim que o primeiro integrante for marcado como Líder/Montador, o cadastro passa a
-- mandar para todos. Por isso: cadastre PRIMEIRO o seu e-mail como Líder (veja o final).

-- 1) Campos novos no cadastro de integrantes -------------------------------------------
alter table public.integrantes add column if not exists perfil_acesso text;

alter table public.integrantes drop constraint if exists integrantes_perfil_acesso_ok;
alter table public.integrantes add constraint integrantes_perfil_acesso_ok
  check (perfil_acesso is null or perfil_acesso in ('lider', 'montador'));

-- quem tem perfil de acesso precisa de e-mail
alter table public.integrantes drop constraint if exists integrantes_acesso_exige_email;
alter table public.integrantes add constraint integrantes_acesso_exige_email
  check (perfil_acesso is null or nullif(btrim(email), '') is not null);

-- um e-mail só pode pertencer a um integrante
do $$
begin
  create unique index if not exists integrantes_email_unico
    on public.integrantes (lower(btrim(email)))
    where nullif(btrim(email), '') is not null;
exception when unique_violation then
  raise notice 'Existem integrantes com o MESMO e-mail. Corrija os repetidos e rode este arquivo de novo.';
end $$;

-- contas que já existem continuam com perfil (padrão "montador"), como antes
insert into public.profiles (id)
select u.id from auth.users u
on conflict do nothing;

-- 2) Quem é o usuário logado ------------------------------------------------------------
create or replace function public.perfil_de_acesso()
returns text
language sql stable security definer set search_path = public as $$
  select case
    -- modo cadastro: já existe alguém com perfil definido em Integrantes
    when exists (select 1 from public.integrantes where perfil_acesso is not null and ativo) then (
      select i.perfil_acesso
      from public.integrantes i
      join auth.users u on lower(btrim(u.email)) = lower(btrim(i.email))
      where u.id = auth.uid()
        and u.email_confirmed_at is not null   -- e-mail confirmado no login
        and i.ativo
        and i.perfil_acesso is not null
      limit 1
    )
    -- transição: ainda ninguém foi marcado, vale o perfil antigo
    else (select p.role from public.profiles p where p.id = auth.uid())
  end
$$;

create or replace function public.is_lider() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_de_acesso() = 'lider', false)
$$;

create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_de_acesso() in ('lider', 'montador'), false)
$$;

revoke all on function public.perfil_de_acesso() from public, anon;
grant execute on function public.perfil_de_acesso() to authenticated;

-- 3) Proteção: só o Líder mexe em acessos -----------------------------------------------
-- Um montador não pode se promover, tirar o acesso de outra pessoa nem apagar/desativar
-- quem tem acesso. O SQL Editor (sem usuário logado) continua podendo tudo.
create or replace function public.integrantes_protege_acesso() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'DELETE' then
    if old.perfil_acesso is not null and not public.is_lider() then
      raise exception 'Somente o líder pode excluir quem tem acesso ao app.' using errcode = '42501';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.perfil_acesso is not null and not public.is_lider() then
      raise exception 'Somente o líder pode definir o perfil de acesso.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.perfil_acesso is distinct from old.perfil_acesso
     or (old.perfil_acesso is not null
         and lower(btrim(coalesce(new.email, ''))) is distinct from lower(btrim(coalesce(old.email, ''))))
     or (old.perfil_acesso is not null and new.ativo = false and old.ativo = true) then
    if not public.is_lider() then
      raise exception 'Somente o líder pode alterar o perfil de acesso, o e-mail de acesso ou desativar quem tem acesso.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists integrantes_protege_acesso on public.integrantes;
create trigger integrantes_protege_acesso
before insert or update or delete on public.integrantes
for each row execute procedure public.integrantes_protege_acesso();

-- 4) Os dados só para quem é Líder/Montador ---------------------------------------------
-- (troca "qualquer usuário logado" por "equipe cadastrada")
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('integrantes', 'instrumentos', 'preferencias_app', 'escalas_aprovacao')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- integrantes (a marca origem continua exigida nos cadastros novos)
create policy "equipe le integrantes" on public.integrantes
  for select to authenticated using (public.is_equipe());
create policy "equipe cria integrantes" on public.integrantes
  for insert to authenticated with check (public.is_equipe() and origem = 'app-v2');
create policy "equipe edita integrantes" on public.integrantes
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());
create policy "equipe exclui integrantes" on public.integrantes
  for delete to authenticated using (public.is_equipe());

-- instrumentos
create policy "equipe le instrumentos" on public.instrumentos
  for select to authenticated using (public.is_equipe());
create policy "equipe cria instrumentos" on public.instrumentos
  for insert to authenticated with check (public.is_equipe());
create policy "equipe edita instrumentos" on public.instrumentos
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());
create policy "equipe exclui instrumentos" on public.instrumentos
  for delete to authenticated using (public.is_equipe());

-- preferências compartilhadas (ordem das funções, nome no PDF)
create policy "equipe le preferencias_app" on public.preferencias_app
  for select to authenticated using (public.is_equipe());
create policy "equipe cria preferencias_app" on public.preferencias_app
  for insert to authenticated with check (public.is_equipe());
create policy "equipe edita preferencias_app" on public.preferencias_app
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());

-- escalas: montador cria e edita as suas; só o líder aprova e mexe nas dos outros
create policy "equipe le escalas" on public.escalas_aprovacao
  for select to authenticated using (public.is_equipe());
create policy "equipe cria escala" on public.escalas_aprovacao
  for insert to authenticated with check (created_by = auth.uid() and public.is_equipe());
create policy "dono ou lider edita escala" on public.escalas_aprovacao
  for update to authenticated
  using (
    (created_by = auth.uid() and public.is_equipe() and status in ('rascunho', 'aguardando_aprovacao', 'devolvida'))
    or public.is_lider()
  )
  with check (
    (created_by = auth.uid() and public.is_equipe() and status in ('rascunho', 'aguardando_aprovacao', 'devolvida'))
    or public.is_lider()
  );
create policy "dono ou lider exclui escala" on public.escalas_aprovacao
  for delete to authenticated using ((created_by = auth.uid() and public.is_equipe()) or public.is_lider());

notify pgrst, 'reload schema';

-- 5) PASSO OBRIGATÓRIO: cadastre o SEU e-mail como Líder -------------------------------
-- Troque o e-mail e o nome pelos seus (o mesmo e-mail com que você faz login no app) e
-- rode as duas linhas abaixo, uma vez. Só depois disso o cadastro passa a mandar.
--
--   update public.integrantes
--      set email = 'seu-email@exemplo.com', perfil_acesso = 'lider'
--    where nome = 'Nome completo exatamente como está em Integrantes';
--
--   select nome, email, perfil_acesso from public.integrantes where perfil_acesso is not null;
--
-- Os montadores podem ser definidos depois, pela tela de Integrantes (só o líder vê o campo).

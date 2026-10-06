-- Execute este arquivo INTEIRO no SQL Editor do seu projeto Supabase.
-- É seguro rodar mais de uma vez (usa "if not exists" / "drop policy if exists").
-- Não apaga nem altera dados existentes; só cria coisas novas e adiciona 3
-- colunas opcionais em "integrantes".
--
-- O que isto cria:
--   1. is_equipe()                       -> true se o usuário logado é líder ou montador
--   2. integrantes: +instagram, +endereco, +data_aniversario (colunas opcionais)
--   3. formularios_cadastro              -> cadastros (e links de convite)
--   4. formularios_cadastro_instrumentos -> instrumentos de cada cadastro (N:N)
--   5. 4 funções que o formulário PÚBLICO (sem login) usa — nada mais
--   6. bucket de Storage "fotos-integrantes" + policies
--
-- SEGURANÇA, em uma frase: quem NÃO está logado como líder/montador não
-- consegue ler nenhuma linha destas tabelas. O link público só consegue
-- (a) validar o próprio token, (b) listar nome/emoji dos instrumentos e
-- (c) enviar UM cadastro, uma única vez, para a própria linha do token.

-- ---------------------------------------------------------------------
-- 1. Quem é "equipe" (perfis permitidos: lider e montador)
-- ---------------------------------------------------------------------
create or replace function public.is_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('lider', 'montador')
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Integrantes ganham os campos que o formulário coleta
-- ---------------------------------------------------------------------
alter table public.integrantes
  add column if not exists instagram text,
  add column if not exists endereco text,
  add column if not exists data_aniversario date;

-- ---------------------------------------------------------------------
-- 3. Cadastros do formulário
--    status: aguardando = link gerado e ainda não preenchido
--            pendente   = preenchido, ainda não virou integrante
--            utilizado  = já virou integrante
-- ---------------------------------------------------------------------
create table if not exists public.formularios_cadastro (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  origem text not null default 'admin' check (origem in ('admin', 'link')),
  status text not null default 'pendente' check (status in ('aguardando', 'pendente', 'utilizado')),
  token text unique,
  link_expira_em timestamptz,
  enviado_em timestamptz,
  nome text,
  whatsapp text,          -- só dígitos, sem +55 (ex: 85999999999)
  instagram text,         -- sem o "@"
  endereco text,
  data_aniversario date,
  foto_path text,         -- caminho do arquivo no bucket fotos-integrantes
  integrante_id text references public.integrantes(id) on delete set null,
  constraint formularios_token_tamanho check (token is null or length(token) >= 32),
  constraint formularios_nome_ok check (
    status = 'aguardando' or (nome is not null and char_length(btrim(nome)) between 2 and 120)
  ),
  constraint formularios_whatsapp_ok check (whatsapp is null or whatsapp ~ '^[0-9]{10,11}$'),
  constraint formularios_instagram_ok check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  constraint formularios_endereco_ok check (endereco is null or char_length(endereco) <= 300),
  constraint formularios_data_ok check (
    data_aniversario is null
    or (data_aniversario >= date '1900-01-01' and data_aniversario <= date '2100-01-01')
  )
);

create index if not exists formularios_cadastro_status_idx on public.formularios_cadastro (status);
create index if not exists formularios_cadastro_created_idx on public.formularios_cadastro (created_at desc);

create or replace function public.formularios_cadastro_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists formularios_cadastro_updated_at on public.formularios_cadastro;
create trigger formularios_cadastro_updated_at
before update on public.formularios_cadastro
for each row execute procedure public.formularios_cadastro_set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Instrumentos de cada cadastro (usa os ids REAIS da tabela instrumentos)
-- ---------------------------------------------------------------------
create table if not exists public.formularios_cadastro_instrumentos (
  formulario_id uuid not null references public.formularios_cadastro(id) on delete cascade,
  instrumento_id text not null references public.instrumentos(id) on delete cascade,
  primary key (formulario_id, instrumento_id)
);

create index if not exists formularios_cadastro_instrumentos_inst_idx
  on public.formularios_cadastro_instrumentos (instrumento_id);

-- ---------------------------------------------------------------------
-- RLS: somente líder/montador. Nenhuma policy para "anon" de propósito.
-- ---------------------------------------------------------------------
alter table public.formularios_cadastro enable row level security;
alter table public.formularios_cadastro_instrumentos enable row level security;

revoke all on public.formularios_cadastro from anon;
revoke all on public.formularios_cadastro_instrumentos from anon;

drop policy if exists "equipe le formularios" on public.formularios_cadastro;
create policy "equipe le formularios" on public.formularios_cadastro
  for select to authenticated using (public.is_equipe());

drop policy if exists "equipe cria formularios" on public.formularios_cadastro;
create policy "equipe cria formularios" on public.formularios_cadastro
  for insert to authenticated
  with check (public.is_equipe() and (created_by is null or created_by = auth.uid()));

drop policy if exists "equipe edita formularios" on public.formularios_cadastro;
create policy "equipe edita formularios" on public.formularios_cadastro
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());

drop policy if exists "equipe exclui formularios" on public.formularios_cadastro;
create policy "equipe exclui formularios" on public.formularios_cadastro
  for delete to authenticated using (public.is_equipe());

drop policy if exists "equipe le formularios_instrumentos" on public.formularios_cadastro_instrumentos;
create policy "equipe le formularios_instrumentos" on public.formularios_cadastro_instrumentos
  for select to authenticated using (public.is_equipe());

drop policy if exists "equipe cria formularios_instrumentos" on public.formularios_cadastro_instrumentos;
create policy "equipe cria formularios_instrumentos" on public.formularios_cadastro_instrumentos
  for insert to authenticated with check (public.is_equipe());

drop policy if exists "equipe exclui formularios_instrumentos" on public.formularios_cadastro_instrumentos;
create policy "equipe exclui formularios_instrumentos" on public.formularios_cadastro_instrumentos
  for delete to authenticated using (public.is_equipe());

-- ---------------------------------------------------------------------
-- 5. Funções do formulário PÚBLICO (SECURITY DEFINER: rodam com permissão
--    do dono, mas só fazem exatamente o que está escrito aqui).
-- ---------------------------------------------------------------------

-- Usada pela policy de upload de foto: o link precisa estar ativo.
create or replace function public.formulario_aceita_upload(p_formulario_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.formularios_cadastro f
    where f.id::text = p_formulario_id
      and f.status = 'aguardando'
      and f.token is not null
      and (f.link_expira_em is null or f.link_expira_em > now())
  );
$$;

-- Valida o token e devolve SÓ o necessário para montar o formulário.
create or replace function public.formulario_publico_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  f public.formularios_cadastro%rowtype;
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  select * into f from public.formularios_cadastro where token = p_token;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  if f.status <> 'aguardando' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_enviado');
  end if;
  if f.link_expira_em is not null and f.link_expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;
  return jsonb_build_object(
    'ok', true,
    'formulario_id', f.id,
    'instrumentos', coalesce(
      (select jsonb_agg(jsonb_build_object('id', i.id, 'nome', i.nome, 'emoji', i.emoji) order by i.nome)
         from public.instrumentos i),
      '[]'::jsonb
    )
  );
end;
$$;

-- Recebe o cadastro. Valida TUDO de novo no servidor e só funciona uma vez.
create or replace function public.formulario_publico_enviar(
  p_token text,
  p_nome text,
  p_whatsapp text,
  p_instagram text,
  p_endereco text,
  p_data_aniversario date,
  p_foto_path text,
  p_instrumentos text[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  f public.formularios_cadastro%rowtype;
  v_nome text;
  v_whats text;
  v_insta text;
  v_end text;
  v_ids text[];
begin
  if p_token is null or length(p_token) < 32 then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;

  select * into f from public.formularios_cadastro where token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'invalido');
  end if;
  if f.status <> 'aguardando' then
    return jsonb_build_object('ok', false, 'motivo', 'ja_enviado');
  end if;
  if f.link_expira_em is not null and f.link_expira_em <= now() then
    return jsonb_build_object('ok', false, 'motivo', 'expirado');
  end if;

  v_nome := btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g'));
  if char_length(v_nome) < 2 or char_length(v_nome) > 120 then
    return jsonb_build_object('ok', false, 'motivo', 'nome_invalido');
  end if;

  v_whats := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  if v_whats is not null and length(v_whats) in (12, 13) and left(v_whats, 2) = '55' then
    v_whats := substr(v_whats, 3);
  end if;
  if v_whats is not null and v_whats !~ '^[0-9]{10,11}$' then
    return jsonb_build_object('ok', false, 'motivo', 'whatsapp_invalido');
  end if;

  v_insta := nullif(regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', ''), '');
  if v_insta is not null and v_insta !~ '^[A-Za-z0-9._]{1,30}$' then
    return jsonb_build_object('ok', false, 'motivo', 'instagram_invalido');
  end if;

  v_end := nullif(btrim(coalesce(p_endereco, '')), '');
  if v_end is not null and char_length(v_end) > 300 then
    return jsonb_build_object('ok', false, 'motivo', 'endereco_invalido');
  end if;

  if p_data_aniversario is not null
     and (p_data_aniversario < date '1900-01-01' or p_data_aniversario > current_date) then
    return jsonb_build_object('ok', false, 'motivo', 'data_invalida');
  end if;

  v_ids := array(select distinct x from unnest(coalesce(p_instrumentos, '{}'::text[])) as x);
  if coalesce(array_length(v_ids, 1), 0) > 30 then
    return jsonb_build_object('ok', false, 'motivo', 'instrumento_inexistente');
  end if;
  if exists (
    select 1 from unnest(v_ids) as x
    where not exists (select 1 from public.instrumentos i where i.id = x)
  ) then
    return jsonb_build_object('ok', false, 'motivo', 'instrumento_inexistente');
  end if;

  -- A foto, se existir, precisa estar na pasta DESTE cadastro e já ter sido enviada.
  if p_foto_path is not null then
    if left(p_foto_path, length('formularios/' || f.id::text || '/')) <> 'formularios/' || f.id::text || '/'
       or position('..' in p_foto_path) > 0
       or not exists (
         select 1 from storage.objects o
         where o.bucket_id = 'fotos-integrantes' and o.name = p_foto_path
       ) then
      return jsonb_build_object('ok', false, 'motivo', 'foto_invalida');
    end if;
  end if;

  update public.formularios_cadastro set
    nome = v_nome,
    whatsapp = v_whats,
    instagram = v_insta,
    endereco = v_end,
    data_aniversario = p_data_aniversario,
    foto_path = p_foto_path,
    status = 'pendente',
    enviado_em = now()
  where id = f.id;

  insert into public.formularios_cadastro_instrumentos (formulario_id, instrumento_id)
  select f.id, x from unnest(v_ids) as x;

  return jsonb_build_object('ok', true);
end;
$$;

-- Só estas funções ficam acessíveis sem login.
revoke all on function public.formulario_aceita_upload(text) from public;
revoke all on function public.formulario_publico_info(text) from public;
revoke all on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[]) from public;
grant execute on function public.formulario_aceita_upload(text) to anon, authenticated;
grant execute on function public.formulario_publico_info(text) to anon, authenticated;
grant execute on function public.formulario_publico_enviar(text, text, text, text, text, date, text, text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Storage: bucket público para exibir as fotos (<img src="...">).
--    O caminho tem um UUID impossível de adivinhar e NÃO existe policy que
--    permita listar a pasta para quem não é da equipe.
--    Limite: 2 MB por arquivo, só JPG/PNG/WebP (o app já comprime antes).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-integrantes', 'fotos-integrantes', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos-integrantes equipe envia" on storage.objects;
create policy "fotos-integrantes equipe envia" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-integrantes'
    and (storage.foldername(name))[1] = 'formularios'
    and public.is_equipe()
  );

drop policy if exists "fotos-integrantes link publico envia" on storage.objects;
create policy "fotos-integrantes link publico envia" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'fotos-integrantes'
    and (storage.foldername(name))[1] = 'formularios'
    and public.formulario_aceita_upload((storage.foldername(name))[2])
  );

-- O Storage grava o arquivo com INSERT ... RETURNING, que exige poder "ver" a linha
-- recém-criada. Esta policy deixa quem tem o link ver SOMENTE os arquivos da pasta
-- do próprio link ativo (cujo UUID só ele conhece). Não permite listar mais nada.
drop policy if exists "fotos-integrantes link publico le propria pasta" on storage.objects;
create policy "fotos-integrantes link publico le propria pasta" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'fotos-integrantes'
    and (storage.foldername(name))[1] = 'formularios'
    and public.formulario_aceita_upload((storage.foldername(name))[2])
  );

drop policy if exists "fotos-integrantes equipe le" on storage.objects;
create policy "fotos-integrantes equipe le" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-integrantes' and public.is_equipe());

drop policy if exists "fotos-integrantes equipe remove" on storage.objects;
create policy "fotos-integrantes equipe remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-integrantes' and public.is_equipe());

-- ---------------------------------------------------------------------
-- Tempo real na lista de formulários (ignora se já estiver habilitado).
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.formularios_cadastro;
exception when duplicate_object then null;
end $$;

-- Execute este arquivo no SQL Editor do Supabase. Pode ser executado mais de uma vez.
-- NÃO apaga nenhum dado.
--
-- LEMBRETES NO CELULAR (notificação push)
-- Na semana em que o integrante está escalado, ele recebe uma notificação lembrando da
-- escala e de estudar as músicas. O envio é feito todo dia de manhã por uma rota do app
-- (agendada na Vercel), que só envia o que ainda não foi enviado.
--
-- Requer: migration_acesso_integrantes.sql e migration_playlists_avisos.sql já executadas.
--
-- Segurança: as tabelas abaixo ficam FECHADAS (sem policies). Quem registra o aparelho usa as
-- funções push_registrar*/push_cancelar*, que conferem nome + senha (ou o login do Líder/Montador).
-- O envio usa funções protegidas por um SEGREDO que só você e a Vercel conhecem (passo 2 no fim).

create table if not exists public.push_config (
  chave text primary key,
  valor text not null
);

create table if not exists public.push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  integrante_id text not null references public.integrantes(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);
create index if not exists push_assinaturas_integrante_idx on public.push_assinaturas (integrante_id);

create table if not exists public.push_envios (
  integrante_id text not null references public.integrantes(id) on delete cascade,
  data date not null,
  culto text not null,
  enviado_em timestamptz not null default now(),
  primary key (integrante_id, data, culto)
);

alter table public.push_config enable row level security;
alter table public.push_assinaturas enable row level security;
alter table public.push_envios enable row level security;

-- ------------------------------------------------------------------------------------------
-- Quem é o integrante (nome + data de aniversário), com o mesmo limite de tentativas da /escala
create or replace function public.push_integrante_por_acesso(p_nome text, p_senha text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_nome text := public.norm_texto(p_nome);
  v_senha text := regexp_replace(coalesce(p_senha, ''), '\D', '', 'g');
  v_id text;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 80 or char_length(v_senha) <> 8 then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  delete from public.acesso_integrantes_falhas where tentou_em < now() - interval '1 day';
  if (select count(*) from public.acesso_integrantes_falhas
        where chave = v_nome and tentou_em > now() - interval '15 minutes') >= 8
     or (select count(*) from public.acesso_integrantes_falhas
        where tentou_em > now() - interval '15 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  select i.id into v_id
  from public.integrantes i
  where i.ativo
    and i.data_aniversario is not null
    and to_char(i.data_aniversario, 'DDMMYYYY') = v_senha
    and (
      public.norm_texto(i.nome) = v_nome
      or public.norm_texto(i.nome_exibicao) = v_nome
      or split_part(public.norm_texto(i.nome), ' ', 1) = v_nome
    )
  limit 1;

  if v_id is null then
    insert into public.acesso_integrantes_falhas (chave) values (v_nome);
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- Integrante do Líder/Montador logado (pelo e-mail confirmado, igual ao acesso por login)
create or replace function public.push_integrante_do_login()
returns text
language sql stable security definer set search_path = public as $$
  select i.id
  from public.integrantes i
  join auth.users u on lower(btrim(u.email)) = lower(btrim(i.email))
  where u.id = auth.uid() and u.email_confirmed_at is not null and i.ativo
  limit 1
$$;

create or replace function public.push_guardar(p_integrante text, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or coalesce(char_length(p_p256dh), 0) not between 20 and 200
     or coalesce(char_length(p_auth), 0) not between 10 and 100 then
    return jsonb_build_object('ok', false, 'motivo', 'assinatura_invalida');
  end if;

  insert into public.push_assinaturas (integrante_id, endpoint, p256dh, auth)
  values (p_integrante, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set integrante_id = excluded.integrante_id, p256dh = excluded.p256dh, auth = excluded.auth;

  -- no máximo 5 aparelhos por pessoa (os mais antigos saem)
  delete from public.push_assinaturas s
  where s.integrante_id = p_integrante
    and s.id not in (
      select id from public.push_assinaturas
      where integrante_id = p_integrante order by criado_em desc limit 5
    );
  return jsonb_build_object('ok', true);
end;
$$;

-- Integrante (página /escala): registra o aparelho para receber lembretes
create or replace function public.push_registrar(p_nome text, p_senha text, p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := public.push_integrante_por_acesso(p_nome, p_senha);
begin
  if not (r->>'ok')::boolean then return r; end if;
  return public.push_guardar(r->>'id', p_endpoint, p_p256dh, p_auth);
end;
$$;

create or replace function public.push_cancelar(p_nome text, p_senha text, p_endpoint text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb := public.push_integrante_por_acesso(p_nome, p_senha);
begin
  if not (r->>'ok')::boolean then return r; end if;
  delete from public.push_assinaturas where endpoint = p_endpoint and integrante_id = r->>'id';
  return jsonb_build_object('ok', true);
end;
$$;

-- Líder/Montador logado: o integrante é o cadastro com o mesmo e-mail do login
create or replace function public.push_registrar_equipe(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id text := public.push_integrante_do_login();
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_cadastro');
  end if;
  return public.push_guardar(v_id, p_endpoint, p_p256dh, p_auth);
end;
$$;

create or replace function public.push_cancelar_equipe(p_endpoint text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id text := public.push_integrante_do_login();
begin
  if v_id is null then
    return jsonb_build_object('ok', false, 'motivo', 'sem_cadastro');
  end if;
  delete from public.push_assinaturas where endpoint = p_endpoint and integrante_id = v_id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ------------------------------------------------------------------------------------------
-- Funções do ENVIO (só funcionam com o segredo cadastrado em push_config)
create or replace function public.push_segredo_ok(p_segredo text)
returns boolean
language sql stable security definer set search_path = public as $$
  select p_segredo is not null
     and char_length(p_segredo) >= 16
     and exists (select 1 from public.push_config c where c.chave = 'cron_secret' and c.valor = p_segredo)
$$;

-- Quem ainda deve receber lembrete: cultos da SEMANA ATUAL (segunda a domingo, horário de
-- Fortaleza), de hoje em diante, que ainda não foram avisados, de quem tem aparelho registrado.
create or replace function public.push_lembretes(p_segredo text, p_hoje date default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_hoje date := coalesce(p_hoje, (now() at time zone 'America/Fortaleza')::date);
  v_domingo date := v_hoje + (7 - extract(isodow from v_hoje)::int);
  v_resultado jsonb;
begin
  if not public.push_segredo_ok(p_segredo) then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;

  with versoes as (
    select coalesce(e.payload->>'atualizadoEm', e.approved_at::text, e.created_at::text) as versao, e.payload
    from public.escalas_aprovacao e
    where e.status in ('aprovada', 'publicada')
  ),
  itens as (
    select v.versao, (d->>'data')::date as data, 'Culto de domingo'::text as titulo,
           d->'escalacao'->'atribuicoes' as atrib
    from versoes v,
         jsonb_array_elements(case when jsonb_typeof(v.payload->'domingos') = 'array'
                                   then v.payload->'domingos' else '[]'::jsonb end) d
    union all
    select v.versao, (x->>'data')::date, coalesce(nullif(btrim(x->>'titulo'), ''), 'Culto extra'),
           x->'escalacao'->'atribuicoes'
    from versoes v,
         jsonb_array_elements(case when jsonb_typeof(v.payload->'cultosExtras') = 'array'
                                   then v.payload->'cultosExtras' else '[]'::jsonb end) x
  ),
  vigentes as (   -- de cada culto vale só a versão mais recente da escala
    select distinct on (data, lower(titulo)) data, titulo, atrib
    from itens
    where data between v_hoje and v_domingo and jsonb_typeof(atrib) = 'object'
    order by data, lower(titulo), versao desc
  ),
  pessoas as (
    select vi.data, vi.titulo, p.value as integrante_id, a.key as instrumento_id
    from vigentes vi,
         jsonb_each(vi.atrib) a,
         jsonb_array_elements_text(case when jsonb_typeof(a.value) = 'array' then a.value else '[]'::jsonb end) p
  ),
  por_culto as (
    select ps.integrante_id, ps.data, ps.titulo,
           jsonb_agg(distinct (coalesce(i.emoji, '') || ' ' || i.nome)) as funcoes
    from pessoas ps
    join public.instrumentos i on i.id = ps.instrumento_id
    group by ps.integrante_id, ps.data, ps.titulo
  ),
  pendentes as (
    select pc.*
    from por_culto pc
    join public.integrantes g on g.id = pc.integrante_id and g.ativo
    where not exists (
            select 1 from public.push_envios pe
            where pe.integrante_id = pc.integrante_id and pe.data = pc.data and pe.culto = lower(pc.titulo))
      and exists (select 1 from public.push_assinaturas s where s.integrante_id = pc.integrante_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'integrante_id', g.id,
      'nome', coalesce(nullif(btrim(g.nome_exibicao), ''), g.nome),
      'cultos', (
        select jsonb_agg(jsonb_build_object(
                 'data', pc.data, 'titulo', pc.titulo, 'chave', lower(pc.titulo), 'funcoes', pc.funcoes,
                 'playlist', exists (select 1 from public.playlists_culto pl
                                     where pl.data = pc.data and pl.culto = lower(pc.titulo)))
               order by pc.data, pc.titulo)
        from pendentes pc where pc.integrante_id = g.id),
      'assinaturas', (
        select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
        from public.push_assinaturas s where s.integrante_id = g.id)
    )), '[]'::jsonb)
  into v_resultado
  from public.integrantes g
  where g.id in (select integrante_id from pendentes);

  return v_resultado;
end;
$$;

create or replace function public.push_marcar_enviado(p_segredo text, p_integrante_id text, p_cultos jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.push_segredo_ok(p_segredo) then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;
  insert into public.push_envios (integrante_id, data, culto)
  select p_integrante_id, (c->>'data')::date, c->>'chave'
  from jsonb_array_elements(p_cultos) c
  on conflict do nothing;
end;
$$;

create or replace function public.push_remover_assinatura(p_segredo text, p_endpoint text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.push_segredo_ok(p_segredo) then
    raise exception 'nao_autorizado' using errcode = '42501';
  end if;
  delete from public.push_assinaturas where endpoint = p_endpoint;
end;
$$;

-- Permissões: nada é público por padrão
revoke all on function public.push_integrante_por_acesso(text, text) from public, anon, authenticated;
revoke all on function public.push_integrante_do_login() from public, anon, authenticated;
revoke all on function public.push_guardar(text, text, text, text) from public, anon, authenticated;
revoke all on function public.push_segredo_ok(text) from public, anon, authenticated;

revoke all on function public.push_registrar(text, text, text, text, text) from public;
revoke all on function public.push_cancelar(text, text, text) from public;
revoke all on function public.push_registrar_equipe(text, text, text) from public, anon;
revoke all on function public.push_cancelar_equipe(text) from public, anon;
revoke all on function public.push_lembretes(text, date) from public;
revoke all on function public.push_marcar_enviado(text, text, jsonb) from public;
revoke all on function public.push_remover_assinatura(text, text) from public;

grant execute on function public.push_registrar(text, text, text, text, text) to anon, authenticated;
grant execute on function public.push_cancelar(text, text, text) to anon, authenticated;
grant execute on function public.push_registrar_equipe(text, text, text) to authenticated;
grant execute on function public.push_cancelar_equipe(text) to authenticated;
grant execute on function public.push_lembretes(text, date) to anon, authenticated;
grant execute on function public.push_marcar_enviado(text, text, jsonb) to anon, authenticated;
grant execute on function public.push_remover_assinatura(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------------------------------------
-- PASSO OBRIGATÓRIO: cadastre o SEGREDO do envio (o mesmo valor que você vai colocar na
-- Vercel como CRON_SECRET). Gere um texto longo e aleatório (32+ caracteres) e rode UMA vez,
-- trocando o texto entre aspas:
--
--   insert into public.push_config (chave, valor) values ('cron_secret', 'COLE-AQUI-O-SEGREDO')
--   on conflict (chave) do update set valor = excluded.valor;

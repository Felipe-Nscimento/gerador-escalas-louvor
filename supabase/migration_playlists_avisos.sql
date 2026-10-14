-- Execute este arquivo no SQL Editor do Supabase. Pode ser executado mais de uma vez.
-- NÃO apaga nenhum dado.
--
-- ABA ESCALA: PLAYLIST DE CADA CULTO + AVISOS DE ATIVIDADES EXTRA CULTO
--   * Playlist: Líder e Montador colocam o link; todos os integrantes veem. Sem link, nada aparece.
--   * Avisos (reunião, confraternização, estudo...): aparecem no mês do evento e somem depois
--     da data. Pode haver vários por mês.
-- Requer migration_acesso_integrantes.sql já executada (a função dos integrantes é atualizada aqui).

create table if not exists public.playlists_culto (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  culto text not null,                      -- título do culto em minúsculas ("culto de domingo")
  url text not null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (data, culto),
  constraint playlists_culto_url_ok check (char_length(url) <= 500 and url ~* '^https?://[^[:space:]]+$'),
  constraint playlists_culto_culto_ok check (char_length(btrim(culto)) between 1 and 120)
);

create table if not exists public.avisos_equipe (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'outro',
  titulo text not null,
  data date not null,
  horario text,
  local_descricao text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint avisos_tipo_ok check (tipo in ('reuniao', 'confraternizacao', 'estudo', 'outro')),
  constraint avisos_titulo_ok check (char_length(btrim(titulo)) between 1 and 80),
  constraint avisos_horario_ok check (horario is null or char_length(horario) <= 20),
  constraint avisos_local_ok check (local_descricao is null or char_length(local_descricao) <= 200)
);
create index if not exists avisos_equipe_data_idx on public.avisos_equipe (data);

alter table public.playlists_culto enable row level security;
alter table public.avisos_equipe enable row level security;

-- Líder e Montador (equipe cadastrada) leem e gravam. Os integrantes veem pela função abaixo.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public' and tablename in ('playlists_culto', 'avisos_equipe')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "equipe le playlists" on public.playlists_culto
  for select to authenticated using (public.is_equipe());
create policy "equipe cria playlists" on public.playlists_culto
  for insert to authenticated with check (public.is_equipe());
create policy "equipe edita playlists" on public.playlists_culto
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());
create policy "equipe exclui playlists" on public.playlists_culto
  for delete to authenticated using (public.is_equipe());

create policy "equipe le avisos" on public.avisos_equipe
  for select to authenticated using (public.is_equipe());
create policy "equipe cria avisos" on public.avisos_equipe
  for insert to authenticated with check (public.is_equipe());
create policy "equipe edita avisos" on public.avisos_equipe
  for update to authenticated using (public.is_equipe()) with check (public.is_equipe());
create policy "equipe exclui avisos" on public.avisos_equipe
  for delete to authenticated using (public.is_equipe());

-- Função dos integrantes (página /escala): agora também devolve playlists e avisos.
create or replace function public.escala_para_integrante(p_nome text, p_senha text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := public.norm_texto(p_nome);
  v_senha text := regexp_replace(coalesce(p_senha, ''), '\D', '', 'g');
  v_achou record;
  v_escalas jsonb;
  v_txt text;
  v_pessoas jsonb;
  v_instrumentos jsonb;
  v_ordem jsonb := null;
  v_playlists jsonb;
  v_avisos jsonb;
  v_hoje date := (now() at time zone 'America/Fortaleza')::date;
begin
  if char_length(v_nome) < 2 or char_length(v_nome) > 80 or char_length(v_senha) <> 8 then
    return jsonb_build_object('ok', false, 'motivo', 'dados_invalidos');
  end if;

  -- Limite de tentativas (15 min): por nome e no total.
  delete from public.acesso_integrantes_falhas where tentou_em < now() - interval '1 day';
  if (select count(*) from public.acesso_integrantes_falhas
        where chave = v_nome and tentou_em > now() - interval '15 minutes') >= 8
     or (select count(*) from public.acesso_integrantes_falhas
        where tentou_em > now() - interval '15 minutes') >= 300 then
    return jsonb_build_object('ok', false, 'motivo', 'muitas_tentativas');
  end if;

  -- Nome (completo, de exibição ou só o primeiro nome) + data de aniversário.
  select i.id, coalesce(nullif(btrim(i.nome_exibicao), ''), i.nome) as nome
    into v_achou
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

  if not found then
    insert into public.acesso_integrantes_falhas (chave) values (v_nome);
    return jsonb_build_object('ok', false, 'motivo', 'credenciais_invalidas');
  end if;

  -- Escalas aprovadas/publicadas, só com o que o card usa (datas, títulos e ids).
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'atualizadoEm', coalesce(e.payload->>'atualizadoEm', e.approved_at::text, e.created_at::text),
      'domingos', case when jsonb_typeof(e.payload->'domingos') = 'array' then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'data', d->>'data',
          'numero', d->'numero',
          'escalacao', jsonb_build_object(
            'solo', coalesce((d->'escalacao'->'solo') = 'true'::jsonb, false),
            'atribuicoes', case when jsonb_typeof(d->'escalacao'->'atribuicoes') = 'object'
                                then d->'escalacao'->'atribuicoes' else '{}'::jsonb end
          )
        )), '[]'::jsonb)
        from jsonb_array_elements(e.payload->'domingos') d
      ) else '[]'::jsonb end,
      'cultosExtras', case when jsonb_typeof(e.payload->'cultosExtras') = 'array' then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', x->>'id',
          'data', x->>'data',
          'titulo', x->>'titulo',
          'escalacao', jsonb_build_object(
            'solo', coalesce((x->'escalacao'->'solo') = 'true'::jsonb, false),
            'atribuicoes', case when jsonb_typeof(x->'escalacao'->'atribuicoes') = 'object'
                                then x->'escalacao'->'atribuicoes' else '{}'::jsonb end
          )
        )), '[]'::jsonb)
        from jsonb_array_elements(e.payload->'cultosExtras') x
      ) else '[]'::jsonb end
    ) order by e.created_at
  ), '[]'::jsonb)
  into v_escalas
  from public.escalas_aprovacao e
  where e.status in ('aprovada', 'publicada');

  -- Só as pessoas que aparecem nessas escalas. Aniversário: apenas dia e mês.
  v_txt := v_escalas::text;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id,
    'nome', i.nome,
    'nomeExibicao', i.nome_exibicao,
    'foto', i.foto,
    'ativo', true,
    'dataAniversario', case when i.data_aniversario is null then null
                            else '2000-' || to_char(i.data_aniversario, 'MM-DD') end
  )), '[]'::jsonb)
  into v_pessoas
  from public.integrantes i
  where strpos(v_txt, '"' || i.id || '"') > 0;

  select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'emoji', s.emoji)), '[]'::jsonb)
  into v_instrumentos
  from public.instrumentos s;

  -- Playlists dos cultos (dos últimos 120 dias em diante).
  select coalesce(jsonb_agg(jsonb_build_object('data', pl.data, 'culto', pl.culto, 'url', pl.url)), '[]'::jsonb)
  into v_playlists
  from public.playlists_culto pl
  where pl.data >= v_hoje - 120;

  -- Avisos: aparecem no mês do evento e somem depois da data.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'tipo', a.tipo, 'titulo', a.titulo, 'data', a.data,
    'horario', a.horario, 'local', a.local_descricao
  ) order by a.data, a.horario nulls last), '[]'::jsonb)
  into v_avisos
  from public.avisos_equipe a
  where a.data >= v_hoje
    and date_trunc('month', a.data) = date_trunc('month', v_hoje::timestamp);

  -- Ordem das funções escolhida pelo líder (se a tabela existir).
  begin
    select p.valor into v_ordem from public.preferencias_app p where p.chave = 'ordem_funcoes';
  exception when others then
    v_ordem := null;
  end;

  return jsonb_build_object(
    'ok', true,
    'nome', v_achou.nome,
    'escalas', v_escalas,
    'integrantes', v_pessoas,
    'instrumentos', v_instrumentos,
    'ordemFuncoes', v_ordem,
    'playlists', v_playlists,
    'avisos', v_avisos
  );
end;
$$;

revoke all on function public.escala_para_integrante(text, text) from public;
grant execute on function public.escala_para_integrante(text, text) to anon, authenticated;

notify pgrst, 'reload schema';

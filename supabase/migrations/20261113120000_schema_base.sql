-- =====================================================================
-- Film Festival · schema base
-- Tabelas, enums, funções auxiliares, triggers e RLS.
-- Ver docs/04-modelo-de-dados.md e docs/05-regras-de-negocio.md
-- As views de resultado e as funções de voto vêm em migrations próprias.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.jury_status      as enum ('open', 'closed');
create type public.voting_status    as enum ('not_started', 'open', 'closed');
create type public.acting_category  as enum ('actress', 'actor');
create type public.category_kind    as enum ('film', 'acting', 'public');
create type public.staff_role       as enum ('admin');
create type public.vote_batch       as enum ('A', 'B', 'C');
create type public.tiebreak_status  as enum ('open', 'decided');
create type public.tiebreak_method  as enum ('majority', 'casting_vote');
create type public.soundtrack_cue   as enum (
  'abertura', 'bastidores', 'ambiente', 'suspense', 'fanfarra', 'fanfarra_pc', 'encerramento'
);

-- ---------------------------------------------------------------------
-- Edições, cerimônias, filmes, elenco, categorias
-- ---------------------------------------------------------------------
create table public.editions (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  year               int  not null,
  event_date         date,
  venue              text,
  is_active          boolean not null default false,
  jury_status        public.jury_status not null default 'open',
  gallery_enabled    boolean not null default false,
  -- Domínio obrigatório para o e-mail dos jurados (sem @).
  juror_email_domain text not null default 'colegioprogresso.g12.br'
                     check (juror_email_domain = lower(juror_email_domain) and juror_email_domain not like '%@%'),
  created_at         timestamptz not null default now()
);
-- Só uma edição ativa por vez.
create unique index editions_one_active on public.editions (is_active) where is_active;

create table public.ceremonies (
  id                uuid primary key default gen_random_uuid(),
  edition_id        uuid not null references public.editions (id) on delete cascade,
  name              text not null,
  short_name        text not null,
  starts_at         timestamptz,
  ends_at           timestamptz,
  audience          text,
  code_prefix       text not null check (code_prefix ~ '^[A-Z]{2,3}$'),
  sort_order        int  not null default 0,
  voting_status     public.voting_status not null default 'not_started',
  voting_opened_at  timestamptz,
  voting_closed_at  timestamptz,
  unique (edition_id, code_prefix)
);
create index on public.ceremonies (edition_id);

create table public.films (
  id               uuid primary key default gen_random_uuid(),
  ceremony_id      uuid not null references public.ceremonies (id) on delete cascade,
  title            text not null,
  class_name       text,
  synopsis         text,
  drive_file_id    text check (drive_file_id ~ '^[A-Za-z0-9_-]{10,}$'),
  size_bytes       bigint,
  duration_ms      int,
  md5              text,
  poster_path      text,
  screening_order  int not null default 0,
  is_public        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.films (ceremony_id);

create table public.cast_members (
  id               uuid primary key default gen_random_uuid(),
  film_id          uuid not null references public.films (id) on delete cascade,
  student_name     text not null,
  role_name        text,
  is_evaluated     boolean not null default false,
  acting_category  public.acting_category,
  sort_order       int not null default 0,
  check (not is_evaluated or acting_category is not null)
);
create index on public.cast_members (film_id);

create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  edition_id       uuid not null references public.editions (id) on delete cascade,
  code             text not null,
  name_en          text not null,
  name_pt          text not null,
  kind             public.category_kind not null,
  acting_category  public.acting_category,
  award_order      int not null,
  unique (edition_id, code),
  check ((kind = 'acting') = (acting_category is not null))
);

-- Ao criar uma edição, cria as 7 categorias padrão (ordem de premiação).
create function public.create_default_categories()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories (edition_id, code, name_en, name_pt, kind, acting_category, award_order) values
    (new.id, 'scr',     'Best Screenplay',          'Melhor Roteiro',               'film',   null,      1),
    (new.id, 'cos',     'Best Costume & Makeup',    'Melhor Figurino e Maquiagem',  'film',   null,      2),
    (new.id, 'cin',     'Best Cinematography',      'Melhor Filmagem',              'film',   null,      3),
    (new.id, 'actress', 'Best Actress',             'Melhor Atriz',                 'acting', 'actress', 4),
    (new.id, 'actor',   'Best Actor',               'Melhor Ator',                  'acting', 'actor',   5),
    (new.id, 'pic',     'Best Picture',             'Melhor Filme',                 'film',   null,      6),
    (new.id, 'pc',      'People''s Choice',         'Escolha do Público',           'public', null,      7);
  return new;
end $$;

create trigger editions_default_categories
  after insert on public.editions
  for each row execute function public.create_default_categories();

-- ---------------------------------------------------------------------
-- Pessoas: admins e jurados
-- ---------------------------------------------------------------------
create table public.staff (
  id       uuid primary key default gen_random_uuid(),
  email    text not null unique check (email = lower(email)),
  name     text,
  role     public.staff_role not null default 'admin',
  user_id  uuid unique references auth.users (id) on delete set null
);

create table public.jurors (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid not null references public.editions (id) on delete cascade,
  email       text not null check (email = lower(email)),
  name        text,
  user_id     uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (edition_id, email),
  unique (edition_id, user_id)
);

-- O e-mail do jurado precisa ser do domínio da edição.
create function public.jurors_check_domain()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_domain text;
begin
  select juror_email_domain into v_domain from public.editions where id = new.edition_id;
  if split_part(new.email, '@', 2) <> v_domain then
    raise exception 'O e-mail do jurado precisa ser @%', v_domain using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger jurors_domain
  before insert or update of email, edition_id on public.jurors
  for each row execute function public.jurors_check_domain();

-- ---------------------------------------------------------------------
-- Funções auxiliares de papel (usadas nas políticas RLS)
-- ---------------------------------------------------------------------
create function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = auth.uid() and role = 'admin');
$$;

create function public.current_juror_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select j.id
    from public.jurors j
    join public.editions e on e.id = j.edition_id and e.is_active
   where j.user_id = auth.uid();
$$;

create function public.active_edition_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.editions where is_active;
$$;

-- Chamada no callback do login: liga a conta Google ao cadastro e diz o papel.
-- Admin: qualquer e-mail cadastrado em staff.
-- Jurado: e-mail do domínio da edição ativa e cadastrado em jurors.
create function public.link_current_user()
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then return 'none'; end if;
  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null then return 'none'; end if;

  update public.staff set user_id = v_uid where email = v_email;
  if found then return 'admin'; end if;

  update public.jurors j set user_id = v_uid
    from public.editions e
   where e.id = j.edition_id and e.is_active
     and j.email = v_email
     and split_part(v_email, '@', 2) = e.juror_email_domain;
  if found then return 'juror'; end if;

  return 'none';
end $$;

-- Papel atual, sem alterar nada (para as páginas conferirem o acesso).
create function public.current_app_role()
returns text language sql stable security definer set search_path = '' as $$
  select case
    when public.is_admin() then 'admin'
    when public.current_juror_id() is not null then 'juror'
    else 'none'
  end;
$$;

-- ---------------------------------------------------------------------
-- Notas do júri
-- ---------------------------------------------------------------------
create table public.scores (
  id              uuid primary key default gen_random_uuid(),
  juror_id        uuid not null references public.jurors (id) on delete cascade,
  category_id     uuid not null references public.categories (id) on delete cascade,
  film_id         uuid not null references public.films (id) on delete cascade,
  cast_member_id  uuid references public.cast_members (id) on delete cascade,
  value           numeric(3,1) not null
                  check (value between 0 and 10 and value * 2 = trunc(value * 2)),
  updated_at      timestamptz not null default now(),
  -- nulls not distinct: notas de filme (sem integrante) também são únicas.
  constraint scores_unique unique nulls not distinct (juror_id, category_id, film_id, cast_member_id)
);
create index on public.scores (film_id);

-- Valida coerência da nota e bloqueia escrita com a avaliação encerrada.
create function public.scores_guard()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_film      uuid;
  v_cat       public.categories%rowtype;
  v_edition   uuid;
  v_status    public.jury_status;
  v_cm        public.cast_members%rowtype;
begin
  if tg_op = 'DELETE' then v_film := old.film_id; else v_film := new.film_id; end if;

  select c.edition_id into v_edition
    from public.films f join public.ceremonies c on c.id = f.ceremony_id
   where f.id = v_film;
  select jury_status into v_status from public.editions where id = v_edition;

  if v_status = 'closed' then
    raise exception 'A avaliação do júri está encerrada.' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;

  select * into v_cat from public.categories where id = new.category_id;
  if v_cat.edition_id <> v_edition then
    raise exception 'Categoria de outra edição.';
  end if;
  if not exists (select 1 from public.jurors where id = new.juror_id and edition_id = v_edition) then
    raise exception 'Jurado de outra edição.';
  end if;

  if v_cat.kind = 'public' then
    raise exception 'People''s Choice não recebe nota do júri.';
  elsif v_cat.kind = 'film' then
    if new.cast_member_id is not null then
      raise exception 'Categoria de filme não leva integrante do elenco.';
    end if;
  else -- acting
    select * into v_cm from public.cast_members where id = new.cast_member_id;
    if v_cm.id is null or v_cm.film_id <> new.film_id or not v_cm.is_evaluated
       or v_cm.acting_category <> v_cat.acting_category then
      raise exception 'Integrante não concorre nesta categoria.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger scores_guard
  before insert or update or delete on public.scores
  for each row execute function public.scores_guard();

-- ---------------------------------------------------------------------
-- Votação do público (as funções check_code/cast_vote vêm depois)
-- ---------------------------------------------------------------------
create table public.devices (
  id                  uuid primary key default gen_random_uuid(),
  label               text not null,
  ceremony_id         uuid references public.ceremonies (id) on delete set null,
  token_hash          text unique,
  pairing_code_hash   text,
  pairing_expires_at  timestamptz,
  revoked_at          timestamptz,
  created_at          timestamptz not null default now()
);

create table public.vote_codes (
  id              uuid primary key default gen_random_uuid(),
  ceremony_id     uuid not null references public.ceremonies (id) on delete cascade,
  code_hash       text not null unique,
  batch           public.vote_batch not null,
  used_at         timestamptz,
  used_device_id  uuid references public.devices (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index on public.vote_codes (ceremony_id);

-- Sem ligação com o código: anonimato do voto.
create table public.votes (
  id           uuid primary key default gen_random_uuid(),
  ceremony_id  uuid not null references public.ceremonies (id) on delete cascade,
  film_id      uuid not null references public.films (id) on delete cascade,
  device_id    uuid references public.devices (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.votes (ceremony_id);

-- ---------------------------------------------------------------------
-- Desempate do júri
-- ---------------------------------------------------------------------
create table public.tiebreaks (
  id           uuid primary key default gen_random_uuid(),
  ceremony_id  uuid not null references public.ceremonies (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  tied_refs    jsonb not null,
  status       public.tiebreak_status not null default 'open',
  winner_ref   uuid,
  method       public.tiebreak_method,
  decided_by   uuid references auth.users (id),
  decided_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (ceremony_id, category_id)
);

create table public.tiebreak_votes (
  tiebreak_id  uuid not null references public.tiebreaks (id) on delete cascade,
  juror_id     uuid not null references public.jurors (id) on delete cascade,
  choice_ref   uuid not null,
  created_at   timestamptz not null default now(),
  primary key (tiebreak_id, juror_id)
);

-- ---------------------------------------------------------------------
-- Trilha sonora e auditoria
-- ---------------------------------------------------------------------
create table public.soundtrack_tracks (
  id            uuid primary key default gen_random_uuid(),
  edition_id    uuid not null references public.editions (id) on delete cascade,
  ceremony_id   uuid references public.ceremonies (id) on delete cascade,
  cue           public.soundtrack_cue not null,
  storage_path  text not null,
  file_name     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now(),
  constraint soundtrack_unique unique nulls not distinct (edition_id, ceremony_id, cue)
);

create table public.audit_log (
  id             bigint generated always as identity primary key,
  actor_user_id  uuid references auth.users (id) on delete set null,
  action         text not null,
  entity         text,
  entity_id      uuid,
  details        jsonb,
  at             timestamptz not null default now()
);

create function public.log_action(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
$$;

-- updated_at dos filmes
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger films_touch before update on public.films
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- Regra geral: admin faz tudo; jurado lê o que precisa da edição ativa e
-- escreve só as próprias notas; anônimo não lê nada direto das tabelas
-- (galeria e urna passam por views/funções/rotas de servidor).
-- ---------------------------------------------------------------------
alter table public.editions          enable row level security;
alter table public.ceremonies        enable row level security;
alter table public.films             enable row level security;
alter table public.cast_members      enable row level security;
alter table public.categories        enable row level security;
alter table public.staff             enable row level security;
alter table public.jurors            enable row level security;
alter table public.scores            enable row level security;
alter table public.devices           enable row level security;
alter table public.vote_codes        enable row level security;
alter table public.votes             enable row level security;
alter table public.tiebreaks         enable row level security;
alter table public.tiebreak_votes    enable row level security;
alter table public.soundtrack_tracks enable row level security;
alter table public.audit_log         enable row level security;

-- Admin: acesso total (exceto votes e audit_log, abaixo).
create policy admin_all on public.editions          for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.ceremonies        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.films             for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.cast_members      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.categories        for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.staff             for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_all on public.jurors            for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.scores           for select to authenticated using (public.is_admin());
create policy admin_all on public.devices           for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.vote_codes       for select to authenticated using (public.is_admin());
create policy admin_all on public.tiebreaks         for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.tiebreak_votes   for select to authenticated using (public.is_admin());
create policy admin_all on public.soundtrack_tracks for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admin_read on public.audit_log        for select to authenticated using (public.is_admin());

-- Parcial do People's Choice oculta até encerrar, inclusive para o admin.
create policy admin_read_closed on public.votes for select to authenticated
  using (public.is_admin() and exists (
    select 1 from public.ceremonies c where c.id = votes.ceremony_id and c.voting_status = 'closed'));

-- Jurado: lê a edição ativa e o que precisa para avaliar.
create policy juror_read on public.editions for select to authenticated
  using (is_active and public.current_juror_id() is not null);
create policy juror_read on public.ceremonies for select to authenticated
  using (edition_id = public.active_edition_id() and public.current_juror_id() is not null);
create policy juror_read on public.films for select to authenticated
  using (public.current_juror_id() is not null and exists (
    select 1 from public.ceremonies c where c.id = films.ceremony_id and c.edition_id = public.active_edition_id()));
create policy juror_read on public.cast_members for select to authenticated
  using (public.current_juror_id() is not null and exists (
    select 1 from public.films f join public.ceremonies c on c.id = f.ceremony_id
     where f.id = cast_members.film_id and c.edition_id = public.active_edition_id()));
create policy juror_read on public.categories for select to authenticated
  using (edition_id = public.active_edition_id() and public.current_juror_id() is not null);
create policy self_read on public.jurors for select to authenticated
  using (user_id = auth.uid());
create policy self_read on public.staff for select to authenticated
  using (user_id = auth.uid());

-- Jurado: só as próprias notas (o trigger cuida do resto).
create policy juror_own on public.scores for all to authenticated
  using (juror_id = public.current_juror_id())
  with check (juror_id = public.current_juror_id());

-- Jurado: vê rodadas de desempate abertas da edição ativa e vota uma vez.
create policy juror_read on public.tiebreaks for select to authenticated
  using (public.current_juror_id() is not null and exists (
    select 1 from public.ceremonies c where c.id = tiebreaks.ceremony_id and c.edition_id = public.active_edition_id()));
create policy juror_own on public.tiebreak_votes for all to authenticated
  using (juror_id = public.current_juror_id())
  with check (juror_id = public.current_juror_id() and exists (
    select 1 from public.tiebreaks t where t.id = tiebreak_votes.tiebreak_id and t.status = 'open'));

-- Funções: só usuários logados chamam (anon não).
revoke execute on function public.link_current_user() from public, anon;
revoke execute on function public.current_app_role()  from public, anon;
revoke execute on function public.log_action(text, text, uuid, jsonb) from public, anon;
grant  execute on function public.link_current_user() to authenticated;
grant  execute on function public.current_app_role()  to authenticated;
grant  execute on function public.log_action(text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Storage: pôsteres e trilha (privados; leitura via URL assinada)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('posters',    'posters',    false, 10485760, array['image/jpeg', 'image/png', 'image/webp']),
  ('soundtrack', 'soundtrack', false, 31457280, array['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav'])
on conflict (id) do nothing;

create policy admin_all_files on storage.objects for all to authenticated
  using (bucket_id in ('posters', 'soundtrack') and public.is_admin())
  with check (bucket_id in ('posters', 'soundtrack') and public.is_admin());

create policy juror_read_posters on storage.objects for select to authenticated
  using (bucket_id = 'posters' and public.current_juror_id() is not null);

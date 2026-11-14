-- =====================================================================
-- Votação do público (People's Choice): urnas e funções de voto.
-- Os hashes (código do cartão e token da urna) são calculados no
-- servidor Next.js com o VOTE_CODE_PEPPER, que nunca entra no banco.
-- =====================================================================

-- 4º lote opcional (Junior tarde tem ~95 votantes).
alter type public.vote_batch add value if not exists 'D';

alter table public.devices
  add column failed_attempts int not null default 0,
  add column locked_until    timestamptz,
  add column last_seen_at    timestamptz;

-- Erro de código na urna: após 5 seguidos, espera de 10 s.
create function public.urna_register_failure(p_device uuid)
returns void language sql security definer set search_path = '' as $$
  update public.devices
     set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
         locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '10 seconds' else locked_until end
   where id = p_device;
$$;

-- Confere o código antes de mostrar a cédula (não queima o código).
-- Retorno: ok | no_device | locked | closed | invalid | other_ceremony | used
create function public.check_code(p_token_hash text, p_code_hash text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d public.devices%rowtype;
  c public.vote_codes%rowtype;
begin
  select * into d from public.devices where token_hash = p_token_hash and revoked_at is null;
  if d.id is null or d.ceremony_id is null then return 'no_device'; end if;
  update public.devices set last_seen_at = now() where id = d.id;

  if d.locked_until is not null and d.locked_until > now() then return 'locked'; end if;
  if not exists (select 1 from public.ceremonies where id = d.ceremony_id and voting_status = 'open') then
    return 'closed';
  end if;

  select * into c from public.vote_codes where code_hash = p_code_hash;
  if c.id is null then
    perform public.urna_register_failure(d.id);
    return 'invalid';
  end if;
  if c.ceremony_id <> d.ceremony_id then
    perform public.urna_register_failure(d.id);
    return 'other_ceremony';
  end if;
  if c.used_at is not null then return 'used'; end if;

  update public.devices set failed_attempts = 0 where id = d.id;
  return 'ok';
end $$;

-- Registra o voto: queima o código e grava o voto na mesma transação.
-- Só um UPDATE vence, mesmo com cliques duplos ou duas urnas ao mesmo tempo.
-- Retorno: ok | no_device | closed | invalid_film | invalid | other_ceremony | used
create function public.cast_vote(p_token_hash text, p_code_hash text, p_film uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d         public.devices%rowtype;
  v_code_id uuid;
  v_cer     uuid;
begin
  select * into d from public.devices where token_hash = p_token_hash and revoked_at is null;
  if d.id is null or d.ceremony_id is null then return 'no_device'; end if;
  update public.devices set last_seen_at = now() where id = d.id;

  if not exists (select 1 from public.ceremonies where id = d.ceremony_id and voting_status = 'open') then
    return 'closed';
  end if;
  if not exists (select 1 from public.films where id = p_film and ceremony_id = d.ceremony_id) then
    return 'invalid_film';
  end if;

  update public.vote_codes
     set used_at = now(), used_device_id = d.id
   where code_hash = p_code_hash and ceremony_id = d.ceremony_id and used_at is null
  returning id into v_code_id;

  if v_code_id is null then
    select ceremony_id into v_cer from public.vote_codes where code_hash = p_code_hash;
    if v_cer is null then return 'invalid'; end if;
    if v_cer <> d.ceremony_id then return 'other_ceremony'; end if;
    return 'used';
  end if;

  -- Sem ligação com o código: anonimato.
  insert into public.votes (ceremony_id, film_id, device_id) values (d.ceremony_id, p_film, d.id);
  return 'ok';
end $$;

-- Só o servidor (chave secreta) chama as funções da urna.
revoke execute on function public.urna_register_failure(uuid) from public, anon, authenticated;
revoke execute on function public.check_code(text, text)      from public, anon, authenticated;
revoke execute on function public.cast_vote(text, text, uuid)  from public, anon, authenticated;
grant  execute on function public.check_code(text, text)      to service_role;
grant  execute on function public.cast_vote(text, text, uuid)  to service_role;

-- Horário de abertura/encerramento da votação.
create function public.ceremonies_voting_times()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.voting_status is distinct from old.voting_status then
    if new.voting_status = 'open' then new.voting_opened_at := coalesce(new.voting_opened_at, now()); end if;
    if new.voting_status = 'closed' then new.voting_closed_at := now(); end if;
  end if;
  return new;
end $$;
revoke execute on function public.ceremonies_voting_times() from public, anon, authenticated;

create trigger ceremonies_voting_times
  before update of voting_status on public.ceremonies
  for each row execute function public.ceremonies_voting_times();

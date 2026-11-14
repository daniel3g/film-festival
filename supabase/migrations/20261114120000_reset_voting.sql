-- =====================================================================
-- Zerar a votação de uma cerimônia (testes e ensaio).
-- Apaga votos e códigos, volta o status para "não aberta" e zera os
-- horários — tudo numa transação. Só admin; fica registrado no log.
-- =====================================================================

create function public.reset_voting(p_ceremony uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_votes int;
  v_codes int;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.ceremonies where id = p_ceremony) then
    raise exception 'Cerimônia não encontrada.' using errcode = 'P0002';
  end if;

  delete from public.votes      where ceremony_id = p_ceremony;
  get diagnostics v_votes = row_count;
  delete from public.vote_codes where ceremony_id = p_ceremony;
  get diagnostics v_codes = row_count;

  update public.ceremonies
     set voting_status = 'not_started', voting_opened_at = null, voting_closed_at = null
   where id = p_ceremony;  -- o trigger de horários não mexe em 'not_started'

  update public.devices set failed_attempts = 0, locked_until = null where ceremony_id = p_ceremony;

  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (auth.uid(), 'voting.reset', 'ceremonies', p_ceremony,
          jsonb_build_object('votes', v_votes, 'codes', v_codes));

  return jsonb_build_object('votes', v_votes, 'codes', v_codes);
end $$;

revoke execute on function public.reset_voting(uuid) from public, anon;
grant  execute on function public.reset_voting(uuid) to authenticated;

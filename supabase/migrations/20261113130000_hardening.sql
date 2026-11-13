-- Reforço de segurança apontado pelo `supabase db advisors`.

-- 1. search_path fixo
alter function public.touch_updated_at() set search_path = '';

-- 2. Funções de trigger não devem ser chamáveis pela API (os triggers continuam funcionando).
revoke execute on function public.create_default_categories() from public, anon, authenticated;
revoke execute on function public.jurors_check_domain()       from public, anon, authenticated;
revoke execute on function public.scores_guard()              from public, anon, authenticated;
revoke execute on function public.touch_updated_at()          from public, anon, authenticated;

-- 3. Auxiliares de papel: só usuários logados (as políticas RLS precisam delas).
revoke execute on function public.is_admin()          from public, anon;
revoke execute on function public.current_juror_id()  from public, anon;
revoke execute on function public.active_edition_id() from public, anon;
grant  execute on function public.is_admin()          to authenticated;
grant  execute on function public.current_juror_id()  to authenticated;
grant  execute on function public.active_edition_id() to authenticated;

-- 4. log_action: só admin grava no log pela API.
create or replace function public.log_action(p_action text, p_entity text, p_entity_id uuid, p_details jsonb default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_user_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_entity_id, p_details);
end $$;

-- 5. auth.uid() avaliado uma vez por consulta
alter policy self_read on public.jurors using (user_id = (select auth.uid()));
alter policy self_read on public.staff  using (user_id = (select auth.uid()));

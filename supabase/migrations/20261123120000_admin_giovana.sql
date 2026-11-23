-- Novo admin: Giovana. Entra com a conta Google deste e-mail;
-- o user_id é ligado no primeiro login (link_current_user).
insert into public.staff (email, name, role)
values ('gggevoce@gmail.com', 'Giovana', 'admin')
on conflict (email) do update set role = 'admin', name = excluded.name;

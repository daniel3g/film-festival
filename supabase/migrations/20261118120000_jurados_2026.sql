-- Jurados da edição ativa (2026). Diego Nascimento Nessa ficou de fora:
-- o e-mail dele é @gmail.com e a edição só aceita @colegioprogresso.g12.br.
insert into public.jurors (edition_id, name, email)
select e.id, v.name, v.email
  from public.editions e
 cross join (values
   ('Andressa Santos',     'prof.andressasantos@colegioprogresso.g12.br'),
   ('Anna Ferreira',       'prof.annaferreira@colegioprogresso.g12.br'),
   ('Cauê Teixeira',       'prof.caueteixeira@colegioprogresso.g12.br'),
   ('Eduardo Scandelai',   'prof.eduardoscandelai@colegioprogresso.g12.br'),
   ('Fabiana',             'fabiana@colegioprogresso.g12.br'),
   ('Gilvania Bernadete',  'prof.gilvaniabernadete@colegioprogresso.g12.br'),
   ('Giovana Bonfim',      'prof.giovanabonfim@colegioprogresso.g12.br'),
   ('Gustavo Silva',       'prof.gustavosilva@colegioprogresso.g12.br'),
   ('Luciana Martins',     'prof.lucianamartins@colegioprogresso.g12.br'),
   ('Luciana Moriyama',    'prof.lucianamoriyama@colegioprogresso.g12.br'),
   ('Luís Beretta',        'prof.luisberetta@colegioprogresso.g12.br'),
   ('Neide Oliveira',      'neide.oliveira@colegioprogresso.g12.br'),
   ('Phil Collins',        'prof.philcollins@colegioprogresso.g12.br'),
   ('Raquel Duque',        'prof.raquelduque@colegioprogresso.g12.br'),
   ('Renan Hirae',         'prof.renanhirae@colegioprogresso.g12.br'),
   ('Secretaria',          'secretaria@colegioprogresso.g12.br'),
   ('Thiago Valenzi',      'prof.thiagovalenzi@colegioprogresso.g12.br')
 ) as v(name, email)
 where e.is_active
on conflict (edition_id, email) do nothing;

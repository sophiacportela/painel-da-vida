-- ATENÇÃO: isso substitui a tabela antiga (sem login) por uma nova,
-- com uma linha por USUÁRIO LOGADO (auth.uid()), não mais uma linha fixa
-- chamada "sophia". Se você já tinha testado o app antes disso, os dados de
-- teste antigos serão apagados — normal, é só isso mesmo, dado de teste.
--
-- Rode isso no SQL Editor do seu projeto Supabase.

drop table if exists painel_estado;

create table painel_estado (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Cada pessoa logada só enxerga e só edita a PRÓPRIA linha.
-- Isso é o que fecha o buraco de segurança: antes, qualquer um com o link
-- conseguia ler/editar os dados, porque a trava não checava quem estava
-- pedindo — só existia uma linha fixa. Agora, sem estar logada como você,
-- ninguém acessa nada.
alter table painel_estado enable row level security;

create policy "cada usuário só vê e edita a própria linha" on painel_estado
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Rode isso uma vez no SQL Editor do seu projeto Supabase (supabase.com).
-- Cria a única tabela que o Painel da Vida usa: um "estado" inteiro em JSON,
-- porque é um app de uma pessoa só (você) — não precisa de várias tabelas.

create table if not exists painel_estado (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Segurança: como o app usa a chave "anon" pública (fica visível no navegador),
-- habilitamos RLS e liberamos leitura/escrita só para a linha "sophia".
-- Isso não é um sistema multiusuário — é uma trava simples para não deixar
-- a tabela aberta por engano a qualquer linha.
alter table painel_estado enable row level security;

create policy "acesso à própria linha" on painel_estado
  for all
  using (id = 'sophia')
  with check (id = 'sophia');

-- Cria a linha inicial vazia (o app faz upsert nela a partir daí).
insert into painel_estado (id, data)
values ('sophia', '{}'::jsonb)
on conflict (id) do nothing;

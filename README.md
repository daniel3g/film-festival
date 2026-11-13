# Film Festival 2026 – Classics Edition

Plataforma do festival: cadastro, júri, votação do público (urnas) e telão da cerimônia.
Documentação completa em [`docs/`](docs/README.md).

## Stack

Next.js 16 (App Router) · Supabase (Postgres + Auth Google + Storage) · Vercel · vídeos no Google Drive.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencher as chaves
npm run dev                  # http://localhost:3000
```

O app usa direto o projeto Supabase **cloud** (não há Supabase local).

## Banco

O Supabase CLI roda pelo atalho `npm run sb`, que usa o `SUPABASE_ACCESS_TOKEN` do `.env.local`
(token da conta dona do projeto). Assim ele não depende do login global da máquina, que pode
ser de outra conta.

```bash
npm run sb -- link --project-ref <ref>
npm run db:push                          # aplica supabase/migrations
npm run db:types                         # regenera lib/database.types.ts
npm run sb -- db advisors --linked       # checagem de segurança
```

## Acesso

- **Admin:** qualquer conta Google cadastrada na tabela `staff`.
- **Jurado:** conta `@colegioprogresso.g12.br` cadastrada em `jurors` da edição ativa.
- **Urnas e público:** sem login.

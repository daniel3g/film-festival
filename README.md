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

```bash
npx supabase link --project-ref <ref>
npx supabase db push --linked                                   # aplica supabase/migrations
npx supabase gen types typescript --linked > lib/database.types.ts
npx supabase db advisors --linked                               # checagem de segurança
```

## Acesso

- **Admin:** qualquer conta Google cadastrada na tabela `staff`.
- **Jurado:** conta `@colegioprogresso.g12.br` cadastrada em `jurors` da edição ativa.
- **Urnas e público:** sem login.

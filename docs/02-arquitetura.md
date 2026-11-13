# 2 · Arquitetura e stack

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Front-end + API | **Next.js (App Router, TypeScript)** | Páginas e rotas de servidor (Route Handlers e Server Actions) no mesmo projeto |
| Hospedagem | **Vercel** (plano Hobby) | Deploy por push, HTTPS e previews automáticos |
| Banco | **Supabase Postgres** | Relacional (bom para notas e rankings), funções SQL atômicas para o voto, RLS |
| Login | **Supabase Auth + Google OAuth** | Login com o Google da escola para admin e jurados |
| Arquivos pequenos | **Supabase Storage** | Pôsteres e faixas da trilha |
| Vídeos | **Google Drive** (onde a escola já guarda) + **Drive API** | Streaming para jurados, download para o telão, troca de permissão para a galeria |
| Offline do telão | **PWA (service worker) + OPFS** | App e arquivos grandes guardados no navegador do notebook |
| Telão em 2 janelas | **BroadcastChannel** | Painel e projetor conversam sem rede |
| Áudio | **Web Audio API** | Crossfade, volume e silenciar |
| UI | Tailwind CSS + componentes próprios | Visual do protótipo (tema "Classics") |
| PDF dos cartões | `@react-pdf/renderer` ou impressão de página HTML | 90 cartões por cerimônia |

## Visão geral

```mermaid
flowchart LR
  subgraph Navegadores
    A[Admin<br/>notebook]
    J[Jurados<br/>casa ou escola]
    U[3 Urnas<br/>Chrome em modo quiosque]
    P[Projetor<br/>janela 2 do notebook]
    G[Público<br/>galeria]
  end

  subgraph Vercel
    N[Next.js<br/>páginas + rotas de API]
  end

  subgraph Supabase
    DB[(Postgres + RLS)]
    AU[Auth Google]
    ST[Storage<br/>pôsteres e trilha]
  end

  GD[(Google Drive<br/>vídeos)]

  A & J & U & G --> N
  N --> DB
  N --> AU
  A & J --> AU
  N -- conta de serviço:<br/>permissões --> GD
  J -- iframe /preview<br/>streaming --> GD
  A -- token OAuth do admin:<br/>download dos vídeos --> GD
  A <-- BroadcastChannel --> P
  A -- OPFS --> A
```

## Componentes

### Aplicação Next.js

Rotas por perfil:

| Rota | Perfil | Observações |
|---|---|---|
| `/admin/**` | Admin | Cadastro, júri, votação, cerimônia, galeria |
| `/juri/**` | Jurado | Lista de filmes, player com notas |
| `/urna` | Urna pareada | Tela de quiosque, sem login de pessoa |
| `/telao/painel/[cerimonia]` | Admin | Painel de controle (notebook) |
| `/telao/projetor/[cerimonia]` | Admin | Aberta pelo painel com `window.open`, vai para a segunda tela |
| `/galeria/[edicao]` | Público | Página estática (ISR), revalidada quando o admin muda a liberação |

Lógica sensível (voto, notas, troca de permissão no Drive, resultados) roda **no servidor**, em Route Handlers e Server Actions ou em funções SQL. O navegador nunca recebe a chave `service_role`.

### Supabase

- **Postgres:** todas as entidades (ver [Modelo de dados](04-modelo-de-dados.md)). Regras críticas em funções SQL `security definer`, como `cast_vote` e `close_voting`.
- **RLS ligado em todas as tabelas.** Jurado lê e escreve só as próprias notas. Admin acessa tudo. O público lê só a view da galeria.
- **Auth:** provedor Google. O domínio da escola é conferido no servidor, além da lista de e-mails autorizados.
- **Storage:** bucket `posters` (leitura pública só para filmes liberados, servida via URL assinada) e bucket `soundtrack` (privado).

### Google Drive

| Uso | Como |
|---|---|
| Jurado assiste | Iframe `https://drive.google.com/file/d/{id}/preview`. O arquivo é compartilhado com o **domínio da escola**, e o jurado já está logado no Google da escola no navegador |
| Telão baixa | O navegador do admin chama `GET https://www.googleapis.com/drive/v3/files/{id}?alt=media` com o **token OAuth do próprio admin** (escopo `drive.readonly`) e grava o arquivo em streaming no OPFS. O vídeo não passa pela Vercel |
| Galeria libera ou bloqueia | Uma rota de servidor usa uma **conta de serviço** com a Drive API: cria ou remove a permissão `anyone/reader`. O padrão é `domain/reader` |
| Metadados | `size`, `md5Checksum`, `videoMediaMetadata.durationMillis`, lidos ao cadastrar o filme |

**Pré-requisito:** os vídeos ficam num **Drive compartilhado** da escola (ou numa pasta), com a conta de serviço como Editor. Ver [Decisões em aberto](09-decisoes-em-aberto.md): o Workspace pode bloquear o compartilhamento "qualquer pessoa com o link".

### Tempo real

O contador de votos do painel e do telão consulta `GET /api/cerimonias/{id}/contagem` a cada **3 segundos**. São no máximo 2 clientes por cerimônia, uma carga desprezível, e o polling é mais simples e resistente a quedas que o Realtime. Se a rede cair, o contador mostra o último valor com a marca "desatualizado".

## Estrutura do repositório (proposta)

```
/
├─ docs/                      ← esta documentação
├─ app/
│  ├─ (publico)/galeria/
│  ├─ admin/
│  ├─ juri/
│  ├─ urna/
│  ├─ telao/{painel,projetor}/
│  └─ api/
├─ lib/
│  ├─ supabase/               ← clientes do navegador e do servidor
│  ├─ drive/                  ← Drive API: metadados, permissões
│  ├─ offline/                ← OPFS: download, verificação, leitura
│  ├─ ceremony/               ← montagem do roteiro (passos)
│  └─ audio/                  ← motor da trilha (Web Audio)
├─ supabase/
│  ├─ migrations/             ← SQL versionado (tabelas, views, RLS, funções)
│  └─ seed.sql                ← dados de exemplo para desenvolvimento
├─ public/sw.js               ← service worker (cache do telão)
└─ tests/                     ← regras de negócio e e2e
```

## Ambientes

| Ambiente | Onde | Banco |
|---|---|---|
| Local | `next dev` | Supabase local (CLI) com `seed.sql` |
| Preview | Vercel, um por branch | Projeto Supabase de homologação |
| Produção | Vercel (domínio `*.vercel.app` ou da escola) | Projeto Supabase de produção |

Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `SCHOOL_DOMAIN`, `VOTE_CODE_PEPPER`.

## Limites dos planos gratuitos (conferir)

| Serviço | Ponto de atenção | Situação no festival |
|---|---|---|
| Vercel Hobby | Uso não comercial; limites de funções | Atividade escolar; os vídeos não passam pela Vercel |
| Supabase Free | Projeto **pausa após 7 dias sem uso**; 500 MB de banco; 1 GB de Storage | Manter o projeto ativo na semana do evento; pôsteres e trilha somam menos de 100 MB |
| Drive API | Cotas por usuário e por minuto | Poucas dezenas de chamadas |

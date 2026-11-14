# 3 · Autenticação, perfis e permissões

## Resumo

| Perfil | Como entra | Identidade no sistema |
|---|---|---|
| Admin | Qualquer conta Google cadastrada em `staff` (o admin principal usa Gmail) | Linha em `staff`, com `role = 'admin'` |
| Jurado | Google da escola (`@colegioprogresso.g12.br`) | Linha em `jurors` (por edição), ligada ao `auth.users` no primeiro login |
| Urna | **Pareamento do dispositivo** feito pelo admin | Linha em `devices`, com token guardado no navegador da urna |
| Telão | Sessão do admin | O mesmo admin |
| Público | Sem login | Nenhuma |

## Login Google (admin e jurado)

1. Botão "Entrar com Google" → Supabase Auth (OAuth). O projeto Google Cloud e o cliente OAuth ficam na conta Gmail do admin, tipo **Externo**, publicado em produção. Como só pede `email` e `profile`, não precisa de verificação do Google nem de lista de usuários de teste.
2. No callback (servidor), a checagem:
   - e-mail em `staff` → entra como admin (qualquer domínio);
   - senão, e-mail termina em `@colegioprogresso.g12.br` **e** está em `jurors` da edição ativa → entra como jurado.
3. Se falhar, a sessão é encerrada e aparece "Esta conta não tem acesso. Fale com a organização."
4. No primeiro login do jurado, `jurors.user_id` recebe o `auth.uid()`.

Não há escopo de Drive no login: o download dos filmes usa a chave de API, porque os arquivos são públicos por link.

## Pareamento das urnas

A urna não pode ter login de pessoa: é rápida e anônima. Mas também não pode ser "qualquer navegador" votando.

1. Admin → Votação → **Criar urna**. O sistema cria um `device` (por exemplo, "Urna 2", já com a cerimônia) e mostra um **código de pareamento de 8 caracteres** (`K7PX-3MHA`), válido por 10 minutos.
2. No computador da urna, o admin abre `/urna` e digita o código de pareamento. A cerimônia da urna é escolhida e trocada no painel.
3. O servidor devolve um **token do dispositivo** (aleatório, 32 bytes), guardado em cookie `httpOnly` com validade de 7 dias. No banco fica só o hash (com o `VOTE_CODE_PEPPER`).
4. Toda chamada de voto exige esse token. O admin pode **trocar a cerimônia** da urna ou **revogar** o dispositivo a qualquer momento.

Assim, só as 3 máquinas pareadas conseguem votar, e um código de cartão sozinho não vale fora delas.

## Matriz de permissões

| Ação | Admin | Jurado | Urna | Público |
|---|:-:|:-:|:-:|:-:|
| Cadastro (edições, filmes, elenco, jurados, trilha) | ✅ | | | |
| Ver vídeos dos filmes | ✅ | ✅ | | só os liberados |
| Dar e editar as próprias notas (avaliação aberta) | | ✅ | | |
| Ver notas de todos e o ranking do júri | ✅ | | | |
| Abrir rodada de desempate e registrar o vencedor | ✅ | voto na rodada | | |
| Gerar códigos e imprimir cartões | ✅ | | | |
| Abrir e encerrar a votação | ✅ | | | |
| Votar com código | | | ✅ | |
| Ver contagem total de votos | ✅ | | ✅ (só o total) | |
| Ver parcial por filme | ✅ (só depois de encerrar) | | | |
| Modo apresentação | ✅ | | | |
| Liberar galeria e filmes | ✅ | | | |
| Ver a galeria | ✅ | ✅ | | ✅ |

## Implementação das permissões

- **RLS** no Postgres, com funções auxiliares `is_admin()` e `current_juror_id()` baseadas em `auth.uid()`.
- **Rotas de servidor** conferem o papel antes de usar o cliente `service_role`.
- A urna não usa sessão do Supabase. As Server Actions de `/urna` leem o cookie, calculam os hashes e chamam as funções SQL `check_code` e `cast_vote` com a chave secreta (só o `service_role` pode executá-las). O estado da urna é consultado em `GET /api/urna/estado` a cada 3 s.
- Middleware do Next.js bloqueia `/admin`, `/juri` e `/telao` sem sessão válida.

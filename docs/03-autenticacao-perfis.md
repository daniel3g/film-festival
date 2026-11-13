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

1. Admin → Votação → **Parear urna**. O sistema cria um `device` (por exemplo, "Urna 2") e mostra um **código de pareamento de 6 dígitos**, válido por 10 minutos.
2. No computador da urna, o admin abre `/urna`, digita o código de pareamento e escolhe a cerimônia.
3. O servidor devolve um **token do dispositivo** (aleatório, 32 bytes), guardado em cookie `httpOnly` com validade até o fim do dia. No banco fica só o hash.
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
- A urna não usa sessão do Supabase. Ela chama `POST /api/urna/votar`, que valida o token do dispositivo e chama a função SQL `cast_vote` com o cliente `service_role`.
- Middleware do Next.js bloqueia `/admin`, `/juri` e `/telao` sem sessão válida.

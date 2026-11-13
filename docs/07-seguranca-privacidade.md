# 7 · Segurança e privacidade

## Dados pessoais tratados (LGPD)

| Dado | Titular | Finalidade | Minimização |
|---|---|---|---|
| Nome curto e personagem | Alunos do elenco (**menores**) | Créditos e categorias de atuação | Só o primeiro nome ou nome artístico; sem sobrenome, RA, data de nascimento ou foto do aluno |
| Imagem e voz nos vídeos | Alunos do elenco (**menores**) | Exibição na cerimônia e na galeria | Vídeos numa pasta do Drive **pública por link** (não indexada, mas acessível a quem tiver o link); o link nunca aparece em página pública de filme bloqueado; galeria só com autorização |
| E-mail e nome | Jurados e admin | Login e autoria das notas | Jurados só com e-mail da escola; admins por lista |
| Notas | Jurados | Resultado do júri | Visíveis só para o admin |
| Voto | Alunos votantes | Resultado do People's Choice | **Anônimo:** sem nome, sem código ligado ao voto |

- **Base legal:** atividade pedagógica da escola, sob responsabilidade da instituição. A exibição **pública** de imagem de menores exige **autorização dos responsáveis** (termo de uso de imagem). Por isso a galeria nasce bloqueada.
- **Retenção:** notas, votos e logs ficam guardados como histórico da edição. Os vídeos ficam na pasta do Drive do admin. Pedidos de remoção: o admin bloqueia o filme na galeria, remove o integrante do elenco e, se for o caso, tira o arquivo do Drive ou muda o compartilhamento para "restrito".
- **Operadores:** Supabase, Vercel e Google tratam os dados em nome da escola. Ver [Decisões em aberto](09-decisoes-em-aberto.md) sobre o aval da coordenação.

## Ameaças e controles

| Ameaça | Controle |
|---|---|
| Aluno vota duas vezes | Código de uso único, queimado de forma atômica (`UPDATE … WHERE used_at IS NULL`) |
| Votar de fora da escola ou do celular | Voto só aceito de **urnas pareadas** (token do dispositivo em cookie `httpOnly`) |
| Adivinhar códigos | 22⁴ ≈ 234 mil combinações para 90 válidos; limite de tentativas por urna (5 erros seguidos → 10 s de espera); e só de urnas pareadas |
| Vazamento do banco revelar códigos | Códigos guardados como `sha256(pepper ‖ código)`; o pepper fica só na Vercel |
| Alguém ver o resultado antes | Parcial oculta até encerrar; notas só para o admin, via RLS e views protegidas; o projetor nunca recebe o que ainda não deve mostrar |
| Jurado alterar nota depois do prazo | Trigger bloqueia escrita com `jury_status = closed` |
| Jurado ver notas dos outros | RLS: `scores` com `juror_id = current_juror_id()` |
| Filme bloqueado aparecer na galeria | A galeria lê só de `v_gallery`; o `drive_file_id` de filme bloqueado nunca vai para página pública |
| Link do vídeo vazar | Risco aceito (pasta pública por link). Não divulgar o link da pasta; compartilhar arquivo a arquivo; após o evento, mudar para "restrito" os filmes sem termo de imagem |
| Chave `service_role` exposta | Só em variáveis de ambiente do servidor; nunca com prefixo `NEXT_PUBLIC_` |
| Chave de API do Google usada por terceiros | Restrita à Drive API e ao domínio da plataforma; só lê arquivos que já são públicos |
| Ação indevida do admin | `audit_log` de abrir e encerrar votação, desempates, galeria e reaberturas |

## Integridade do resultado

- Ao encerrar a votação, o sistema grava um **resumo assinado** (hash) da contagem por filme e da lista de códigos usados no `audit_log`.
- Após o evento: **exportação CSV** de notas (por jurado), votos agregados, desempates e log, guardada pela coordenação.
- O resultado oficial é o que está no painel do admin no momento da revelação.

## Boas práticas de operação

- Urnas em **Chrome no modo quiosque** (`--kiosk https://…/urna`), sem outras abas, com o usuário do sistema operacional sem privilégios.
- Notebook do telão: desligar notificações, atualizações automáticas e proteção de tela; manter na tomada.
- Admin faz logout das urnas e do telão ao final do dia.

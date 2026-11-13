# 9 · Decisões em aberto e pendências

## Já decidido (registro)

| Tema | Decisão |
|---|---|
| Stack | Next.js + Supabase, na Vercel; vídeos no Google Drive |
| Login | Admin e jurados com o Google da escola; alunos sem login |
| Voto | Código anônimo por cerimônia, cartão impresso entregue na porta, uso único |
| Urnas | 3 computadores com internet; a urna antiga da escola não será reaproveitada |
| Revelação | Júri só depois de encerrada a votação; indicados em ordem aleatória; notas nunca no telão |
| Ordem dos prêmios | Roteiro → Figurino e Maquiagem → Filmagem → Atriz → Ator → Melhor Filme → People's Choice |
| Cerimônias | 3 independentes; prêmios por cerimônia; jurados avaliam os 10 filmes |
| Desempate do júri | Rodada com os jurados (maioria simples) → voto de minerva do admin |
| Desempate do público | Votos → Melhor Filme do júri → média geral → prêmio dividido |
| Offline | Filmes e trilha baixados na véspera, no navegador do notebook |
| Trilha | Estilo clássico, igual nas 3 cerimônias; faixas livres de direitos, trocáveis |
| Galeria | Bloqueada por padrão; liberação por edição e por filme, com efeito real no Drive |

## Em aberto (precisa de decisão)

| # | Questão | Quem decide | Impacto | Sugestão |
|---|---|---|---|---|
| D1 | Qual é o **domínio** Google da escola e quem administra o Workspace? | TI da escola | Login e Drive | — |
| D2 | O Workspace permite compartilhar arquivos com **"qualquer pessoa com o link"**? | Admin do Workspace | Galeria pública | Se não permitir, a galeria vira "só a escola" ou usa outra hospedagem de vídeo |
| D3 | Pode criar um **projeto no Google Cloud** com conta de serviço e OAuth? Em qual conta? | TI da escola | Login e Drive API | Projeto na conta da escola, não em conta pessoal |
| D4 | Os vídeos vão para um **Drive compartilhado** do festival? | Organização | Download e permissões | Sim, um Drive compartilhado "Film Festival 2026" |
| D5 | Formato dos vídeos | Turmas | Reprodução no Chrome | MP4 (H.264 + AAC), 1080p no máximo |
| D6 | Endereço da plataforma | Organização | Divulgação | `filmfestival-<escola>.vercel.app` por enquanto |
| D7 | Prazo para os jurados terminarem as notas | Organização | Desempates antes do evento | Sexta 21/11 |
| D8 | **Termo de uso de imagem** dos alunos para a galeria | Coordenação | Galeria pública | Galeria só depois do evento, com os termos recolhidos |
| D9 | Coordenação ciente do uso de Supabase, Vercel e Google (LGPD) | Coordenação | Conformidade | Nota curta explicando dados e finalidade |
| D10 | Plano B das urnas: votação em papel + **lançamento manual** no sistema? | Organização | Escopo | Sim, como último recurso e com registro no log |
| D11 | Segundo notebook de reserva para o telão? | Organização | Risco no dia | Recomendado |
| D12 | Quem é admin, além de você? | Organização | Acesso | Pelo menos 2 admins |
| D13 | Faixas da trilha: quais músicas livres usar | Você / turmas | Trilha | Eu sugiro uma lista; vocês aprovam |

## Pendências da escola (dados)

| Item | Para quando | Usado em |
|---|---|---|
| Elenco de cada turma (nome curto, personagem, quem é avaliado e se é ator ou atriz) | 15/11 | Cadastro, júri |
| Arquivos de vídeo finais | **16/11** | Júri (precisa estar no ar em 17/11) |
| Pôsteres dos filmes | 19/11 | Telão, urna, galeria |
| E-mails institucionais dos jurados | 15/11 | Login do júri |
| Número de alunos por turma votante | 18/11 | Quantidade de cartões (hoje: 90 por cerimônia) |
| Equipamento: notebook do telão, projetor, cabo HDMI, som, 3 urnas | 21/11 | Ensaio geral |

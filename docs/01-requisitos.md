# 1 · Requisitos e restrições

## Números do evento

| Item | Valor |
|---|---|
| Data | 24/11/2026 |
| Cerimônias | 3, independentes (prêmios e votos separados) |
| Filmes | 10 no total: Junior manhã 2, Senior 6, Junior tarde 2 |
| Categorias por cerimônia | 7: 6 do júri + People's Choice |
| Indicados por categoria | Até 3. Com 3 concorrentes ou menos, todos aparecem |
| Jurados | Poucos (cerca de 5); cada um avalia **os 10 filmes** |
| Votantes por cerimônia | 60 a 80 alunos |
| Urnas | 3 computadores, todos com internet |
| Fila de votação estimada | 10 a 12 minutos com 3 urnas |
| Tamanho dos vídeos | Cerca de 350 a 600 MB por filme (estimado; confirmar) |

### Cerimônias

| Cerimônia | Horário | Público | Filmes |
|---|---|---|---|
| Junior Premiere – manhã | 8h–9h30 | 6th e 7th | 2 |
| Senior Premiere | 10h40–12h | 8th e 9th | 6 |
| Junior Premiere – tarde | 14h–15h30 | 5th, 6th e alunos da manhã | 2 |

## Requisitos funcionais

### RF-1 · Cadastro (admin)
- RF-1.1 Criar **edições** (2026 Classics, 2027…). O histórico das edições anteriores é preservado.
- RF-1.2 Criar cerimônias da edição, com horário, público e prefixo dos códigos (`JM`, `SR`, `JT`).
- RF-1.3 Cadastrar filmes: título, turma, cerimônia, arquivo no Google Drive e pôster.
- RF-1.4 Cadastrar o elenco de cada filme e marcar quem é **avaliado** (concorre a Melhor Ator/Atriz) e em qual das duas categorias.
- RF-1.5 Cadastrar os jurados pelo e-mail institucional.
- RF-1.6 Cadastrar a trilha sonora: uma faixa por momento da cerimônia, igual nas 3 cerimônias, com troca opcional por cerimônia.

### RF-2 · Júri
- RF-2.1 O jurado entra com a conta Google da escola. Só e-mails cadastrados têm acesso.
- RF-2.2 Assiste a cada filme dentro da plataforma (streaming do Drive) e dá as notas na mesma tela.
- RF-2.3 As notas vão de **0 a 10, com meio ponto**: Melhor Filme, Roteiro, Figurino e Maquiagem, Filmagem, e atuação de cada integrante avaliado do elenco.
- RF-2.4 As notas são salvas automaticamente e podem ser alteradas até o admin **encerrar a avaliação**.
- RF-2.5 O admin acompanha o progresso por jurado e por filme.

### RF-3 · Votação do público (People's Choice)
- RF-3.1 O admin gera **90 códigos anônimos por cerimônia**, em 3 lotes de 30, e exporta um PDF de cartões para impressão.
- RF-3.2 O código vale **uma vez** e **só na sua cerimônia**.
- RF-3.3 Na urna, o aluno digita o código, escolhe um filme da cerimônia e confirma. O código é "queimado".
- RF-3.4 O admin abre e encerra a votação de cada cerimônia. O resultado parcial fica oculto até o encerramento.
- RF-3.5 Contador de votos ao vivo no painel do admin e no telão.

### RF-4 · Cerimônia (telão)
- RF-4.1 Roteiro: abertura → (cartela + filme) × N → chamada para votação (com bastidores e contador) → votação encerrada → para cada categoria: apresentação, indicados, vencedor → People's Choice → encerramento.
- RF-4.2 Ordem dos prêmios: **Roteiro → Figurino e Maquiagem → Filmagem → Atriz → Ator → Melhor Filme → People's Choice**.
- RF-4.3 Os indicados aparecem em **ordem aleatória**, sem ranking. Depois vem o vencedor. **Notas nunca aparecem no telão.**
- RF-4.4 A tela fica no vencedor até o admin avançar (entrega de troféu e foto).
- RF-4.5 Duas telas: o **projetor** mostra o que a plateia vê; o **notebook** mostra o painel de controle (passo atual, próximo, cronômetro, contador de votos, vencedor conhecido).
- RF-4.6 Controle por setas do teclado ou passador de slides. O roteiro do apresentador fica no papel.
- RF-4.7 Filmes e trilha são **baixados na véspera** e tocam do disco, sem depender da internet.
- RF-4.8 Trilha sonora por momento, com fades automáticos, volume e tecla **M** para silenciar.
- RF-4.9 Avançar para "Votação encerrada" encerra a votação daquela cerimônia.

### RF-5 · Galeria pública (pós-evento)
- RF-5.1 Página pública, sem login, com os filmes liberados e seus prêmios.
- RF-5.2 Liberação em dois níveis: a edição inteira e cada filme. O padrão é **bloqueado**.
- RF-5.3 Liberar ou bloquear muda a **permissão real** do arquivo no Drive e fica registrado no log (quem e quando).
- RF-5.4 Filme bloqueado não aparece de forma nenhuma: nem título, nem pôster, nem prêmio.

## Requisitos não funcionais

| ID | Requisito |
|---|---|
| RNF-1 | **Prazo:** cadastro, júri, votação e telão em produção antes de 24/11. O júri precisa estar no ar com antecedência, para os jurados terem tempo de avaliar |
| RNF-2 | **Offline no telão:** depois de preparado, o modo apresentação funciona sem internet, exceto pelo contador e pelo resultado do People's Choice |
| RNF-3 | **Urna rápida:** do código ao voto confirmado em menos de 30 s por aluno; resposta do servidor abaixo de 1 s |
| RNF-4 | **Integridade:** nenhum código vota duas vezes, mesmo com cliques duplos ou duas urnas ao mesmo tempo |
| RNF-5 | **Anonimato:** o voto não é ligado a nenhum aluno |
| RNF-6 | **Sigilo:** notas e parciais visíveis só para o admin |
| RNF-7 | **Navegador:** Google Chrome atualizado no notebook do telão e nas urnas |
| RNF-8 | **Custo zero:** planos gratuitos de Vercel, Supabase e Google Cloud |
| RNF-9 | **Reuso:** multi-edição. Nada específico de 2026 fixo no código |
| RNF-10 | **Idioma:** interface em português; nomes das categorias no telão em inglês, como no projeto |

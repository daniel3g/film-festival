# 5 · Regras de negócio

## Júri técnico

| Regra | Detalhe |
|---|---|
| Escala | 0 a 10, com meio ponto (0; 0,5; 1; …; 10) |
| Cobertura | Todo jurado avalia **os 10 filmes**, mesmo os de cerimônias que não vai assistir |
| Disputa | Os prêmios são calculados **por cerimônia**: um filme só concorre com os da mesma cerimônia |
| Categorias de filme | Melhor Filme, Roteiro, Figurino e Maquiagem, Filmagem: uma nota por filme |
| Atuação | Uma nota por integrante **avaliado**. Concorre em Melhor Atriz ou Melhor Ator conforme o cadastro |
| Média | Média simples **só entre os jurados que deram aquela nota**. Quem esqueceu não puxa a média para baixo |
| Edição | O jurado altera as notas até o admin encerrar a avaliação. Depois disso, fica só leitura |
| Conflito de interesse | Não há bloqueio: o jurado pode avaliar o filme da própria turma |
| Nota faltando | O painel de progresso mostra o que falta. O admin decide se cobra o jurado ou encerra assim |

## Empate no júri

Empates do júri **não** são resolvidos automaticamente.

1. Ao encerrar a avaliação, o sistema marca as categorias com empate no 1º lugar (diferença menor que 0,005 na média).
2. O admin abre uma **rodada de desempate**. Os jurados recebem o aviso na área do júri e cada um escolhe **um** dos empatados.
3. Vence quem tiver **maioria simples**.
4. Se continuar empatado, o **admin decide (voto de minerva)**. O registro guarda o método e quem decidiu.
5. O telão avisa o admin ("Empate não resolvido") se ele chegar na categoria sem a decisão registrada.

## People's Choice (votação do público)

| Regra | Detalhe |
|---|---|
| Quem vota | Alunos presentes na cerimônia, com cartão |
| Códigos | 90 por cerimônia, em lotes A, B e C de 30, com prefixo da cerimônia (`SR-K7PX`). Alfabeto sem caracteres ambíguos: `ACDEFHJKMNPRTUVWXY3479` |
| Validade | Uma vez, só na própria cerimônia, só com a votação aberta |
| Anonimato | O cartão é entregue na porta, sem nome. O voto não guarda o código |
| Opções | Os filmes da cerimônia; o aluno escolhe um |
| Parcial | Oculta (inclusive do admin) até encerrar. O total de votos aparece ao vivo |
| Encerramento | Pelo admin, em Votação, ou automaticamente ao avançar no telão para "Votação encerrada" |
| Reabrir | Permitido, com registro no log (para engano operacional) |

### Desempate do People's Choice (automático, em cascata)
1. Mais votos.
2. Empate → maior média do júri em **Melhor Filme**.
3. Empate → maior **média geral do júri** (média das 4 categorias de filme).
4. Empate → **prêmio dividido**: o telão mostra os vencedores juntos.

## Indicados e revelação

- Até **3 indicados** por categoria: os 3 primeiros do ranking. Com 3 concorrentes ou menos, todos são indicados.
- Se um desempate do júri escolheu alguém fora do top 3, essa pessoa entra no lugar do 3º.
- No telão, os indicados aparecem em **ordem aleatória** (sorteio fixo por cerimônia e categoria, para ser igual se o admin voltar a tela).
- **Notas e votos nunca aparecem no telão.** Ficam só no painel do admin ("Só você vê").

## Roteiro da cerimônia

```mermaid
flowchart LR
  A[Abertura] --> B["Cartela + Filme<br/>(× filmes da cerimônia)"]
  B --> C[Chamada para votação<br/>bastidores + contador]
  C --> D[Votação encerrada]
  D --> E["Para cada categoria do júri:<br/>apresentação → indicados → vencedor"]
  E --> F[People's Choice:<br/>apresentação → indicados → vencedor]
  F --> G[Encerramento]
```

Ordem dos prêmios do júri: **Roteiro → Figurino e Maquiagem → Filmagem → Atriz → Ator → Melhor Filme**, depois **People's Choice** como clímax.

Os prêmios do júri só são revelados **depois** de encerrada a votação (opção B), para não influenciar o voto do público.

## Galeria pública

| Regra | Detalhe |
|---|---|
| Padrão | Tudo bloqueado (direito de imagem de menores) |
| Dois níveis | Interruptor da edição **e** interruptor de cada filme. O filme só aparece com os dois ligados |
| Efeito | Só na plataforma: o filme passa a aparecer (ou some) da galeria. O arquivo no Drive continua público por link o tempo todo |
| Invisibilidade | Filme bloqueado não aparece de forma nenhuma: nem título, nem pôster, nem prêmio |
| Auditoria | Toda mudança vai para o `audit_log`, com quem, quando e o estado anterior |

## Trilha sonora

| Momento do roteiro | Faixa | Comportamento |
|---|---|---|
| Abertura | `abertura` | Toca uma vez e passa para `ambiente` |
| Cartela, Filme | silêncio | Fade-out; o filme tem áudio próprio |
| Chamada para votação | `bastidores` | Loop |
| Votação encerrada, apresentação da categoria | `ambiente` | Loop, volume baixo |
| Indicados | `suspense` | Loop, entrada lenta (2,5 s) |
| Vencedor (júri) | `fanfarra` | Uma vez e passa para `ambiente` |
| Vencedor People's Choice | `fanfarra_pc` | Uma vez e passa para `ambiente` |
| Encerramento | `encerramento` | Loop |

- A trilha é a mesma nas 3 cerimônias. O admin pode trocar uma faixa só numa cerimônia.
- Começa com faixas clássicas **livres de direitos autorais**. A escola pode trocar por upload.
- Transições com crossfade de cerca de 1,2 s. Tecla **M** silencia; o volume fica no painel.

# 8 · Cronograma e testes

Docs escritos em **qui 12/11**; revisados em 13/11. Festival: **ter 24/11**.

A ordem segue as **dependências do evento**, não a dos módulos: os jurados precisam de dias para avaliar, então o júri sai primeiro. O telão é o último porque só precisa estar pronto na véspera.

## Plano

```mermaid
gantt
  dateFormat  YYYY-MM-DD
  axisFormat  %d/%m
  section Base
  Docs + setup (Supabase, Vercel, Google Cloud)   :a1, 2026-11-12, 2d
  Schema, RLS, seed                               :a2, 2026-11-13, 1d
  section Cadastro + Júri
  Admin: edição, cerimônias, filmes, elenco       :b1, 2026-11-14, 2d
  Júri: login, player, notas, progresso           :b2, 2026-11-15, 2d
  Júri no ar (jurados avaliando)                  :milestone, m1, 2026-11-16, 0d
  section Votação
  Códigos, cartões PDF, pareamento, urna          :c1, 2026-11-16, 2d
  Resultados, desempates                          :c2, 2026-11-19, 1d
  section Telão
  Painel + projetor + roteiro                     :d1, 2026-11-19, 2d
  Offline (OPFS) + trilha                         :d2, 2026-11-20, 2d
  section Fechamento
  Testes integrados + correções                   :e1, 2026-11-22, 1d
  Ensaio geral no local + download + impressão    :e2, 2026-11-23, 1d
  Festival                                        :milestone, m2, 2026-11-24, 0d
```

| Marco | Data | Depende de |
|---|---|---|
| Ambientes no ar (Vercel + Supabase + login Google) | 14/11 | Contas no Gmail do admin (decidido) |
| **Júri no ar** | **seg 16/11** | **Vídeos no Drive**, elenco e e-mails dos jurados (até dom 15/11) |
| Avaliação do júri encerrada | sex 20/11 (sugestão) | Jurados |
| Cartões impressos | seg 23/11 | Votação pronta em 19/11 |
| Ensaio geral | seg 23/11 | Tudo |

### Se atrasar, cortar nesta ordem
1. Galeria pública (pode sair depois do evento)
2. Upload e troca de trilha (usar as faixas padrão)
3. Window Management API (arrastar a janela à mão)

O que **não** pode ser cortado: notas do júri, código de uso único, roteiro do telão e filmes offline.

## Testes

### Automatizados (regras críticas)
| Alvo | Casos |
|---|---|
| `cast_vote` | Código válido; usado; de outra cerimônia; inexistente; votação fechada; filme de outra cerimônia; **duas chamadas simultâneas com o mesmo código, só uma vence** |
| Médias do júri | Média ignora jurado sem nota; meio ponto; empate detectado |
| Indicados | Até 3; com ≤ 3 concorrentes, todos; vencedor de desempate entra no top 3; ordem aleatória estável |
| People's Choice | Cascata: votos → Melhor Filme → média geral → dividido |
| RLS | Jurado não lê notas alheias; público não lê filmes bloqueados; anônimo não grava voto |
| Roteiro | Número e ordem dos passos por cerimônia; ordem dos prêmios |

### Teste de carga da urna
Simular 80 votos em 10 minutos vindos de 3 urnas, com rajadas. Meta: p95 abaixo de 1 s, zero código duplicado.

### Ensaio geral (23/11, no local, com o equipamento real)
- [ ] Notebook do telão: Chrome, 2 telas, som pelo HDMI ou caixa, passador funcionando
- [ ] Download dos filmes e da trilha das 3 cerimônias, todos "verificados"
- [ ] Modo apresentação completo de uma cerimônia **com a internet desligada**
- [ ] 3 urnas pareadas, em modo quiosque, na internet da biblioteca
- [ ] Votar com 3 cartões de teste e conferir o contador no telão (depois, zerar a votação de teste)
- [ ] Cartões impressos, separados por cerimônia e lote
- [ ] Pendrive com os arquivos (plano B do telão) e cópia do roteiro em papel
- [ ] Celular com 4G pronto para virar roteador das urnas
- [ ] Avaliação do júri encerrada, sem empates pendentes
- [ ] Projeto Supabase ativo (o plano gratuito pausa após 7 dias sem uso)

## Critério de pronto (por funcionalidade)
- Funciona no Chrome do equipamento real, não só no computador de desenvolvimento
- Tem teste automatizado se mexe em voto, nota ou resultado
- Erros mostram mensagem em português que diz o que fazer
- Ações do admin que mudam resultado ou permissão ficam no `audit_log`

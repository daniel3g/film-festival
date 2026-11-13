# Film Festival 2026 · Documentação técnica

> Plataforma de apoio ao **Film Festival 2026 – Classics Edition**.
> Festival: **24/11/2026**, na biblioteca da escola. (O PDF do projeto ainda diz 10/11; a data válida é 24/11.)
> Última atualização: 12/11/2026.

## O que a plataforma faz

Ela cobre o festival de ponta a ponta, em 3 cerimônias independentes no mesmo dia:

| Perfil | Quem usa | O que faz |
|---|---|---|
| **Admin** | Organização (professor responsável) | Cadastra edição, cerimônias, filmes, elenco, pôsteres, jurados e trilha. Acompanha o júri, gera os códigos de voto, resolve empates e conduz a cerimônia |
| **Jurado** | Júri técnico, quase todos professores | Entra com o Google da escola, assiste aos filmes e dá as notas de 0 a 10 por categoria |
| **Urna** | Os 3 computadores de votação | O aluno digita o código do cartão e vota no People's Choice |
| **Telão** | Notebook do admin + projetor | Modo apresentação: roteiro da cerimônia, filmes offline, trilha sonora, contador de votos e revelação dos prêmios |
| **Público** | Qualquer pessoa, depois do evento | Galeria com os filmes que o admin liberou |

## Escopo

**Dentro da v1 (até 24/11):** cadastro, júri, votação, cerimônia (telão + offline + trilha).

**Pode ficar para depois do evento:** galeria pública (depende da autorização de imagem), troca de trilha por cerimônia e relatórios de exportação.

**Fora do escopo:** checklist e equipes da organização, venda ou controle de ingressos, transmissão ao vivo.

## Índice

| # | Documento | Conteúdo |
|---|---|---|
| 1 | [Requisitos e restrições](01-requisitos.md) | Funcionais, não funcionais, números do evento |
| 2 | [Arquitetura e stack](02-arquitetura.md) | Componentes, hospedagem, integrações, estrutura do código |
| 3 | [Autenticação e perfis](03-autenticacao-perfis.md) | Login, papéis, pareamento das urnas, permissões |
| 4 | [Modelo de dados](04-modelo-de-dados.md) | Tabelas, relações, views de resultado, RLS |
| 5 | [Regras de negócio](05-regras-de-negocio.md) | Júri, votação, desempates, indicados, galeria |
| 6 | [Telão, offline e trilha](06-telao-offline-trilha.md) | Duas janelas, download dos filmes, áudio, plano B |
| 7 | [Segurança e privacidade](07-seguranca-privacidade.md) | LGPD, menores, sigilo, integridade do voto |
| 8 | [Cronograma e testes](08-cronograma-testes.md) | Plano até 24/11, ensaio geral, critérios de pronto |
| 9 | [Decisões em aberto](09-decisoes-em-aberto.md) | O que falta decidir e o que falta a escola enviar |

## Referências

- Projeto pedagógico: `Film_Festival_2026_Projeto_Atualizado.pdf` (raiz do repositório)
- Protótipo navegável (dados de exemplo): https://claude.ai/artifact/T9bD5eM33DntHe9HLNjLzm

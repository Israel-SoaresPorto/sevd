# DECISIONS.md — Registro de Decisões Técnicas e de Arquitetura

Este documento registra as decisões de arquitetura e produto do **SEVD**, mantendo o histórico de trade-offs e evolução técnica.

---

## 1. Decisões Iniciais (MVP v1.0)

| ID | Decisão | Motivação / Contexto |
| :--- | :--- | :--- |
| **D-01** | **PWA Local-First com Hono Serverless** | O produto é um PWA local-first com banco no navegador (IndexedDB via Dexie.js) apoiado por funções serverless stateless no MVP (`v1.0`), preparando a base para sincronização e backup em nuvem na `v1.1`. |
| **D-02** | **Captura Dual (Externa `/save` vs Interna Modal)** | Captura dividida em: externa via rota enxuta `/save` (para Web Share Target e Bookmarklet com `source=bookmarklet`) e interna via Modal no Dashboard (Colar/Novo link e Editar, sem transição de rota desnecessária). |
| **D-03** | **Preferências em `localStorage`** | Configurações de UI unificadas em `localStorage` (`theme`, `viewMode`, `sortBy`, `fetchMetadata`, `faviconMode`, timestamps de backup); aplicação anti-FOUC de tema por script inline no `<head>`. |
| **D-04** | **`navigator.storage.persist()`** | Solicitação de armazenamento persistente para evitar que o navegador descarte o IndexedDB sob pressão de espaço de disco. |
| **D-05** | **Backup Local Manual (P0 no v1.0)** | Exportação e importação manual sob demanda em Configurações (`.json` com lápides e `.md` legível), sem dependência inicial de nuvem ou autenticação. |
| **D-06** | **Atalhos de Teclado Internos** | Atalhos focados no contexto do app (`/` e `Ctrl+K` para busca, `Ctrl+Enter` para salvar, `Esc` para fechar modais/dropdowns). |
| **D-07** | **Soft Delete com Lápides sem Índices Únicos Físicos (`&`) no Dexie** | Permite que registros excluídos logicamente coexistam com novos registros da mesma URL canônica; ressurreição transparente e cascata de `updatedAt` ao gerenciar categorias; tags como `string[]` leve no próprio link sem tabela dedicada; lista fechada de tracking params para normalização canônica. |
| **D-08** | **Monorepo com `pnpm workspaces` e TanStack Router** | Isolamento de fronteiras estritas entre `@sevd/core`, `@sevd/api` e `@sevd/web`; roteamento client-side tipado via History API; servidor serverless Hono desacoplado e publicável no Cloudflare Workers. |

---

## 2. Decisões Novas

| ID | Decisão | Motivação / Contexto | Data |
| :--- | :--- | :--- | :--- |
| **D-09** | **Adoção do Zod em substituição ao Valibot** | Adotado o **Zod** para validação estrutural do arquivo de backup ([backup.schema.ts](file:///mnt/nvme0n1p6/israel/Projetos/sevd/packages/core/src/schemas/backup.schema.ts)) em substituição ao Valibot. O Zod é o padrão da indústria com maior estabilidade e ergonomia no ecossistema TypeScript. Como o schema é carregado sob demanda (*dynamic import*) exclusivamente no fluxo de importação na rota `/settings`, a diferença de tamanho de bundle tem impacto nulo no carregamento inicial do PWA e na latência de captura da rota `/save`. | 2026-11-08 |
| **D-10** | **`URL` global no lugar de `node:url` no core** | `@sevd/core` deve ser puro e rodar em Workers/navegador; removido `import { URL } from "node:url"` de `url-normalizer.ts` e `url-validator.ts`. O `eslint.config.mjs` passou a declarar os globais Web (`URL`, `fetch`, etc.) para `no-undef`. | 2026-11-08 |
| **D-11** | **`/api/metadata` responde com erro HTTP em falhas** | Em vez de `200` com `title: null`, falhas retornam erro correspondente com corpo `{ error }` e `Cache-Control: no-store`: `400 invalid_url`, `403 blocked_url`, `415 not_html`, `502 too_many_redirects`, `502 fetch_failed`, `504 timeout`. `200` com `title: null` fica só para página HTML sem título. O cliente (T-043) deve tratar os erros sem bloquear o botão Salvar. | 2026-11-08 |

---

## 3. Ideias Adiadas (Backlog v1.1+)

- Sincronização multi-dispositivo ponta a ponta com autenticação e servidor dedicado.
- Lixeira visual com visualização e restauração manual de lápides.
- Verificador periódico de integridade e links quebrados (Dead link checker).
- Extensão dedicada de navegador para Chromium e Firefox.

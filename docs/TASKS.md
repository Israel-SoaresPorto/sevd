# TASKS.md — Plano de implementação do SEVD (MVP v1.0)

**Como usar:** execute **uma tarefa por vez**, na ordem das dependências. Prompt sugerido para o agente:
> Leia `AGENTS.md` e implemente **T-0XX** conforme `docs/TASKS.md`, respeitando escopo e critérios de aceite.

**Legenda de status:** `[ ]` pendente · `[~]` em andamento · `[x]` concluída
**Referências:** `RF-xx` / `RNF-x` = PRD · `A§x` = architecture-sevd.md

**Comandos padrão de verificação** (devem existir após T-001/T-002):
`pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm --filter @sevd/core test` · `pnpm --filter @sevd/api test` · `pnpm --filter @sevd/web test` · `pnpm --filter @sevd/web e2e`

**Regra para arquivos de configuração existentes (vale para todas as tarefas):**
- Antes de criar `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `eslint.config.*` etc., verifique se o arquivo já existe. Se existir, **edite**; não recrie.
- **Não use scaffolders** (`pnpm create vite`, `create-*`) em pastas que já têm arquivos. Eles sobrescrevem `package.json` e `tsconfig.json`.
- Antes de rodar geradores que alteram arquivos (`shadcn init`, `shadcn add`), faça `git commit`; depois confira o `git diff` e reverta qualquer perda de `extends ../../tsconfig.base.json`, do alias `@/*`, da dependência `@sevd/core: workspace:*` ou de scripts existentes.

---

## Mapa de fases

| Fase | Foco | Tarefas |
| :-- | :-- | :-- |
| 0 | Fundação do monorepo | T-001 … T-003 |
| 1 | Domínio puro (`@sevd/core`) | T-010 … T-016 |
| 2 | Funções serverless (`@sevd/api`) | T-020 … T-025 |
| 3 | Dados e serviços (`@sevd/web`) | T-030 … T-036 |
| 4 | Interface e rotas | T-040 … T-054 |
| 5 | PWA, qualidade e deploy | T-060 … T-064 |

> As Fases 1 e 2 são independentes entre si e podem andar em paralelo (agentes diferentes, branches diferentes).

---

## FASE 0 — Fundação

### [ X ] T-001 — Esqueleto do monorepo
- **Objetivo:** criar o workspace pnpm com os três pacotes compilando e testáveis.
- **Escopo:** `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `package.json` raiz com scripts (`dev`, `build`, `test`, `lint`, `typecheck`), `tsconfig.base.json` strict, `packages/core`, `apps/api`, `apps/web` com `package.json` e `tsconfig.json` mínimos, Vitest configurado nos três. `@sevd/core` consumido via `workspace:*`. Os `package.json` e `tsconfig.json` de `apps/web` são **mínimos e provisórios**: a T-030 os **estende**, não os recria.
- **Fora do escopo:** qualquer código de negócio, React, Dexie, Hono rotas.
- **Arquivos:** raiz, `packages/core/*`, `apps/api/*`, `apps/web/package.json|tsconfig.json`.
- **Dependências:** nenhuma.
- **Aceite:** `pnpm install` ok; `pnpm typecheck` e `pnpm test` rodam (mesmo com 1 teste "smoke" por pacote); `apps/web` e `apps/api` importam algo de `@sevd/core` sem erro.
- **Verificar:** `pnpm install && pnpm typecheck && pnpm test`

### [ X ] T-002 — Lint e regras de fronteira
- **Objetivo:** impor a matriz de fronteiras (A§3.1) via ESLint.
- **Escopo:** ESLint flat config com `no-restricted-imports`/`eslint-plugin-boundaries` (ou equivalente) para cada camada; script `pnpm lint`.
- **Fora do escopo:** Prettier/husky (opcional, só se pedido); regras específicas de React/hooks (entram na T-030, estendendo este config).
- **Dependências:** T-001.
- **Aceite:** um import proibido proposital (ex.: `dexie` em `packages/core`, `services` em `ui`) **falha** o lint; remover o import faz passar.
- **Verificar:** criar arquivo temporário com import proibido, rodar `pnpm lint`, remover.

### [ X ] T-003 — Documentos de projeto
- **Objetivo:** colocar os docs onde o agente os encontra.
- **Escopo:** mover/copiar `prd-sevd.md` e `architecture-sevd.md` para `docs/`, criar `docs/DECISIONS.md` com as decisões D-01 a D-08 do PRD §9 e as seções "Decisões novas" e "Ideias adiadas".
- **Dependências:** T-001.
- **Aceite:** `docs/` contém os 4 arquivos; links relativos funcionam.

---

## FASE 1 — Domínio puro (`@sevd/core`)

> Regra da fase: **sem** React, Dexie, Hono ou DOM. Testes unitários obrigatórios em `packages/core/tests/`.

### [ X ] T-010 — Tipos e constantes
- **Objetivo:** contratos e limites compartilhados.
- **Escopo:** `types.ts` (A§4.1: `ColorToken`, `CategoryIcon`, `SyncFields`, `Bookmark`, `Category`, `UserPreferences`, `BackupPayloadV1`, `MetadataDTO`), `constants.ts` (limites 200/280/50/20/5, 8 cores, 24 ícones, `DEFAULT_PREFERENCES`, lista de tracking params), `index.ts` barrel.
- **Fora do escopo:** tipo `Tag`; qualquer lógica.
- **Aceite:** tipos exatamente como A§4.1; nenhum `Tag`; `pnpm --filter @sevd/core typecheck` limpo.

### [ X ] T-011 — Validação de URL
- **Escopo:** `url-validator.ts`: `isValidHttpUrl`, `extractDomain` (hostname minúsculo, sem `www.`), `InvalidUrlError`.
- **Refs:** RF-04.
- **Dependências:** T-010.
- **Aceite (testes):** aceita `http`/`https`; rejeita `ftp:`, `javascript:`, `data:`, strings vazias e malformadas; domínio de `https://www.Exemplo.com/x` = `exemplo.com`.

### [ X ] T-012 — Normalizador de URL
- **Escopo:** `url-normalizer.ts` com `normalizeUrl()` nas **6 etapas exatas** (A§4.2). Remove credenciais embutidas.
- **Refs:** PRD §3.2.
- **Dependências:** T-010, T-011.
- **Aceite (testes):** `http://` ≡ `https://`; remove só `www.` (preserva `www2.`, `m.`); remove `:80`/`:443`; preserva `#/` e `#!`, remove `#secao`; remove `utm_*`, `fbclid`, `gclid`, `dclid`, `msclkid`, `twclid`, `igshid`, `mc_cid`, `mc_eid`, `ref`, `ref_src`, `si` (case-insensitive) e **mantém** outros params; ordena query; `https://exemplo.com/` → `https://exemplo.com`; `…/docs/` → `…/docs`; idempotente (`normalize(normalize(x)) === normalize(x)`).

### [ X ] T-013 — Extração de compartilhamento
- **Escopo:** `share-extractor.ts` (A§4.3): usa `url` se válida; senão primeira URL em `text` (limpando `. , ; )` finais); resto do `text` vira nota (trim, espaços colapsados, ≤ 280).
- **Refs:** RF-01, RF-04.
- **Dependências:** T-010, T-011.
- **Aceite (testes):** textos reais de YouTube/X/Chrome; `url` vazia + `text` com URL no meio; sem URL → resultado "inválido"; esquema não-http → inválido; nota truncada em 280.

### [ ] T-014 — Busca de texto e cor determinística
- **Escopo:** `text-search.ts` (NFD, sem acentos, minúsculas; helper `matchesQuery`) e `color-hash.ts` (`getDeterministicColor(name)` → ColorToken **exceto `zinc`**).
- **Refs:** RF-06, RF-12, RNF-4.
- **Dependências:** T-010.
- **Aceite (testes):** `"programação"` casa com `"programacao"`; hash estável (mesmo nome → mesma cor) e nunca `zinc`.

### [ ] T-015 — Schema de backup (Valibot)
- **Escopo:** `backup.schema.ts` para `BackupPayloadV1` (estágio 1, A§5.2-C): `version === 1`, arrays `bookmarks` e `categories`, tipos primitivos.
- **Dependências:** T-010. (Única tarefa que usa `valibot`; aprovar a dependência.)
- **Aceite (testes):** payload válido passa; `version: 2`, array ausente ou tipo errado falham com erro legível.

### [ ] T-016 — Sanitizador e mesclagem LWW
- **Objetivo:** estágios 2 e 3 do import, como funções **puras**.
- **Escopo:** `backup-sanitizer.ts`: `sanitizePayload(payload) → { payload, report }` (descarta URL inválida, recalcula `normalizedUrl`/`domain`, trunca título/nota/nome, normaliza tags, cor/ícone desconhecidos → `zinc`/`Folder`) e `mergeBackup(local, imported) → { bookmarks, categories, categoryIdRemap, summary }`.
- **Refs:** RF-18, A§5.2-C.
- **Dependências:** T-010, T-011, T-012, T-015.
- **Aceite (testes):** vence o maior `updatedAt`, inclusive lápide; categoria casada por nome case-insensitive mantém `id` local e preenche `categoryIdRemap`; bookmark cuja categoria final está excluída/inexistente → `categoryId = null`; tags vêm do vencedor; `summary` = criados/atualizados/ignorados; relatório conta cada ajuste; **sem I/O**.
- **Observação:** é a mesma função que a v1.1 reutilizará para sync. Mantenha-a genérica.

---

## FASE 2 — Serverless (`@sevd/api`)

### [ ] T-020 — App Hono base
- **Escopo:** `apps/api/src/index.ts` exportando `export const app = new Hono().basePath('/api')` **e** `export default app` (o app Hono já é um handler `fetch` válido para Cloudflare Workers; **não criar adaptadores** como `functions/api/[[route]].ts`); rota `GET /api/health` (mantida; serve de verificação de deploy na T-063); filtro de origem como middleware (`Sec-Fetch-Site: cross-site` → `403`).
- **Fora do escopo:** metadata/favicon.
- **Dependências:** T-001.
- **Aceite (testes via `app.request`):** `cross-site` → 403; `same-origin`/ausente → passa.

### [ ] T-021 — Guarda anti-SSRF
- **Escopo:** `lib/ssrf-guard.ts`: `assertSafeUrl`, `safeFetchWithRedirects(url, { maxHops, signal })` (A§7.3). Esquema só `http(s)`, portas só 80/443/omitida; bloqueia `localhost`, `*.localhost`, `*.local`, `*.internal`, `metadata.google.internal` e IP literal em todas as faixas listadas (inclui `100.64.0.0/10`, `0.0.0.0/8`, `::ffff:0:0/96`); `redirect: 'manual'` com revalidação de cada `Location`; excede `maxHops` → erro.
- **Dependências:** T-020, T-011.
- **Aceite (testes, com `fetch` mockado):** cada faixa bloqueada; redirect público→privado bloqueado; 6º salto aborta (metadata) e 4º (favicon); URL relativa em `Location` resolvida corretamente.

### [ ] T-022 — Parser HTML em stream
- **Escopo:** `lib/html-parser.ts` (A§7.4): valida `Content-Type`; lê até 65.536 bytes ou `</head>`; `reader.cancel()`; extrai `title` (og:title → twitter:title → `<title>`, decodifica entidades, ≤ 200) e `faviconUrl` (icon → shortcut icon → apple-touch-icon → `/favicon.ico`), sempre absoluta.
- **Dependências:** T-020.
- **Aceite (testes):** corte exato em 64 KB; para ao achar `</head>`; `Content-Type` não-HTML cancela o body; entidades (`&amp;`, `&#39;`) decodificadas; favicon relativo vira absoluto contra `finalUrl`; sem regex ingênua que quebre com atributos em ordem diferente.

### [ ] T-023 — Rota `GET /api/metadata`
- **Escopo:** `routes/metadata.ts` unindo guard + parser; timeout total 3 s (`AbortSignal.timeout(3000)`); resposta `{ title, faviconUrl, finalUrl }`; `Cache-Control: public, max-age=3600, s-maxage=86400`; bloqueio/timeout/erro de site → `200` com `title: null`; `url` ausente/inválida → `400`.
- **Refs:** PRD §4.1, RNF-5.
- **Dependências:** T-021, T-022.
- **Aceite (testes):** caminho feliz; timeout → `title: null`; URL privada → erro tratado sem vazar detalhes internos; header de cache presente.

### [ ] T-024 — Rota `GET /api/favicon`
- **Escopo:** `routes/favicon.ts` (A§7.5): guard com 3 saltos e 2 s; aceita `image/*` (ou `octet-stream` terminando em `.ico`); teto de 256 KB (excedeu → `404`); headers `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=604800, s-maxage=2592000, immutable`; falha → `404` com `max-age=3600`.
- **Dependências:** T-021.
- **Aceite (testes):** SVG recebe CSP; > 256 KB → 404; `text/html` → 404; headers exatos.

### [ ] T-025 — Integração dev do Hono e `wrangler.jsonc`
- **Escopo:**
  1. **Editar** o `apps/web/vite.config.ts` existente (criado na T-030), sem recriá-lo, adicionando `@hono/vite-dev-server` (devDependency de `@sevd/web`) interceptando só `/api/*` (`exclude: [/^(?!\/api\/).*/]`, A§7.1). Apontar o `entry` do plugin para `apps/api/src/index.ts` por **caminho relativo**, sem adicionar `@sevd/api` como dependência do web (ver inconsistência nº 5 em `AGENTS.md`).
  2. **Criar** `wrangler.jsonc` na **raiz** do monorepo exatamente como em A§7.1 (`name: "sevd"`, `main: "apps/api/src/index.ts"`, `compatibility_date`, `assets.directory: "apps/web/dist"`, `not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*"]`).
  3. Instalar `wrangler` como devDependency da **raiz** (`pnpm add -D -w wrangler`) e adicionar o script raiz `preview` (`pnpm --filter @sevd/web build && wrangler dev`) para testar a mesma origem localmente.
- **Fora do escopo:** GitHub Actions e deploy em produção (T-063); adaptadores `functions/`, `hono/cloudflare-pages` ou `wrangler.toml`.
- **Dependências:** T-023, T-024, T-030.
- **Aceite:** `pnpm dev` serve `/api/metadata?url=https://developer.mozilla.org` com JSON válido (e a SPA continua sendo servida pelo Vite em `/`); `pnpm preview` serve o app buildado e as rotas `/api/*` na **mesma origem**: `/` e `/categories` devolvem o `index.html` (fallback SPA) e `/api/health` responde pelo Worker.
- **Verificar:** `curl "http://localhost:5173/api/metadata?url=https%3A%2F%2Fdeveloper.mozilla.org"`; depois `pnpm preview` e `curl -i http://localhost:8787/api/health` e `curl -i http://localhost:8787/categories` (porta padrão do `wrangler dev`; use a que ele indicar).

---

## FASE 3 — Dados e serviços (`@sevd/web`)

### [ ] T-030 — Scaffold do app web
- **Escopo:** instalar Vite + React + TS + Tailwind + shadcn/ui + `lucide-react` + TanStack Router **sobre o `apps/web` criado na T-001, sem sobrescrevê-lo**, e criar 4 rotas placeholder (`/`, `/save`, `/categories`, `/settings`), cada uma em **chunk lazy** separado; `main.tsx` e `router.tsx`; fontes/ícones empacotados localmente (RNF-3).
- **Método obrigatório (instalação manual, sem scaffolder):**
  1. `git commit` do estado atual. Dentro de `apps/web`: `pnpm add react react-dom @tanstack/react-router lucide-react`, `pnpm add -D vite @vitejs/plugin-react @types/react @types/react-dom` (e `tailwindcss @tailwindcss/vite`).
  2. **Editar** `apps/web/package.json`: acrescentar os scripts `dev` (`vite`) e `build` (`vite build`), mantendo `test`, `typecheck` e a dependência `@sevd/core: workspace:*`.
  3. **Editar** `apps/web/tsconfig.json`: manter `extends ../../tsconfig.base.json`; acrescentar `jsx: react-jsx`, `types: ["vite/client"]`, `baseUrl` e `paths { "@/*": ["./src/*"] }`; incluir `vite.config.ts` em `include`.
  4. **Criar** `vite.config.ts` (plugin React, plugin Tailwind, alias `@`, bloco `test` do Vitest com ambiente adequado), `index.html` (com `<div id="root">`) e `src/main.tsx`. Remover o `src/index.ts` provisório da T-001 só se não for mais usado, ajustando o smoke test.
  5. Rodar `pnpm dlx shadcn@latest init` dentro de `apps/web` e conferir o `git diff` (ver regra de arquivos existentes no topo). Reverter perdas de `extends`, alias ou dependências.
  6. Estender o ESLint da T-002 com regras de React/hooks para `apps/web` (sem recriar o config).
  7. Conferir que o CSS/fontes gerados pelo shadcn não importam nada de CDN externa (ex.: Google Fonts); empacotar localmente.
- **Fora do escopo:** PWA/manifest (T-060), telas reais, regras de negócio.
- **Dependências:** T-001, T-002.
- **Aceite:** `pnpm dev` abre as 4 rotas; build gera chunks distintos para `capture`, `dashboard`, `categories`, `settings`; nenhuma requisição a domínio externo no Network; `package.json` ainda contém `@sevd/core: workspace:*`; `tsconfig.json` ainda estende `../../tsconfig.base.json`; `pnpm typecheck`, `pnpm lint` e `pnpm test` continuam verdes na raiz.
- **Verificar:** `git diff --stat` não mostra remoção de scripts/dependências da T-001; `pnpm build` e inspeção da saída em `apps/web/dist/assets`.

### [ ] T-031 — Banco Dexie
- **Escopo:** `data/local/db.ts` (`SevdDatabase`, versão 1, índices **sem `&`**: `bookmarks: 'id, normalizedUrl, domain, categoryId, *tags, createdAt, updatedAt'`, `categories: 'id, name, updatedAt'`).
- **Fora do escopo:** tabela de tags; repos.
- **Dependências:** T-030, T-010.
- **Aceite (teste de integração com `fake-indexeddb`):** inserir dois bookmarks com mesma `normalizedUrl` (um ativo, um lápide) **não** dispara `ConstraintError`.

### [ ] T-032 — Repositórios e preferências
- **Escopo:** `bookmark.repo.ts`, `category.repo.ts` (CRUD cru, sem regras de negócio), `preferences.repo.ts` (leitura/escrita síncrona em `localStorage` chave `sevd_preferences`, defaults de `DEFAULT_PREFERENCES`, tolera JSON corrompido).
- **Dependências:** T-031.
- **Aceite (testes):** defaults quando vazio; JSON inválido → defaults sem lançar; gravação parcial preserva demais campos.

### [ ] T-033 — `capture.service` (salvar/atualizar link)
- **Escopo:** `saveOrUpdateBookmark` (A§5.2-A): 3 casos (ativo → atualiza mantendo `id`/`createdAt`; só lápide → **ressurreição do zero**, remove lápides duplicadas extras; nenhum → cria); `findActiveByUrl` para a pílula "Já salvo"; `enrichBookmark(id, {title, faviconUrl})` que só atualiza se `title === domain` (Caso B do A§7.2); chama `ensurePersistentStorage()` após a 1ª gravação (RF-19). Tudo em `db.transaction('rw', …)`.
- **Refs:** RF-05, RF-08, RF-19, PRD §3.1.
- **Dependências:** T-032, T-012.
- **Aceite (integração):** os 3 casos; ressurreição reinicia `createdAt`/`updatedAt` e descarta nota/tags/categoria/favorito antigos; `http://x.com/a?utm_source=y` e `https://www.x.com/a` caem no mesmo registro; `enrichBookmark` não sobrescreve título já editado.

### [ ] T-034 — `category.service`
- **Escopo:** criar (unicidade entre ativos → `DuplicateNameError`; ressurreição de lápide; defaults `Folder` + `getDeterministicColor`), renomear (colisão com lápide → exclusão física na mesma transação), editar cor/ícone, excluir com cascata (`categoryId = null` + `updatedAt` dos links ativos na mesma transação), contagem de links afetados.
- **Refs:** RF-06, RF-15, A§5.2-B.
- **Dependências:** T-032, T-014.
- **Aceite (integração):** os cenários acima, incluindo "excluir categoria atualiza `updatedAt` de **todos** os links afetados"; nome duplicado case-insensitive rejeitado; limite de 50 chars.

### [ ] T-035 — `bookmark.service` (consulta, favorito, excluir/desfazer)
- **Escopo:** `queryBookmarks({ q, view, cat, tags, sortBy })` (AND entre filtros; `view` vence `cat`; busca por título/domínio/nota via `text-search`; só ativos), `toggleFavorite`, `softDelete`, `undoDelete` (limpa `deletedAt`, preserva dados), `listActiveTags()` com contagem (**somente links ativos**), contadores por categoria/Inbox/Favoritos.
- **Refs:** RF-11, RF-12, RF-14, RF-16.
- **Dependências:** T-032, T-014.
- **Aceite (integração):** combinações de filtros; múltiplas tags em AND; ordenação `newest|oldest|alpha`; tags de link excluído **não** aparecem em `listActiveTags`; desfazer restaura todos os campos.

### [ ] T-036 — `backup.service` (exportar/importar)
- **Escopo:** exportar `.json` (`BackupPayloadV1` com lápides, sem preferências) e `.md` (ativos agrupados por categoria); gravar `lastBackupAt` **só** no `.json`; importar em 4 estágios usando `@sevd/core` (Valibot via `import()` dinâmico) com mesclagem aplicada em **transação única**; retornar `summary` + relatório.
- **Refs:** RF-17, RF-18.
- **Dependências:** T-016, T-032.
- **Aceite (integração):** exportar → limpar banco → importar restaura tudo; reimportar o mesmo arquivo = `0 criados · 0 atualizados · N ignorados`; payload inválido não altera o banco; `.md` não grava `lastBackupAt`.

---

## FASE 4 — Interface e rotas

> Regra da fase: `ui/` é puro; `features/` orquestra; nenhum componente toca em Dexie.

### [ ] T-040 — Tema sem flash e preferências na UI
- **Escopo:** **editar** o `index.html` da T-030, inserindo o script inline anti-FOUC no `<head>` (A§8.1); hook `usePreferences` (reativo, em `features/`); aplicação do tema (`system|light|dark`) também reagindo a mudança do SO.
- **Refs:** RF-21, RNF-8.
- **Dependências:** T-032, T-030.
- **Aceite:** recarregar com tema escuro não pisca branco; trocar tema atualiza classe `dark` sem reload.

### [ ] T-041 — Layouts e navegação base
- **Escopo:** `DashboardLayout` (Sidebar desktop, Drawer mobile), `MinimalCaptureLayout`, Toaster; **evoluir** o `router.tsx` da T-030 (sem recriá-lo) ligando as rotas aos layouts; search params tipados de `/` (`q`, `view`, `cat`, `tags`) e `/save` (`url`, `title`, `text`, `icon`, `source`) com a regra "`view` vence `cat`".
- **Dependências:** T-030, T-040.
- **Aceite:** `/save` **não** importa Sidebar/listagem (verificar no bundle do chunk `capture`); URL `/?view=inbox&cat=abc` normaliza para `/?view=inbox`.

### [ ] T-042 — Componentes de UI de captura
- **Escopo:** em `ui/components/`: `CategoryCombobox` (Inbox fixo no topo, filtro por trecho sem acento/caixa, `+ Criar "<texto>"`), `TagChips` (Enter/`,`, sugestões, contador `n/5`), `FaviconAvatar` (inicial do domínio + cor determinística, `onError` fallback), `Dialog`, `Toast`.
- **Fora do escopo:** chamadas a serviços (recebem dados e callbacks por props).
- **Refs:** RF-06, RF-07, RNF-4, RNF-7.
- **Dependências:** T-041.
- **Aceite:** teclado completo (`Esc` fecha dropdown); alvos ≥ 44 px; tag > 20 chars truncada/rejeitada; 6ª tag bloqueada mostrando "5/5".

### [ ] T-043 — Cliente de metadata
- **Escopo:** `data/remote/metadata.client.ts` com `fetch('/api/metadata?url=…')`, `AbortController`, timeout curto, retorno `null` em qualquer falha/offline; respeita `fetchMetadata` (decisão no serviço/feature, não aqui).
- **Dependências:** T-025, T-032.
- **Aceite (teste com fetch mockado):** offline/erro/`title: null` → `null` sem lançar; cancelável.

### [ ] T-044 — Formulário de captura (componente único)
- **Escopo:** `features/capture/CaptureForm` usado em `/save` e no Modal: título (≤ 200, fallback domínio), nota (≤ 280), categoria, tags, favorito, validação inline de URL; botão **Salvar habilitado imediatamente**; fluxo de `/api/metadata` com `isTitleDirty` e Caso B (salvar antes da resposta → `enrichBookmark`); pílula **"Já salvo"** + botão **"Atualizar Link"** e pré-preenchimento de nota nova; `Ctrl+Enter` salva; teclado virtual não cobre o botão.
- **Refs:** RF-03, RF-05, RF-08, RF-10, A§7.2.
- **Dependências:** T-033, T-034, T-042, T-043.
- **Aceite:** teste de componente/E2E: digitar no título antes da resposta tardia mantém o texto do usuário; offline salva com domínio como título; link ativo existente mostra "Já salvo".

### [ ] T-045 — Rota `/save` (captura externa)
- **Escopo:** extração via `share-extractor`; URL inválida → aviso + botão para `/` (RF-04); pós-salvar: `source=bookmarklet` → `window.close()` após ~1,2 s + botão "Fechar janela"; Share Target → botões "Abrir meus links" e "Fechar". Não depende de `window.opener`.
- **Refs:** RF-01, RF-02, RF-04, RF-09, RF-10.
- **Dependências:** T-044, T-013.
- **Aceite (E2E):** `/save?url=…&source=bookmarklet` salva e tenta fechar; `/save?text=olha%20https://x.com/a.` extrai a URL; `/save` sem URL válida mostra o aviso; interativo < 500 ms com cache (medir, T-062).

### [ ] T-046 — Dashboard: sidebar, busca e filtros
- **Escopo:** Sidebar (Todos, Inbox, Favoritos, categorias com contador + "Gerenciar", tags com contador), barra de busca (atalhos `/` e `Ctrl+K`), filtros na URL (`replace` ao digitar, `push` ao alternar), estado ativo exclusivo.
- **Refs:** RF-11, RF-12.
- **Dependências:** T-035, T-041.
- **Aceite (E2E):** filtros sobrevivem a reload; voltar/avançar funciona; múltiplas tags em AND; busca ignora acentos.

### [ ] T-047 — Dashboard: listagem
- **Escopo:** Cards e Lista Compacta (favicon via `/api/favicon` ou avatar local conforme `faviconMode`, título abre em nova aba com `rel="noopener noreferrer"`, badge de domínio, nota, categoria, até 2 tags + `+N`, data pt-BR), alternância `viewMode`, ordenação `sortBy` (RF-16), empty states distintos (coleção vazia × busca sem resultado).
- **Refs:** RF-13, RF-16.
- **Dependências:** T-046.
- **Aceite:** `faviconMode = 'local-only'` não gera nenhuma requisição a `/api/favicon`; imagem quebrada cai no avatar.

### [ ] T-048 — Dashboard: CRUD de links
- **Escopo:** ações por item (favoritar, copiar URL com toast, editar abrindo o Modal com URL **somente leitura**, excluir), botão/campo "adicionar link" abrindo o Modal (RF-03), exclusão imediata com toast `Link excluído · '<Título>'` + **[ Desfazer ]** por 5 s, menu por item em telas sem hover, toasts "Link salvo"/"Link atualizado" ao fechar o Modal.
- **Refs:** RF-03, RF-09, RF-14.
- **Dependências:** T-044, T-047.
- **Aceite (E2E):** excluir → desfazer em 5 s restaura tudo; após 5 s o link continua excluído; copiar URL mostra toast; editar não permite alterar a URL.

### [ ] T-049 — Rota `/categories`
- **Escopo:** CRUD com busca local, paleta de 8 cores, 24 ícones, contagem de links, confirmação de exclusão informando quantos links serão afetados, erro inline para nome duplicado.
- **Refs:** RF-15.
- **Dependências:** T-034, T-041.
- **Aceite (E2E):** excluir categoria com 3 links → confirmação cita "3 links" → links aparecem na Inbox; renomear para nome já existente mostra erro.

### [ ] T-050 — `/settings`: preferências, persistência e instalação
- **Escopo:** controles de tema, `viewMode`, `sortBy`, `fetchMetadata`, `faviconMode` (sincronizados com o Dashboard); status do `storage.persist()` ("Armazenamento protegido" / "Pode ser apagado pelo navegador" + orientação); seção "Salvar de qualquer lugar" (botão instalar via `beforeinstallprompt`, instruções Android e iOS adaptadas às capacidades detectadas).
- **Refs:** RF-19, RF-20, RF-21.
- **Dependências:** T-040, T-041, T-033.
- **Aceite:** alterar `sortBy` em Settings reflete no Dashboard e vice-versa; botão de instalar só aparece quando o evento existe.

### [ ] T-051 — Bookmarklet
- **Escopo:** gerador em `/settings` com `window.location.origin` (A§6.3), link arrastável, instruções e botão copiar; teste de unidade do gerador (sai `javascript:` válido e URL-encoded).
- **Refs:** RF-02, RF-20.
- **Dependências:** T-050, T-045.
- **Aceite:** em página real, clicar no bookmarklet abre popup 440×580 em `/save?...&source=bookmarklet` com `url`, `title`, `text` (≤ 280) e `icon` preenchidos.

### [ ] T-052 — `/settings`: backup (exportar/importar)
- **Escopo:** botões exportar `.json`/`.md`, importar com seletor de arquivo, `valibot` carregado sob demanda, banner `X criados · Y atualizados · Z ignorados` + 2ª linha condicional de ajustes de sanitização, erros estruturais claros, exibição de `lastBackupAt`.
- **Refs:** RF-17, RF-18.
- **Dependências:** T-036, T-050.
- **Aceite (E2E):** exportar → reimportar mostra banner; arquivo inválido não altera dados; chunk `settings` não inclui `valibot` até iniciar a importação.

### [ ] T-053 — Atalhos e acessibilidade transversal
- **Escopo:** `/` e `Ctrl+K` (busca), `Ctrl+Enter` (salvar), `Esc` (dropdown/modal), foco visível, `aria-*` nos componentes, contraste AA nos dois temas, `prefers-reduced-motion`.
- **Refs:** RNF-6, RNF-7.
- **Dependências:** T-044, T-046, T-048.
- **Aceite:** fluxo completo (capturar, buscar, excluir, desfazer) só com teclado; Lighthouse/axe sem violações críticas.

### [ ] T-054 — Estados de erro e vazio
- **Escopo:** error boundary por rota, estado de falha do Dexie (ex.: modo privado/quota), mensagens pt-BR consistentes.
- **Dependências:** T-047, T-049, T-050.
- **Aceite:** simular falha de abertura do IndexedDB mostra mensagem útil (não tela branca).

---

## FASE 5 — PWA, qualidade e deploy

### [ ] T-060 — PWA: manifest, service worker e atualização
- **Escopo:** **editar** o `vite.config.ts` existente (não recriar), adicionando `vite-plugin-pwa` com `registerType: 'prompt'`, `navigateFallback: '/index.html'`, **`navigateFallbackDenylist: [/^\/api\//]`**, manifest (A§8.2: `share_target` GET → `/save`, `display: standalone`, ícones maskable), banner "Atualização disponível — Recarregar" que só chama `updateServiceWorker(true)` no clique.
- **Refs:** RF-01, RNF-2, RNF-9.
- **Dependências:** T-045, T-047.
- **Aceite:** Lighthouse PWA instalável; offline, o app abre e `/save?url=…` funciona; `/api/*` offline **não** retorna HTML; nova versão não recarrega durante captura em andamento.

### [ ] T-061 — Testes E2E (Playwright)
- **Escopo:** os 4 fluxos de A§10-4: captura externa + "Já salvo", captura interna com metadata assíncrono e `isTitleDirty` (mock de `/api/metadata`), excluir + desfazer, exportar `.json` + reimportar.
- **Dependências:** T-045, T-048, T-052.
- **Aceite:** `pnpm --filter @sevd/web e2e` verde em Chromium.

### [ ] T-062 — Auditoria de performance, privacidade e segurança
- **Escopo:** medir abertura de `/save` (< 500 ms instalado, < 3 s em 4G na primeira visita); confirmar **zero** requisições a terceiros; revisar headers e limites da API; confirmar que `/save` não carrega Sidebar/Valibot.
- **Refs:** RNF-1, RNF-3, RNF-5.
- **Dependências:** T-060.
- **Aceite:** relatório curto em `docs/DECISIONS.md` com números medidos e ajustes feitos.

### [ ] T-063 — Deploy no Cloudflare Workers (CI/CD)
- **Escopo:** criar `.github/workflows/deploy.yml` como em A§7.1 (push em `main`: checkout, `pnpm/action-setup`, Node, `pnpm install --frozen-lockfile`, `typecheck` + `lint` + `test`, `pnpm --filter @sevd/web build`, `cloudflare/wrangler-action@v3`); script raiz `deploy` (`wrangler deploy`); `README` com passo a passo (secrets, domínio, primeiro deploy). O `wrangler.jsonc` já existe (T-025): só ajustar se necessário. Alinhar a versão do Node do CI (22) com `.nvmrc` e `engines` da raiz.
- **Fora do escopo:** rodar E2E no pipeline de deploy; banco de dados, autenticação e rotas de sync (v1.1).
- **Refs:** R-05, A§7.1.
- **Dependências:** T-025, T-060.
- **Aceite:** push em `main` dispara o pipeline e o publica; a URL pública serve o app, `/api/health` e `/api/metadata` respondem pelo Worker na **mesma origem**; refresh em `/categories` não dá 404; o pipeline **falha** (e não publica) se typecheck, lint ou testes falharem.
- **Parar e perguntar:** domínio estável (workers.dev ou domínio próprio, defina **antes** de gerar o bookmarklet e instalar o app), criação dos secrets `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` no GitHub (feita por você; o agente não deve ter acesso a eles), alterações no `compatibility_date`.

### [ ] T-064 — Validação em dispositivo real
- **Escopo:** checklist manual (PRD §6): instalar no celular, Compartilhar → SEVD (Android), bookmarklet no desktop, colar URL (iOS), `storage.persist()`, modo offline.
- **Refs:** Q-01 (celular principal ainda em aberto).
- **Dependências:** T-063.
- **Aceite:** checklist preenchido em `docs/DECISIONS.md` com o que funcionou/falhou por plataforma.
- **Parar e perguntar:** qual é o celular principal (Android ou iOS)?

---

## Fora do escopo do MVP (não implementar)
Sincronização/backup em servidor e autenticação (v1.1) · enriquecimento OpenGraph/modo leitura (v1.2) · `/api/check-links` (v1.3) · tela de Lixeira (v1.4) · extensão de navegador e integrações Obsidian/Notion (v2.0).

## Registro de bloqueios
_Use esta seção para anotar dúvidas abertas encontradas durante a execução (ID da tarefa, pergunta, data, resposta)._

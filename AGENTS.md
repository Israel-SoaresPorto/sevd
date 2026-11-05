# AGENTS.md — Regras permanentes para agentes de IA (e para mim)

Projeto: **SEVD (Salvar e Ver Depois)** — PWA local-first + funções serverless Hono.
Documentos de referência (fonte da verdade, nesta ordem de precedência):

1. `docs/architecture-sevd.md` — como construir (estrutura, contratos, algoritmos)
2. `docs/prd-sevd.md` — o que construir (RF, RNF, regras de negócio)
3. `docs/TASKS.md` — o que fazer agora (plano e status)
4. `docs/DECISIONS.md` — decisões registradas durante a implementação

Se dois documentos divergirem, **pare e pergunte** (veja "Inconsistências conhecidas" no fim).

---

## 1. Stack (não alterar sem aprovação)

- Monorepo **pnpm workspaces**: `packages/core` (`@sevd/core`), `apps/api` (`@sevd/api`), `apps/web` (`@sevd/web`)
- Front: React + TypeScript (strict) + Vite + `vite-plugin-pwa` (Workbox) + Tailwind + shadcn/ui + `lucide-react`
- Roteamento: **TanStack Router** (History API, search params tipados). Decisão fixada: não usar React Router.
- Dados: Dexie.js + `dexie-react-hooks` (`useLiveQuery`). Preferências em `localStorage`.
- API: **Hono** em `apps/api`, publicado como **Cloudflare Worker** com *Workers Static Assets* (mesma origem do PWA). Config em `wrangler.jsonc` na **raiz**; deploy automatizado por **GitHub Actions** (`.github/workflows/deploy.yml` com `cloudflare/wrangler-action@v3`). Sem Pages Functions e sem adaptadores.
- Validação: Valibot (somente em `@sevd/core`; carregado sob demanda em `/settings`).
- Testes: Vitest (`core`, `api`, integração de serviços com `fake-indexeddb`) e Playwright (E2E).

## 2. Fronteiras de camadas (verificadas por lint — nunca contornar)

| Camada | Pode importar | Proibido |
| :-- | :-- | :-- |
| `packages/core` | só interno + `valibot` | `react`, `dexie`, `hono`, DOM, `@sevd/web`, `@sevd/api` |
| `apps/api` | `hono`, `@sevd/core` | `react`, `dexie`, `@sevd/web` |
| `web/src/ui` | `react`, `lucide-react`, tipos de `@sevd/core` | `dexie`, `data`, `services`, `features`, `@sevd/api` |
| `web/src/data` | `dexie`, `@sevd/core` | `react`, `services`, `features`, `ui`, `@sevd/api` |
| `web/src/services` | `@sevd/core`, `data` | `react`, `features`, `ui`, `@sevd/api` |
| `web/src/features` | `react`, `@sevd/core`, `services`, `ui` | `data/local/db` direto, `@sevd/api` |

Se uma tarefa parecer exigir quebrar uma fronteira, o desenho está errado: pare e pergunte.

## 3. Regras de negócio que mais geram erro (leia antes de codar)

- **Soft delete em tudo.** Toda entidade tem `id` (UUID v4), `createdAt`, `updatedAt`, `deletedAt`. Toda mutação (inclusive em cascata) atualiza `updatedAt`.
- **Sem índices únicos (`&`) no Dexie.** Unicidade é garantida no serviço, só entre registros com `deletedAt === null`.
- **Ressurreição:** salvar de novo uma `normalizedUrl` excluída, ou criar categoria com nome de lápide, reaproveita o mesmo `id` **começando do zero** (`createdAt = updatedAt = now`, `deletedAt = null`, metadados antigos descartados).
- **Renomear categoria para nome de lápide:** remove fisicamente a lápide na mesma transação.
- **Excluir categoria:** move links ativos para `categoryId = null` **e** atualiza `updatedAt` deles, tudo em uma transação.
- **Tags:** `string[]` dentro do link. Máx. 5, até 20 chars, minúsculas, sem `#`. Não existe tabela, tipo `Tag` nem tela de gestão de tags.
- **Sugestões de tags só de links ativos** (`deletedAt === null`).
- **Normalização de URL:** exatamente as 6 etapas de `architecture §4.2`. Alterar exige migração.
- **Limites:** título 200, nota 280, categoria 50, tag 20, 5 tags. Constantes vivem só em `@sevd/core/constants.ts`.
- **Zero requisições do navegador a terceiros.** Sem CDN, sem analytics, sem fontes externas. Favicons só via `/api/favicon` ou avatar local.
- **Local-first:** salvar, editar, excluir, buscar e filtrar nunca dependem da rede. `/api/metadata` só enriquece, sem bloquear o botão Salvar. Respeitar `isTitleDirty`.
- **Segurança serverless:** todo `fetch` a URL externa passa pelo `ssrf-guard` (redirect manual, revalidando cada salto), com timeout e limite de bytes.
- `navigateFallbackDenylist: [/^\/api\//]` no Workbox é obrigatório. `registerType: 'prompt'` (nunca recarregar sozinho).
- **Deploy em mesma origem:** `apps/api/src/index.ts` exporta o app Hono como `export const app` **e** `export default app`. O `wrangler.jsonc` usa `assets.directory = "apps/web/dist"`, `not_found_handling = "single-page-application"` e `run_worker_first = ["/api/*"]`. Não criar `functions/`, `wrangler.toml` nem adaptadores `hono/cloudflare-pages`.

## 4. Como trabalhar (processo)

1. **Uma tarefa por vez**, identificada pelo ID (`T-012`). Leia a tarefa inteira e as seções do PRD/arquitetura que ela cita antes de escrever código.
2. **Respeite o escopo.** Faça só o que está em "Escopo". O que está em "Fora do escopo" não se faz, mesmo que pareça uma melhoria óbvia. Anote a ideia em `docs/DECISIONS.md` na seção "Ideias adiadas".
3. **Só toque nos arquivos listados** na tarefa. Se precisar de outro, explique por quê antes.
4. **Teste primeiro nas regras de domínio** (`@sevd/core`, serviços): escreva os testes dos critérios de aceite junto com o código.
5. **Verifique antes de declarar pronto:** `pnpm typecheck && pnpm lint && pnpm test` (ou o filtro do pacote) sem erros, e os comandos de "Como verificar" da tarefa.
6. **Ao concluir:** marque o status em `TASKS.md` (`[x]`), e reporte em até 5 linhas: o que foi feito, arquivos alterados, como verificar, pendências.
7. **Commits pequenos**, um por tarefa, formato `feat(core): T-012 normalizador de URL`.

## 5. Pare e pergunte (não decida sozinho) quando

- Faltar informação ou dois documentos se contradisserem.
- For preciso adicionar, remover ou atualizar **dependências**.
- For preciso mudar o schema do Dexie (nova `version`), o contrato de `@sevd/core` ou o formato de backup.
- A tarefa exigir tocar em arquivos fora da lista, ou quebrar uma fronteira de camada.
- Um critério de aceite parecer impossível ou conflitante.
- For preciso alterar `wrangler.jsonc` (inclui `compatibility_date`) ou `.github/workflows/deploy.yml`.
- Faltar decisão de **domínio** (workers.dev ou próprio), secrets do GitHub/Cloudflare, ou qualquer item "Em aberto" do PRD (§8) (hoje: Q-01, celular principal).

## 6. Proibido (sem pedido explícito)

- Apagar ou reescrever arquivos fora do escopo da tarefa; `git push --force`; reescrever histórico.
- Adicionar features do roadmap (v1.1+: sync, lixeira, check-links, extensão).
- Usar `any`, `// @ts-ignore`, `eslint-disable` para "fazer passar".
- Desabilitar ou apagar testes para fazer a pipeline passar.
- Colocar segredos, chaves ou URLs de produção no código ou em arquivos versionados (`CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID` vivem só nos secrets do GitHub).
- Publicar em produção manualmente (`wrangler deploy`): o deploy é feito pelo GitHub Actions no push em `main`.
- Inventar requisitos. Se não está no PRD, pergunte.
- Rodar scaffolders (`pnpm create vite`, `create-*`) em pastas que já têm arquivos, ou recriar arquivos de configuração existentes (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, config do ESLint). **Edite o que existe.**
- Rodar geradores que alteram arquivos (`shadcn init`/`add`) sem `git commit` prévio e sem conferir o `git diff` depois.

## 7. Convenções de código

- TypeScript `strict`, sem `any`. Funções puras em `@sevd/core`; efeitos colaterais só em `data/` e `services/`.
- Nomes de arquivos em `kebab-case` com sufixo de papel (`capture.service.ts`, `bookmark.repo.ts`).
- Textos de interface em **pt-BR**. Código, nomes e comentários técnicos em inglês.
- Acessibilidade: alvos de toque ≥ 44 px, foco visível, navegação por teclado, contraste AA.
- Componentes de `ui/` são puros (props in, eventos out). Estado e dados ficam em `features/`.

## 8. Definição de "pronto" (vale para toda tarefa)

- [ ] Critérios de aceite da tarefa atendidos
- [ ] Testes novos/ajustados passando; nenhum teste existente quebrado
- [ ] `typecheck` e `lint` limpos (inclui regras de fronteira)
- [ ] Nenhum arquivo fora do escopo alterado
- [ ] `TASKS.md` atualizado
- [ ] Decisões novas registradas em `DECISIONS.md`

## 9. Inconsistências conhecidas nos documentos (resolver antes de implementar o trecho afetado)

1. `architecture §5.1` importa `Tag` de `@sevd/core` e o diagrama cita "Tags" no IndexedDB, mas o PRD define tags como `string[]`. **Vale o PRD: não existe `Tag`.**
2. `PRD §4.2` diz que `storage.persist()` é do "RF-20"; o requisito correto é o **RF-19**.
3. `orderBy('tags').uniqueKeys()` (architecture §5.2-B) inclui tags de links excluídos. O PRD exige sugestões só de links ativos. **Vale o PRD.**
4. Roteador: os documentos dizem "TanStack Router ou React Router". **Decisão fixada neste arquivo: TanStack Router.**
5. A arquitetura lista `@hono/vite-dev-server` em `@sevd/web` e diz que o plugin "importa `@sevd/api`", mas a matriz de fronteiras proíbe `@sevd/web` de importar `@sevd/api`. **Decisão provisória:** a proibição vale para `apps/web/src/**`; o `vite.config.ts` (ferramenta de build/dev) referencia `apps/api/src/index.ts` por caminho relativo no `entry` do plugin, sem declarar `@sevd/api` como dependência do web.
6. O PRD (R-03) lista RF-20 entre os requisitos P0, mas o RF-20 é P1. Sem impacto na implementação; tratar como P1.

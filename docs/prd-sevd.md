# Product Requirements Document (PRD) — SEVD (Salvar e Ver Depois)

**Status:** Rascunho para aprovação (MVP v1.0)
**Plataforma:** PWA (Progressive Web App) — desktop e mobile, instalável
**Arquitetura base:** Local-First com Funções Serverless *stateless* no MVP (dados no dispositivo via IndexedDB, funções na própria origem, preparado para servidor de sincronização e backup na v1.1)

---

## 1. Visão Geral e Objetivo

O **SEVD** (*Salvar e Ver Depois*) é um aplicativo web instalável para **guardar links com o mínimo de atrito** e **encontrá-los depois de forma estruturada**. Ele resolve o problema do "cemitério de favoritos" separando a experiência em dois momentos:

1. **Captura rápida:** receber um link (de um compartilhamento no celular, de um bookmarklet no desktop ou colado no próprio Dashboard) e guardá-lo com categoria, tags e nota em poucos segundos.
2. **Dashboard:** ambiente completo para adicionar, buscar, filtrar por categorias e tags, editar e consumir os links salvos, além de gerir categorias, tags, configurações e backup.

**Princípio local-first com apoio serverless:** no MVP (v1.0), todos os dados ficam armazenados no dispositivo do usuário (IndexedDB), garantindo leitura/escrita instantânea e funcionamento offline. O MVP **não possui banco de dados no servidor** e o navegador **não faz requisições diretas a domínios de terceiros**: a única origem de rede do cliente é o próprio host da aplicação, que serve os arquivos estáticos e disponibiliza funções serverless *stateless* (`/api/metadata` e `/api/favicon`; ver §4.1).

### 1.1 Por que PWA + Serverless (e não extensão)

Um PWA roda em desktop e celular com um único código, dispensa lojas e revisões, e permite deploy instantâneo e custo operacional praticamente zero no tier gratuito. O preço de não ser extensão é perder a leitura direta da aba ativa do navegador; por isso a captura combina Web Share Target, Bookmarklet e extração automática de metadados via função serverless.

### 1.2 Público e uso

Projeto pessoal em primeiro lugar, com intenção de evoluir para produto. O uso em múltiplos dispositivos com **sincronização e backup em servidor próprio/BaaS entra na v1.1**, mantendo a arquitetura Local-First (IndexedDB como fonte primária na interface + sincronização em background).

---

## 2. Escopo Funcional e Requisitos (MVP)

### Módulo 1: Captura (Externa via `/save` e Interna via Modal no Dashboard)

O formulário de captura é um componente único reutilizado em **dois contextos**:
1. **Captura Externa (`/save`):** rota enxuta acionada apenas quando o usuário vem **de fora do app** (Compartilhar do sistema operacional ou janelinha popup do Bookmarklet). Renderiza somente o formulário de captura, sem carregar a barra lateral nem a listagem de links no fundo.
2. **Captura Interna (Modal no Dashboard):** quando o usuário já está no Dashboard (`/`), clicar em adicionar/colar link abre o formulário em um **Modal (Dialog)** sem sair do Dashboard (o mesmo modal reutilizado para editar links no RF-14). Não existe "tela de captura vazia" na rota `/save`.

| ID | Funcionalidade | Regra de Negócio / Comportamento | Prioridade |
| :--- | :--- | :--- | :--- |
| **RF-01** | **Fonte Externa: Compartilhar (Web Share Target)** | O app declara `share_target` no manifest apontando diretamente para a rota `/save` (método `GET`, parâmetros `title`, `text`, `url`). No Android (Chrome/Edge, app instalado), "Compartilhar → SEVD" abre `/save?title=…&text=…&url=…`. Como vários apps colocam a URL dentro de `text`, a rota extrai a **primeira URL `http(s)`** de `url` (ou de `text`, caso `url` esteja vazio; o restante de `text` vira sugestão de nota). Quando online e sem `title` ou `icon`, o app consulta `/api/metadata` em paralelo para preencher título e favicon sem bloquear a tela. | **P0 (Crítico)** |
| **RF-02** | **Fonte Externa: Bookmarklet** | A tela de Configurações oferece um bookmarklet para arrastar à barra de favoritos. Ao clicar, ele abre o SEVD em uma janela popup (`window.open`) em `/save` com `url`, `title`, `text` (texto selecionado via `window.getSelection()`, truncado em 280 caracteres), `icon` (href do `link[rel~=icon]` da página) e `source=bookmarklet`. Sites com CSP restritiva que bloqueiem `window.open` usam o fluxo de colar URL (RF-03). | **P0 (Crítico)** |
| **RF-03** | **Fonte Interna: Colar / Novo Link no Dashboard** | Botão/campo de adicionar link diretamente no Dashboard (`/`), que abre o **Modal de Captura** sem mudar de rota. Ao colar ou digitar uma URL válida, se o dispositivo estiver online e a busca automática de metadados estiver ativa (§3.3), o app consulta `/api/metadata` em background para sugerir o `title` e o `faviconUrl` (usando o domínio como fallback imediato). É o método universal, inclusive no iOS. | **P0 (Crítico)** |
| **RF-04** | **Validação de URL** | Apenas `http://` e `https://` podem ser salvas. Na rota externa `/save`, se nenhuma URL válida for encontrada em `url` ou `text` (ou tiver outro esquema), o formulário é substituído por um aviso explicando o motivo, com botão para abrir o Dashboard (`/`). No Modal do Dashboard, a validação é exibida inline no campo de URL. | **P0 (Crítico)** |
| **RF-05** | **Detecção de Duplicidade** | Normaliza a URL (§3.2) e verifica se existe link **ativo** (`deletedAt === null`). Se existir, exibe a pílula **"Já salvo"**, carrega os dados salvos (se a `note` salva estiver vazia e a captura trouxe novo `text`, pré-preenche com o novo `text`) e muda o botão para **"Atualizar Link"**. Link previamente excluído (`deletedAt !== null`) é tratado como novo: ao salvar, o registro é reaproveitado começando do zero (§3.1). A captura **não** oferece ação de excluir. | **P0 (Crítico)** |
| **RF-06** | **Atribuição de Categoria** | *Combobox* permitindo escolher 1 categoria existente ou criar uma nova digitando o nome. Links novos iniciam em **"Inbox (Sem Categoria)"**, opção fixa no topo para permitir remover a categoria. Filtro por **trecho contido**, ignorando maiúsculas/minúsculas e acentos; sem correspondência exata, exibe `+ Criar "<texto>"`. Categoria criada aqui recebe ícone `Folder` e cor automática (hash do nome). | **P0 (Crítico)** |
| **RF-07** | **Atribuição de Tags (Tags Leves)** | *Tag Input / Chips*: `Enter` ou `,` adiciona o chip, com sugestões baseadas nas tags já existentes em links ativos. Máximo de **5 tags por link** (strings de até 20 caracteres cada, normalizadas em minúsculas, sem `#`). Tags são gravadas diretamente no array `tags: string[]` do link, sem tabela ou rota de gestão separada. Ao atingir o limite, o campo exibe "5/5". | **P1 (Importante)** |
| **RF-08** | **Título, Nota e Favorito** | **Título** editável com limite de **200 caracteres** (fallback: domínio). **Nota** de até **280 caracteres** (pré-preenchida com o texto selecionado ou com o restante do `text` do compartilhamento). **Favorito** é um campo do formulário, gravado só ao salvar. | **P1 (Importante)** |
| **RF-09** | **Confirmação pós-salvamento** | • **No Modal do Dashboard (RF-03/RF-14):** fecha o modal imediatamente e exibe toast **"Link salvo"** / **"Link atualizado"**.<br>• **Na rota externa `/save`:** exibe confirmação na própria tela. Se veio do bookmarklet (`source=bookmarklet` na URL, sem depender de `window.opener` que pode ser `null` por políticas COOP), chama `window.close()` após ~1,2 s (mantendo um botão **"Fechar janela"** caso o navegador bloqueie o fechamento). Caso contrário (Share Target), exibe os botões **"Abrir meus links"** (navega para `/`) e **"Fechar"**. | **P0 (Crítico)** |
| **RF-10** | **Captura offline** | Com o app instalado e o service worker ativo, a captura funciona integralmente sem conexão (tanto no Modal quanto em `/save`), usando o domínio como fallback de título quando `/api/metadata` estiver inacessível. | **P0 (Crítico)** |

### Módulo 2: Dashboard (`/`)

| ID | Funcionalidade | Regra de Negócio / Comportamento | Prioridade |
| :--- | :--- | :--- | :--- |
| **RF-11** | **Navegação lateral (Sidebar)** | Visões padrão (*Todos os Links*, *Inbox / Sem Categoria*, *Favoritos*), lista de **Categorias** com contador e botão "Gerenciar" (leva a `/categories`), e seção de **Tags** (lista dinâmica de tags ativas com contador para filtro rápido). O estado ativo é exclusivo entre visões, categorias e rota de configurações. No mobile a Sidebar vira gaveta (*drawer*). | **P0 (Crítico)** |
| **RF-12** | **Busca e Filtros combinados** | Barra de busca (atalho `/` ou `Ctrl+K` no desktop) que filtra em tempo real por `título`, `domínio` ou `nota`. Combina com categoria e tags por **E (AND)**, inclusive múltiplas tags. O estado dos filtros fica nos *search params* da URL (ex.: `/?q=termo&view=inbox&tags=tag1,tag2`), usando `replace` ao digitar na busca e `push` ao alternar filtros, sobrevivendo a recarregamentos e permitindo voltar/avançar. `view` (`inbox`/`favorites`) e `cat` são mutuamente exclusivos; em conflito, `view` vence. | **P0 (Crítico)** |
| **RF-13** | **Listagem e Visualização** | *Cards* ou *Lista Compacta* com: favicon (via `/api/favicon` ou avatar local), título (abre a URL original em nova aba), badge do domínio, nota, categoria, até 2 tags visíveis + `+N`, e data. O modo de exibição lê e grava `UserPreferences.viewMode`. Empty states distintos para coleção vazia e busca sem resultados. | **P0 (Crítico)** |
| **RF-14** | **CRUD de Links** | Ações por item: Favoritar, Copiar URL (toast), Editar (abre o Modal de Captura com a URL em modo **somente leitura**) e Excluir. Excluir faz *soft delete* imediato, sem confirmação, com toast **"Link excluído · '<Título>'"** e **[ Desfazer ]** por 5 segundos; desfazer restaura todos os dados. Em telas sem hover, as ações ficam visíveis em um menu por item. | **P0 (Crítico)** |
| **RF-15** | **Gestão de Categorias** | Rota `/categories` para criar, renomear, alterar cor/ícone e excluir. Busca local. Excluir categoria move seus links para a Inbox (`categoryId = null`), **atualiza o `updatedAt` dos links afetados na mesma transação** e pede confirmação informando quantos links serão afetados. Nomes únicos entre registros ativos (sem distinção de maiúsculas/minúsculas); limite de **50 caracteres**. Cores de uma paleta de 8 tokens; ícones de uma lista de 24 ícones Lucide. | **P1 (Importante)** |
| **RF-16** | **Ordenação** | *Mais recentes* (padrão), *Mais antigos* e *Ordem alfabética*. Lê e grava diretamente `UserPreferences.sortBy` (fora da URL e sincronizado com Configurações). | **P1 (Importante)** |

### Módulo 3: Configurações, Backup e Persistência (`/settings`)

| ID | Funcionalidade | Regra de Negócio / Comportamento | Prioridade |
| :--- | :--- | :--- | :--- |
| **RF-17** | **Backup: Exportar** | Exporta todos os dados em `.json` (`BackupPayloadV1`, incluindo lápides para consistência de sincronização, sem preferências de UI) ou `.md` (apenas leitura, links ativos agrupados por categoria). Registra `lastBackupAt` **somente** ao exportar o `.json`. | **P0 (Crítico)** |
| **RF-18** | **Backup: Importar** | Importação que **mescla** com os dados locais em 4 estágios: (1) validação estrutural (Valibot, carregado sob demanda), (2) sanitização pura com relatório (truncamento de limites de caracteres, normalização de strings de tags, descarte de esquemas inválidos), (3) mesclagem em transação única ("mais recente vence" por `updatedAt`, inclusive lápides; categorias casadas por `id` ou nome case-insensitive, com remapeamento; se o link vencedor apontar para categoria cujo estado final após a mesclagem seja excluído, a referência é limpa para Inbox; tags são mescladas diretamente como conjunto no link vencedor), (4) banner de resumo (`X criados · Y atualizados · Z ignorados`) com 2ª linha condicional para ajustes de sanitização. | **P0 (Crítico)** |
| **RF-19** | **Armazenamento persistente** | Após a primeira gravação de dados, o app chama `navigator.storage.persist()`. O resultado é exibido em Configurações (*"Armazenamento protegido"* / *"Pode ser apagado pelo navegador"*) com orientação para instalar o app e exportar backup quando não concedido. | **P0 (Crítico)** |
| **RF-20** | **Instalação e Captura** | Seção "Salvar de qualquer lugar" com: botão de instalar o app (quando o evento `beforeinstallprompt` existir), bookmarklet arrastável com instruções, e instruções de Compartilhar (Android) e de colar o link (iOS). A seção se adapta às capacidades detectadas do dispositivo. | **P1 (Importante)** |
| **RF-21** | **Tema, Exibição e Privacidade** | Controles que leem e gravam `UserPreferences` (§3.3): Tema (Sistema/Claro/Escuro) aplicado antes do primeiro paint, modo de exibição (`viewMode`), ordenação (`sortBy`), busca automática de metadados ao capturar (`fetchMetadata`) e modo de exibição de favicons (`faviconMode`: via proxy serverless ou apenas avatares locais). | **P1 (Importante)** |

> [!WARNING]
> **Risco aceito:** sem sincronização, limpar os dados do site ou do navegador apaga todos os links. No Safari/iOS, dados de sites podem ser removidos após cerca de 7 dias sem uso quando o app não está instalado na tela de início. Mitigação: RF-17 e RF-19 são P0.

---

## 3. Modelagem de Dados (Schema Local)

Armazenamento em **IndexedDB** via **Dexie.js**. Volume esperado: **centenas de links** por usuário; filtros de texto e unicidade sobre registros ativos (`deletedAt === null`) aplicados na camada de serviço/memória. O modelo nasce **pronto para sincronização (v1.1)**: todas as entidades têm `id` UUID, `createdAt`, `updatedAt` e `deletedAt` (soft delete).

```typescript
// Índices físicos no Dexie (sem '&' para evitar ConstraintError com lápides de soft delete;
// unicidade garantida no serviço para registros ativos com deletedAt === null):
// bookmarks:  'id, normalizedUrl, domain, categoryId, *tags, createdAt, updatedAt'
// categories: 'id, name, updatedAt'

interface SyncFields {
  id: string;               // UUID v4
  createdAt: number;        // Date.now()
  updatedAt: number;        // atualizado em toda modificação (direta ou em cascata)
  deletedAt: number | null; // soft delete (null = ativo)
}

type ColorToken = 'blue' | 'indigo' | 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet' | 'zinc';

export interface Bookmark extends SyncFields {
  url: string;               // URL original http(s), como capturada (somente-leitura na edição)
  normalizedUrl: string;     // chave lógica de duplicidade (§3.2)
  title: string;             // editável; máx. 200 caracteres; fallback = domain
  domain: string;            // hostname (ex.: "developer.mozilla.org")
  faviconUrl?: string;       // vindo do bookmarklet ou /api/metadata; fallback = avatar local
  note?: string;             // máx. 280 caracteres
  categoryId: string | null; // null = Inbox
  tags: string[];            // máx. 5 tags leves (strings de até 20 chars, lowercase, sem '#')
  isFavorite: boolean;
}

export interface Category extends SyncFields {
  name: string;              // único entre ativos, case-insensitive; máx. 50 na UI
  color: ColorToken;         // padrão: hash do nome, exceto 'zinc'
  icon: CategoryIcon;        // 1 de 24 ícones Lucide; padrão "Folder"
}
```

**Ícones (24):** `Terminal` · `Folder` · `Code` · `Server` · `Database` · `BookOpen` · `FileText` · `Globe` · `Cpu` · `Layers` · `Briefcase` · `GraduationCap` · `Wrench` · `Palette` · `Sparkles` · `Video` · `Music` · `ShoppingBag` · `Shield` · `Zap` · `Compass` · `Bookmark` · `Archive` · `Heart`.

### 3.1 Exclusão, Reaproveitamento e Desfazer
- Exclusões são **lógicas** (`deletedAt`); registros excluídos não aparecem na interface e não há tela de "Excluídos" no MVP.
- **Desfazer** (até 5 s no Dashboard): limpa `deletedAt` e preserva todos os dados originais.
- **Reaproveitamento (Ressurreição) de Link ou Categoria excluídos:** ao salvar novamente uma `normalizedUrl`, ou criar uma Categoria com mesmo `name` (case-insensitive) de um registro em *soft delete* (`deletedAt !== null`), o registro existente é reaproveitado (mesmo `id`) **começando do zero**: limpa `deletedAt = null`, reinicia `createdAt` e `updatedAt` para `Date.now()` e descarta metadados antigos (evitando acumular múltiplas lápides para a mesma chave).
- **Colisão ao renomear Categoria:** se o usuário renomear uma Categoria ativa para um nome que já pertença a uma lápide (`deletedAt !== null`), a lápide antiga é removida fisicamente na mesma transação antes de gravar o novo nome.

### 3.2 Normalização de URL
Aplicada em ordem para gerar `normalizedUrl`:
1. Esquema canônico padronizado como `https://` (`http://` e `https://` são equivalentes).
2. Host em minúsculas; remoção **apenas** do prefixo `www.` e remoção de portas padrão (`:80` e `:443`).
3. Fragmento (`#...`) removido, exceto quando começa com `#/` ou `#!` (rotas de SPA).
4. Parâmetros de rastreamento removidos — **lista fechada**: qualquer parâmetro com prefixo `utm_`, além de `fbclid`, `gclid`, `dclid`, `msclkid`, `twclid`, `igshid`, `mc_cid`, `mc_eid`, `ref`, `ref_src` e `si`.
5. Parâmetros de query restantes ordenados alfabeticamente pela chave (e pelo valor em caso de chaves repetidas).
6. Barra final (`/`) do path removida, inclusive na raiz (ex.: `https://exemplo.com/` → `https://exemplo.com`).

> Alterar essas regras exige migração que recalcule `normalizedUrl` de todos os links.

### 3.3 Preferências
`UserPreferences` ficam em `localStorage` (leitura síncrona, necessária para aplicar o tema antes do primeiro paint) e não entram no backup de dados:
- `theme`: `'system' | 'light' | 'dark'` (padrão: `'system'`)
- `viewMode`: `'cards' | 'compact'` (padrão: `'cards'`, alterado no Dashboard ou em Configurações)
- `sortBy`: `'newest' | 'oldest' | 'alpha'` (padrão: `'newest'`, alterado no Dashboard ou em Configurações)
- `fetchMetadata`: `boolean` (padrão: `true` — consulta `/api/metadata` ao colar/compartilhar URL)
- `faviconMode`: `'proxy' | 'local-only'` (padrão: `'proxy'` — exibe favicons via `/api/favicon` ou força apenas avatares locais)
- `lastBackupAt`: `number | null`

---

## 4. Arquitetura Técnica e Stack

* **Build e PWA:** Vite + `vite-plugin-pwa` (Workbox) com pré-cache do app shell (`navigateFallback` para o `index.html`), manifest com `share_target` apontando direto para `/save`, ícones maskable e `display: standalone`.
* **Front-end e UI:** React + TypeScript + Tailwind CSS + shadcn/ui, com layout responsivo *mobile-first*.
* **Banco e reatividade:** Dexie.js com `useLiveQuery`; acesso isolado por camada de serviços (casos de uso transacionais) e repositórios.
* **Roteamento (History API):** **TanStack Router** ou **React Router** para as rotas de página (`/`, `/save`, `/categories`, `/settings`), com gerenciamento tipado de *search params* para filtros do Dashboard (`/?q=…&view=…`) e parâmetros de captura em `/save`. A rota `/save` é exclusiva para entradas externas (Bookmarklet e Share Target); dentro do Dashboard a captura e edição ocorrem via Modal. A hospedagem estática usa *SPA fallback* (`/* -> /index.html` para rotas de UI).
* **Domínio puro (`@sevd/core` em `packages/core`):** normalização de URL, extração de URL de texto, validações, sanitização de importação, datas (`Intl.DateTimeFormat` pt-BR) e cor determinística. Pacote isolado fisicamente sem React, Dexie ou APIs exclusivas do navegador — **compartilhado via `workspace:*` entre `@sevd/web` e `@sevd/api`**.
* **Validação:** funções puras para regras de domínio; schemas Valibot compartilhados em `@sevd/core` (carregados sob demanda em `/settings` no front-end e reutilizados nas rotas de `@sevd/api`).
* **Code splitting por rota (Lazy Loading):** a rota `/save` carrega apenas o formulário de captura e o acesso ao banco (sem barra lateral, listagem, Valibot ou telas de gestão). O Dashboard (`/`) e `/settings` são *chunks* separados carregados sob demanda pelo roteador.
* **Hospedagem e Runtime Serverless:** Cloudflare Pages + Pages Functions / Workers (ou Vercel) usando **Hono** em `@sevd/api` (`@hono/vite-dev-server` ou proxy no Vite durante o desenvolvimento local), HTTPS obrigatório. **O domínio deve ser estável**, pois o bookmarklet e o app instalado dependem dele.
* **Estrutura (`pnpm workspaces`):** monorepo gerenciado via `pnpm-workspace.yaml` dividido em:
  - `packages/core` (`@sevd/core`): domínio puro, tipos e contratos.
  - `apps/api` (`@sevd/api`): aplicação serverless **Hono** (`v1.0`) que evoluirá para o servidor completo de sincronização e backup (`v1.1`).
  - `apps/web` (`@sevd/web`): aplicação PWA com camadas `src/data/` (`local/` e `remote/`), `src/services/`, `src/features/` e `src/ui/`, com fronteiras verificadas por lint (`ui` não chama serviços diretamente).
* **Testes:** Vitest (testes unitários em `@sevd/core` e `@sevd/api`; testes de integração de serviços em `@sevd/web` com `fake-indexeddb`) e Playwright (testes E2E em `@sevd/web`).

### 4.1 Arquitetura Serverless com Hono (MVP v1.0) e Evolução para Servidor Full (v1.1)

As funções serverless do MVP v1.0 ficam isoladas no pacote **`@sevd/api` (`apps/api`)**, construídas sobre o **Hono** (`src/index.ts`) com a lógica de segurança e parsing desacoplada (`ssrf-guard.ts`, `html-parser.ts`) e consumindo `@sevd/core`. Durante o desenvolvimento local, o Vite em `apps/web` integra `@sevd/api` via `@hono/vite-dev-server` (ou proxy reverso `/api/*`); em produção, um adaptador fino (`functions/api/[[route]].ts`) expõe `@sevd/api` na borda. Caso na `v1.1` se opte por manter o Hono ou migrar para outro framework de servidor (ex.: Fastify/Express/Nest), toda a mudança fica contida em `apps/api`, sem impacto em `apps/web` ou `packages/core`.

1. **`GET /api/metadata?url=<encoded_url>` (Extração de Título, Favicon e URL Final):**
   - **Filtro de origem:** rejeita requisições `Sec-Fetch-Site: cross-site` (`403 Forbidden`) para evitar uso indevido por outros sites.
   - **Guarda Anti-SSRF em todos os saltos:** valida esquema `http(s)` via `@sevd/core` e bloqueia `localhost`, domínios internos (`*.local`, `*.internal`) e faixas de IP privadas/reservadas (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, `fc00::/7`, `fe80::/10`). Segue redirecionamentos manualmente (`redirect: 'manual'`, máx. **5 saltos**), revalidando cada `Location` contra o `ssrf-guard`.
   - **Leitura em stream limitada:** timeout total de **3 s** (`AbortSignal.timeout(3000)`). Se o `Content-Type` não for `text/html` ou `application/xhtml+xml`, cancela o download do corpo imediatamente. Lê chunks até no máximo **64 KB** ou até encontrar `</head>` (o que ocorrer primeiro) e cancela o restante do stream.
   - **Prioridade de extração:**
     - `title`: `meta[property="og:title"]` → `meta[name="twitter:title"]` → `<title>` (decodificando entidades HTML e truncando em 200 caracteres).
     - `faviconUrl`: `link[rel="icon"]` → `link[rel="shortcut icon"]` → `link[rel="apple-touch-icon"]` → fallback `new URL('/favicon.ico', finalUrl).href` (sempre convertido para URL absoluta).
   - **Cache e resiliência:** retorna `{ title, faviconUrl, finalUrl }` com `Cache-Control: public, max-age=3600, s-maxage=86400`. Se o site alvo bloquear bots ou expirar o tempo, retorna `200 OK` com `title: null` para fallback gracioso no cliente.
   - **Integração não-bloqueante na UI:** o formulário de captura libera o botão "Salvar" imediatamente usando o domínio como título provisório. Se o usuário editar o campo de título manualmente (`isTitleDirty`), a resposta tardia de `/api/metadata` não sobrescreve o texto digitado. Se o usuário salvar antes da resposta chegar, o título e o favicon são atualizados em background no registro recém-criado.

2. **`GET /api/favicon?url=<encoded_icon_url>` (Proxy e Cache de Favicon na Borda):**
   - **Privacidade e validação:** passa pelo `ssrf-guard` (máx. 3 redirects, timeout de **2 s**), exige `Content-Type` iniciando com `image/` (ou `.ico`) e limita a leitura a **256 KB**. Em caso de falha, retorna `404` com cache curto (`max-age=3600`), acionando o fallback do **avatar local** no `<img onError>` do cliente.
   - **Blindagem contra XSS em SVG:** responde sempre com `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, `X-Content-Type-Options: nosniff` e `Cache-Control: public, max-age=604800, s-maxage=2592000, immutable`.

3. **Entrada do Web Share Target (`GET /save` direto na SPA):**
   - Com o roteamento History API (React Router / TanStack Router), o `share_target` aponta diretamente para `/save`, dispensando uma função serverless `/share` para requisições `GET`.

**Preparação para o Servidor Completo na v1.1 (Modelo Local-First + Sync/Backup):**
- O IndexedDB (Dexie) permanece como fonte primária de leitura/escrita na interface em `@sevd/web` na `v1.1`, garantindo latência zero e suporte offline.
- A pasta `apps/web/src/data/remote/` receberá o `SyncClient`, que enviará mutações locais (`updatedAt > lastSyncedAt`) e receberá atualizações e backups de `@sevd/api` (que passará a contar com banco de dados e autenticação), reaproveitando a mesma função pura de resolução de conflitos ("mais recente vence" por `updatedAt`, inclusive lápides) de `@sevd/core`.

### 4.2 Permissões do Navegador
O app **não solicita nenhuma permissão** sensível do navegador (câmera, localização, notificações) no MVP. `navigator.storage.persist()` é invocado apenas após a primeira gravação (RF-20).

---

## 5. Requisitos Não-Funcionais

1. **Abertura da captura:** com o app instalado e em cache, a rota externa `/save` e o Modal de Captura devem ser interativos em **< 500 ms** em celular intermediário (a busca em `/api/metadata` ocorre em background sem travar o botão Salvar); primeira visita (sem cache) em **< 3 s** em 4G.
2. **Funciona offline:** captura, busca e edição completas sem conexão após a primeira carga (degradando graciosamente sem `/api/metadata` e `/api/favicon`).
3. **Privacidade:** nenhuma requisição do navegador a domínios de terceiros; sem analytics, sem fontes ou ícones carregados de CDN externa (tudo empacotado na origem).
4. **Resiliência e privacidade de favicon:** exibir favicons intermediados por `/api/favicon` (quando `faviconMode = 'proxy'`) ou exibir exclusivamente o **avatar local** com a inicial do domínio e cor determinística (quando ausente, offline, quebrado ou quando `faviconMode = 'local-only'`).
5. **Segurança serverless:** todas as funções serverless devem validar esquema `http(s)`, bloquear IPs privados/loopback (anti-SSRF), limitar leitura de resposta (máx. 64 KB) e impor timeout máximo de 3 s.
6. **Responsividade e toque:** alvos de toque ≥ 44 px; Sidebar em gaveta no mobile; teclado virtual não pode cobrir o botão "Salvar".
7. **Acessibilidade:** navegação por teclado completa (`Tab`, `Ctrl+Enter` para salvar, `Esc` fecha o dropdown de categoria ou modal), foco visível, contraste AA nos dois temas.
8. **Sem flash de tema:** tema aplicado por script inline no `<head>` antes do primeiro paint.
9. **Atualização do app:** nova versão do service worker é aplicada com aviso "Atualização disponível — Recarregar", sem interromper uma captura em andamento.

---

## 6. Compatibilidade de Plataformas

| Recurso | Android (Chrome/Edge) | Desktop (Chrome/Edge) | iOS / Safari | Firefox |
| :--- | :--- | :--- | :--- | :--- |
| Instalar como app | Sim | Sim | Sim (Adicionar à Tela de Início) | Limitado |
| Compartilhar → SEVD (`/save`) | **Sim** | Parcial | **Não** | Não |
| Bookmarklet (`/save`) | Sim | Sim | Sim (manual) | Sim |
| Colar URL (Modal c/ `/api/metadata`) | Sim | Sim | **Sim (com título automático)** | Sim |
| `storage.persist()` | Sim | Sim | Parcial | Sim |

> Suporte a Web Share Target varia por versão e sistema; validar em dispositivo real durante o protótipo. No iOS a captura usa o Modal de Colar URL (que já preenche título e favicon via `/api/metadata`) ou o bookmarklet.

---

## 7. Roadmap de Evolução (Pós-MVP)

* **v1.1 (Servidor Completo de Sincronização e Backup em Nuvem):** mantém o modelo Local-First (IndexedDB como fonte primária na UI para leitura/escrita instantânea e offline) e adiciona backend com banco de dados e autenticação para sincronização automática entre dispositivos (pull/push incremental por `updatedAt`, inclusive lápides) e backup contínuo no servidor.
* **v1.2 (Enriquecimento avançado de conteúdo):** extração opcional de resumo/descrição OpenGraph, imagem de capa ou modo leitura via servidor.
* **v1.3 (Verificação de links quebrados):** função serverless/endpoint `/api/check-links` para verificar status HTTP de links salvos em lotes sem restrição de CORS.
* **v1.4 (Lixeira):** tela de restauração e exclusão permanente, já viável pelo soft delete (`deletedAt`).
* **v2.0 (Extensão fina de captura):** extensão que apenas envia a aba ativa ao SEVD, trazendo de volta a captura em 1 clique no desktop. Integrações com Obsidian/Notion.

---

## 8. Riscos e Questões em Aberto

| # | Item | Impacto | Encaminhamento |
| :--- | :--- | :--- | :--- |
| R-01 | Captura no desktop via bookmarklet abre janela popup extra | Pequeno atrito em relação a uma extensão nativa | Auto-close em 1,2 s via `source=bookmarklet`; v2.0 prevê extensão fina |
| R-02 | iOS sem Web Share Target para PWAs | Captura no iPhone via colar link ou bookmarklet | Mitigado no MVP pelo `/api/metadata`, que puxa título e favicon automaticamente ao colar a URL no Dashboard |
| R-03 | Perda de dados por limpeza do navegador antes da v1.1 | Perda local se não houver backup exportado | RF-17, RF-19, RF-20 como P0 no v1.0; eliminado na v1.1 com sincronização e backup no servidor |
| R-04 | CSP de alguns sites bloqueia o bookmarklet | Falha em certos sites | Fallback direto pelo Modal no Dashboard com preenchimento automático via `/api/metadata` |
| R-05 | Mudança de domínio quebra bookmarklet e app instalado | Reconfiguração manual | Registrar domínio estável antes do lançamento |
| Q-01 | Escolha final do provedor de deploy serverless (Cloudflare Pages vs. Vercel) | Define configuração do adaptador de borda do Hono | **Em aberto** |
| Q-02 | Qual o celular principal (Android ou iOS)? | Define prioridade de testes do Share Target vs. fluxo iOS | **Em aberto** |

---

## 9. Decisões Iniciais (a registrar em `DECISIONS.md`)

| ID | Decisão | Substitui (versão extensão) |
| :--- | :--- | :--- |
| D-01 | O produto é um PWA local-first (IndexedDB) apoiado por funções serverless *stateless* no MVP (`v1.0`) e evolução para servidor de sincronização e backup na `v1.1` | Arquitetura de extensão |
| D-02 | Captura dividida em: externa via `/save` (Share Target e Bookmarklet com `source=bookmarklet`) e interna via Modal no Dashboard (Colar/Novo link e Editar, sem tela de captura vazia) | D-30, D-36, D-37 (popup e permissões) |
| D-03 | Preferências unificadas em `localStorage` (`theme`, `viewMode`, `sortBy`, `fetchMetadata`, `faviconMode`, timestamps de backup); tema aplicado por script inline | D-06, D-21 |
| D-04 | `navigator.storage.persist()` no lugar de `unlimitedStorage` | D-07 |
| D-05 | Backup local é P0 no v1.0 (exportação manual sob demanda em Configurações, sem banner de lembrete no Dashboard); sincronização e backup em servidor na v1.1 | D-15 |
| D-06 | Sem atalho global do sistema; atalhos internos (`/`, `Ctrl+K`, `Ctrl+Enter`, `Esc`) | D-14, RF-13 antigo |
| D-07 | Modelo de dados sem índices únicos físicos (`&`) no Dexie para evitar colisão com lápides; unicidade garantida no serviço para registros ativos e ressurreição de lápides para Links e Categorias (§3.1); cascata de `updatedAt` ao excluir Categoria; tags como array leve de strings (`tags: string[]`) no próprio link sem tabela/rota de gestão dedicada; lista fechada de tracking params (§3.2) | D-04, D-08 a D-13, D-17, D-18, D-22, D-27, D-34, D-40 |
| D-08 | Monorepo com **`pnpm workspaces`** (`packages/core`, `apps/api`, `apps/web`); roteamento de páginas via **React Router / TanStack Router** (History API) em substituição ao antigo roteamento por hash; funções serverless em `@sevd/api` com **Hono** e lógica desacoplada para facilitar evolução/troca de servidor na `v1.1` | D-31 (roteamento por hash) |

import js from "@eslint/js";
import tseslint from "typescript-eslint";

const recommendedRules = { ...js.configs.recommended.rules };
delete recommendedRules["no-unassigned-vars"];
delete recommendedRules["preserve-caught-error"];

export default [
  // 1. Ignored files and directories
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.wrangler/**",
      "**/coverage/**",
    ],
  },

  // 2. Typescript parser for files with .ts and .tsx extensions
  {
      files: ["**/*.{ts,tsx}"],
      languageOptions: {
        parser: tseslint.parser,
        globals: {
          URL: "readonly",
          URLSearchParams: "readonly",
          Request: "readonly",
          Response: "readonly",
          Headers: "readonly",
          fetch: "readonly",
          AbortSignal: "readonly",
        },
        parserOptions: {
          ecmaVersion: "latest",
          sourceType: "module",
        },
      },
    },

  // 3. Recommended rules for all files
  {
    rules: recommendedRules,
  },

  // 4. packages/core: pure package. forbidden imports: react, dexie, hono, @sevd/web, @sevd/api. Forbidden globals: window, document
  {
    files: ["packages/core/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "packages/core it cannot import 'react'. It is a pure package and should not depend on React.",
            },
            {
              name: "dexie",
              message: "packages/core it cannot import 'dexie'. It is a pure package and should not depend on Dexie.",
            },
            {
              name: "hono",
              message: "packages/core it cannot import 'hono'. It is a pure package and should not depend on Hono.",
            },
            {
              name: "@sevd/web",
              message: "packages/core it cannot import '@sevd/web'.",
            },
            {
              name: "@sevd/api",
              message: "packages/core it cannot '@sevd/api'.",
            },
          ],
          patterns: [
            {
              group: ["**/apps/web/**", "**/apps/api/**"],
              message: "packages/core it cannot import files from apps/web or apps/api.",
            },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "window",
          message: "packages/core it cannot access the 'window' global.",
        },
        {
          name: "document",
          message: "packages/core it cannot access the 'document' (DOM).",
        },
      ],
    },
  },

  // 4. apps/api: hono and @sevd/core. Forbidden imports: react, dexie, @sevd/web
  {
    files: ["apps/api/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "apps/api it cannot import 'react'.",
            },
            {
              name: "dexie",
              message: "apps/api it cannot import 'dexie'.",
            },
            {
              name: "@sevd/web",
              message: "apps/api it cannot import '@sevd/web'.",
            },
          ],
          patterns: [
            {
              group: ["**/apps/web/**"],
              message: "apps/api it cannot import files from apps/web.",
            },
          ],
        },
      ],
    },
  },

  // 5. apps/web/src/ui: react, lucide-react, @sevd/core. Forbidden imports: dexie, @sevd/api, data, services, features
  {
    files: ["apps/web/src/ui/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "dexie",
              message: "UI components cannot import 'dexie'.",
            },
            {
              name: "@sevd/api",
              message: "UI components cannot import '@sevd/api'.",
            },
          ],
          patterns: [
            {
              group: [
                "**/data/**",
                "**/services/**",
                "**/features/**",
                "@/data/**",
                "@/services/**",
                "@/features/**",
              ],
              message:
                "UI components cannot import from data, services, or features layers.",
            },
          ],
        },
      ],
    },
  },

  // 6. apps/web/src/data: dexie, @sevd/core. Forbidden imports: react, services, features, ui, @sevd/api
  {
    files: ["apps/web/src/data/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "apps/web/src/data it cannot import 'react'.",
            },
            {
              name: "@sevd/api",
              message: "apps/web/src/data it cannot import '@sevd/api'.",
            },
          ],
          patterns: [
            {
              group: [
                "**/services/**",
                "**/features/**",
                "**/ui/**",
                "@/services/**",
                "@/features/**",
                "@/ui/**",
              ],
              message:
                "apps/web/src/data layer cannot import from services, features, or ui layers.",
            },
          ],
        },
      ],
    },
  },

  // 7. apps/web/src/services: @sevd/core, data. Forbidden imports: react
  {
    files: ["apps/web/src/services/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react",
              message: "apps/web/src/services layer cannot import 'react'.",
            },
            {
              name: "@sevd/api",
              message: "apps/web/src/services cannot import '@sevd/api'.",
            },
          ],
          patterns: [
            {
              group: [
                "**/features/**",
                "**/ui/**",
                "@/features/**",
                "@/ui/**",
              ],
              message:
                "Camada de services não pode importar de features ou ui.",
            },
          ],
        },
      ],
    },
  },

  // 8. apps/web/src/features: react, @sevd/core, services, ui. Forbidden imports: data/local/db direto, @sevd/api
  {
    files: ["apps/web/src/features/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@sevd/api",
              message: "apps/web/src/features cannot import '@sevd/api'.",
            },
          ],
          patterns: [
            {
              group: [
                "**/data/local/db*",
                "@/data/local/db*",
              ],
              message:
                "apps/web/src/features cannot import data/local/db directly. Use services layer instead.",
            },
          ],
        },
      ],
    },
  },
];

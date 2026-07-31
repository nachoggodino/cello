import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

const maintainabilityRules = {
  complexity: ["error", 10],
  "max-classes-per-file": ["error", 1],
  "max-lines": ["error", { max: 350, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }]
};

export default tseslint.config(
  {
    ignores: ["coverage", "dist", "node_modules", "apps/playground/dist", "apps/vscode/dist", "**/*.d.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...maintainabilityRules,
      "no-warning-comments": ["error", { terms: ["fixme"], location: "anywhere" }],
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "react-refresh/only-export-components": ["error", { allowConstantExport: true }]
    }
  },
  {
    files: ["packages/cli/src/**/*.ts", "apps/vscode/{src,tests}/**/*.ts"],
    languageOptions: { globals: globals.node }
  },
  {
    files: ["packages/editor-react/src/**/*.{ts,tsx}", "apps/playground/src/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser }
  },
  {
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
    rules: {
      complexity: "off",
      "max-classes-per-file": "off",
      "max-lines": "off",
      "max-lines-per-function": "off"
    }
  },
  {
    // Temporary Phase 2 ceilings for characterized legacy modules. Phase 6 can only lower them.
    files: ["apps/playground/src/App.tsx"],
    rules: {
      "max-lines": ["error", { max: 600, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 180, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/core/src/evaluator/formula.ts"],
    rules: { complexity: ["error", 17] }
  },
  {
    files: ["packages/core/src/parser/parse.ts"],
    rules: {
      complexity: ["error", 22],
      "max-lines": ["error", { max: 850, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 120, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/core/src/shared/identity.ts"],
    rules: {
      complexity: ["error", 16],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/editor-react/src/CelloVisualEditor.tsx"],
    rules: {
      complexity: ["error", 39],
      "max-lines": ["error", { max: 925, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 800, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/editor-react/src/components/editorToolbar.tsx"],
    rules: { "max-lines-per-function": ["error", { max: 300, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/editor-react/src/components/gridRows.tsx"],
    rules: {
      complexity: ["error", 36],
      "max-lines-per-function": ["error", { max: 350, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/editor-react/src/interactions/keyboard.ts"],
    rules: { complexity: ["error", 24] }
  },
  {
    files: ["packages/editor-react/src/selection.ts"],
    rules: { complexity: ["error", 20] }
  },
  {
    files: ["apps/playground/src/useClipboardStatus.ts", "apps/playground/src/useResizableSplit.ts"],
    rules: { "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["apps/vscode/src/previewHtml.ts"],
    rules: { "max-lines-per-function": ["error", { max: 70, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/cli/src/serve.ts"],
    rules: { "max-lines-per-function": ["error", { max: 60, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/core/src/evaluator/evaluate.ts"],
    rules: {
      complexity: ["error", 11],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["packages/core/src/parser/source-map.ts"],
    rules: { complexity: ["error", 11] }
  },
  {
    files: ["packages/core/src/renderer/render.ts"],
    rules: { complexity: ["error", 12] }
  },
  {
    files: ["packages/core/src/shared/presentation.ts"],
    rules: { complexity: ["error", 14] }
  },
  {
    files: ["packages/core/src/shared/utils.ts"],
    rules: { complexity: ["error", 15] }
  },
  {
    files: ["packages/editor-core/src/document-command-reducer.ts", "packages/editor-core/src/validate-command.ts"],
    rules: { "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/editor-core/src/selectors.ts"],
    rules: { complexity: ["error", 11] }
  },
  {
    files: [
      "packages/editor-react/src/CelloHtmlPreview.tsx",
      "packages/editor-react/src/CelloSourceEditor.tsx",
      "packages/editor-react/src/CelloWorkbench.tsx",
      "packages/editor-react/src/CodeMirrorSourceSurface.tsx",
      "packages/editor-react/src/components/controls.tsx"
    ],
    rules: { "max-lines-per-function": ["error", { max: 100, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/editor-react/src/components/sheetTabs.tsx"],
    rules: { "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }] }
  },
  {
    files: ["packages/editor-react/src/interactions/keyboard.ts"],
    rules: {
      complexity: ["error", 24],
      "max-lines-per-function": ["error", { max: 70, skipBlankLines: true, skipComments: true }]
    }
  },
  {
    files: ["**/*.test.{ts,tsx}", "tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/unbound-method": "off"
    }
  }
);

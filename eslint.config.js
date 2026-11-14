// Linting del progetto: regole consigliate di ESLint, regole ufficiali degli
// hook di React (render puri, dipendenze degli effetti) e controllo del Fast
// Refresh di Vite. La pipeline CI esegue `npm run lint` e si ferma se fallisce.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default defineConfig([
  globalIgnores(["dist", "coverage", ".netlify", "presentazione"]),
  {
    files: ["**/*.{js,jsx,mjs}"],
    extends: [js.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // I componenti usati solo in JSX iniziano con la maiuscola.
      "no-unused-vars": ["error", { varsIgnorePattern: "^[A-Z_]" }],
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
    },
  },
  {
    files: ["src/**/*.jsx"],
    extends: [reactRefresh.configs.vite],
    rules: {
      // App.jsx e i context esportano anche hook e provider insieme ai componenti.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["server/**", "netlify/**", "scripts/**", "*.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["tests/**"],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },
]);

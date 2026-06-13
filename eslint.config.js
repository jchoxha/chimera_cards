import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

// Lint config exists primarily as a SAFETY NET for the modularization:
// no-undef catches any cross-module reference that wasn't imported, and the
// react plugin extends that to components used in JSX. Stylistic rules are
// intentionally relaxed; correctness rules are errors.
export default [
  { ignores: ["dist/**", "node_modules/**"] },
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "18" } },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "error",
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off", // automatic JSX runtime (Vite plugin)
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      // Relaxed: not correctness-critical, and the artifact has many of these.
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_|^React$" }],
      "no-empty": "off",
      "no-cond-assign": "off",
      "no-control-regex": "off",
      "no-prototype-builtins": "off",
    },
  },
];

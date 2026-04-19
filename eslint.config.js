import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "vendor/**",
      "bundle_*.js",
      "lessons_data.js"
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: {
        ...globals.browser,
        marked: "readonly",
        MathJax: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules
    }
  },
  {
    files: ["app.js"],
    rules: {
      "no-unused-vars": ["error", { "varsIgnorePattern": "^rewriteContentLinks$" }]
    }
  },
  {
    files: ["localize.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node
      }
    }
  }
];

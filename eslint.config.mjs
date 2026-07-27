import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

/**
 * Module-boundary enforcement, per docs/FR/architecture.md's Modular
 * Monolith Structure section. Requires `eslint-plugin-boundaries` v7+:
 *
 *   npm install --save-dev eslint-plugin-boundaries
 *
 * This config targets the current (v7) API:
 *  - rule: `boundaries/dependencies` (the `element-types` name is deprecated)
 *  - option: `policies` (the `rules` option name is deprecated)
 *  - entity selectors: `{ element: { type: "..." } }` instead of bare `{ type: "..." }`
 *  - captured-value matching in selectors uses `{{from.captured.module}}`
 *    handlebars-style templates, not the legacy `${module}` syntax
 *
 * Element types:
 *  - sharedLayout:   src/shared/layout/**       (cross-page UI shell — the
 *                      one deliberate exception to "shared/core has zero
 *                      module dependencies": AppHeader/DesktopHeader/
 *                      SiteHeader compose the location + search modules'
 *                      public APIs to build the site-wide header. Matched
 *                      before sharedLayer below since it's more specific.)
 *  - sharedLayer:    src/shared/**              (everything else in shared —
 *                      genuinely depends on nothing else)
 *  - moduleInternal: src/modules/*\/**         (everything inside a module,
 *                      INCLUDING its index.ts — element patterns match
 *                      folders, not individual files, so index.ts can't be
 *                      its own *element* type; see the `moduleIndex` FILE
 *                      category below for how it's distinguished instead)
 *  - appLayer:       src/app/**                (pages, layouts, route handlers)
 *
 * File categories (orthogonal to element type — see `boundaries/files`):
 *  - moduleIndex:      src/modules/*\/index.ts             (a module's public
 *                        API file)
 *  - moduleServerOnly: src/modules/*\/queries.ts,
 *                        src/modules/*\/serverMutations.ts  (never
 *                        barrel-exported — see architecture.md's "Correction:
 *                        queries.ts is a server-only exception in every
 *                        module". next/headers breaks a Client Component's
 *                        bundle even via an unused re-export, so these are
 *                        always imported by direct file path instead of
 *                        through index.ts.)
 *
 * Rules enforce docs/FR/architecture.md's boundary rule: a module may only
 * import shared/core, its own internals (same captured `module` value),
 * another module's index.ts, or another module's queries.ts/
 * serverMutations.ts directly (all matched via file category, not element
 * type). `src/app` may only import shared/core, shared/layout, a module's
 * index.ts, or a module's queries.ts/serverMutations.ts directly — never a
 * module's other internals, and never touch Supabase directly.
 * `src/shared/layout` may additionally import any module's index.ts (see
 * the sharedLayout note above) or queries.ts/serverMutations.ts directly
 * (SiteHeader is a Server Component and fetches data itself) — no other
 * shared/core code may.
 *
 * Lint can't see "use client" — it only sees file paths. So the
 * moduleServerOnly exception is necessarily a bit wider than the intent
 * ("only server-only files should reach across it"); the actual guardrail
 * against a Client Component pulling in next/headers is Next's own build,
 * which will fail loudly if that happens. Treat the lint rule as
 * structural and Next's build as the real enforcement of the client/server
 * split.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*.ts", "src/**/*.tsx"],
      "boundaries/elements": [
        { type: "sharedLayout", pattern: "src/shared/layout/**" },
        { type: "sharedLayer", pattern: "src/shared/**" },
        { type: "moduleInternal", pattern: "src/modules/*/**", capture: ["module"] },
        { type: "appLayer", pattern: "src/app/**" },
      ],
      "boundaries/files": [
        { pattern: "**/modules/*/index.ts", category: "moduleIndex" },
        // Per docs/FR/architecture.md's "Correction: queries.ts is a
        // server-only exception in every module" — queries.ts and
        // serverMutations.ts are NEVER barrel-exported (next/headers
        // breaks Client Component bundles even via an unused re-export).
        // Server Components, Route Handlers, and other modules' own
        // server-only files import these by direct path instead.
        { pattern: "**/modules/*/queries.ts", category: "moduleServerOnly" },
        { pattern: "**/modules/*/serverMutations.ts", category: "moduleServerOnly" },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message:
            "{{from.element.type}} may not import from {{to.element.type}} here — see docs/FR/architecture.md's boundary rule.",
          policies: [
            {
              from: { element: { type: "sharedLayout" } },
              allow: [
                { to: { element: { type: "sharedLayer" } } },
                { to: { file: { categories: "moduleIndex" } } },
                // SiteHeader is a Server Component and fetches directly
                // (e.g. location.getLocationPickerData) — same exception
                // as appLayer below.
                { to: { file: { categories: "moduleServerOnly" } } },
              ],
            },
            {
              from: { element: { type: "sharedLayer" } },
              allow: { to: { element: { type: "sharedLayer" } } },
            },
            {
              from: { element: { type: "moduleInternal" } },
              allow: [
                { to: { element: { type: "sharedLayer" } } },
                // Same module's own internals (index.ts included — it's
                // still element type moduleInternal, just also carries the
                // moduleIndex file category below).
                {
                  to: {
                    element: {
                      type: "moduleInternal",
                      captured: { module: "{{from.captured.module}}" },
                    },
                  },
                },
                // Another module's public API — matched by file category,
                // not element type, since index.ts isn't a distinct element.
                { to: { file: { categories: "moduleIndex" } } },
                // Another module's queries.ts/serverMutations.ts, direct —
                // e.g. events/serverMutations.ts calling
                // categories/queries.ts or users/queries.ts. Only sanctioned
                // for genuinely server-only files; Next's own build will
                // reject this if a Client Component ends up on the
                // importing end (see architecture.md).
                { to: { file: { categories: "moduleServerOnly" } } },
              ],
            },
            {
              from: { element: { type: "appLayer" } },
              allow: [
                { to: { element: { type: "sharedLayer" } } },
                { to: { element: { type: "sharedLayout" } } },
                { to: { file: { categories: "moduleIndex" } } },
                // Route Handlers and Server Components import queries.ts /
                // serverMutations.ts directly, bypassing the barrel.
                { to: { file: { categories: "moduleServerOnly" } } },
              ],
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
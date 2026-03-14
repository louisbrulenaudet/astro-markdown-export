## astro-markdown-export – Guide for AI agents

This repository contains an Astro integration, `@louisbrulenaudet/astro-markdown-export`. It runs at Astro build time, reads Markdown files from an Astro content directory, enhances their frontmatter (for example with `source_url` and custom metadata), and writes route-shaped `index.md` files into the final build output so bots, crawlers, and AI agents can consume the same content that humans see.

Your goal as an AI agent is to keep this integration **robust, predictable, and well-documented** for Astro users who want bot/LLM‑friendly Markdown exports.

---

### 1. High-level behavior

- The integration is exposed as the default export from `src/index.ts`.
- It hooks into Astro’s `astro:config:done` and `astro:build:done` lifecycle events.
- At build time it:
  - Resolves a `siteUrl` (from options or from `astro.config.site`).
  - Locates `.md` files under a configured `contentDir` (default `src/content/blog`).
  - For each `.md` file with YAML frontmatter:
    - Enhances the frontmatter (optional `source_url` plus `additionalFrontmatter`).
    - Writes the resulting content to `<outputDir>/<routePrefix>/<slug>/index.md`.
  - Uses batched concurrency and optional `failOnError` behavior.

Always preserve this contract unless explicitly asked to change it, and update the documentation (`README.md`) and tests (`src/index.test.ts`) accordingly if you do.

---

### 2. Key files and their roles

- `src/index.ts`
  - Main integration implementation.
  - Defines `MarkdownExportOptions` and the core helpers:
    - `generateSlug` (filename → slug).
    - `formatSourceUrlsFrontmatter`, `formatAdditionalFrontmatter`, `formatNestedObject`, `enhanceFrontmatter`, `buildEnhancedMarkdown`.
    - `writeMarkdownFile`, `processMarkdownFile`, `processInBatches`, `createProcessingContext`.
  - Registers the `markdown-export` Astro integration and its hooks.

- `src/index.test.ts`
  - Vitest test suite that exercises:
    - Integration name and basic hook wiring.
    - Export behavior for blog posts and slug generation.
    - Frontmatter enhancement, including `additionalFrontmatter`.
    - Edge cases (no frontmatter, `siteUrl` taken from `config.site`).
  - When changing behavior in `src/index.ts`, update or extend these tests first or in parallel.

- `README.md`
  - User-facing documentation for Astro developers.
  - Must stay aligned with actual behavior:
    - Options and defaults.
    - Slug rules and output paths.
    - Build-time flow and usage examples.
  - If you add or change options, or adjust behavior, reflect those changes here.

- `package.json`
  - Node and Astro compatibility (`engines.node`, `peerDependencies.astro`).
  - Scripts:
    - `pnpm build`: build to `dist/` using `tsdown`.
    - `pnpm test`, `pnpm test:run`: run Vitest.
    - `pnpm check-types`: run `tsc --noEmit`.
    - `pnpm format`, `pnpm lint`, `pnpm check`: run Biome on the codebase.
  - Keep versions and scripts consistent with the actual tooling you rely on.

---

### 3. Coding conventions and constraints

- **Language and module system**
  - TypeScript with ES modules.
  - Prefer explicit types for public APIs, inferred types are acceptable internally where clear.

- **Error handling and robustness**
  - Respect the `failOnError` option semantics:
    - When `failOnError` is `true`, a processing error for a file should fail the build.
    - Otherwise, log the error via the provided `logger` and continue.
  - Do not throw on files that have no frontmatter; log a warning and skip instead.

- **Performance and I/O**
  - Use `processInBatches` to control concurrency for file operations.
  - Do not introduce unbounded parallelism or in-memory buffering of all content at once.

- **Frontmatter and YAML**
  - Use `escapeYamlString` and `formatNestedObject` to serialize arbitrary `additionalFrontmatter`.
  - Preserve the original frontmatter block exactly, then append new keys.
  - Avoid breaking YAML formatting; tests should cover typical and edge cases.

- **Slug generation and paths**
  - Keep slugs stable and URL-safe:
    - Lowercase.
    - Replace non‑alphanumeric characters with `-`.
    - Trim leading and trailing hyphens.
  - Maintain the path shape `<outputDir>/<routePrefix>/<slug>/index.md` unless explicitly asked to change it.

---

### 4. How to make changes safely

When modifying behavior or adding features:

1. **Update or add tests in `src/index.test.ts`.**
   - Cover new options or edge cases.
   - Validate both success and failure behavior where relevant.
2. **Implement or adjust logic in `src/index.ts`.**
   - Reuse existing utilities where possible.
   - Keep functions small and focused; prefer pure utilities for transforms.
3. **Run local checks (recommended order):**
   - `pnpm format`
   - `pnpm lint`
   - `pnpm check-types`
   - `pnpm test` (or `pnpm test:run`)
   - `pnpm build`
4. **Sync documentation:**
   - Update `README.md`:
     - Options table and defaults.
     - Behavior and edge case notes.
     - Examples if the public API changed.

Only consider changing the integration name, hooks, or high‑level behavior if the user explicitly asks for a redesign or breaking change.

---

### 5. How to extend the integration

Examples of safe, incremental extensions:

- Adding new optional fields to `additionalFrontmatter` examples in the README.
- Supporting additional content directories via configuration (while preserving defaults).
- Improving logging messages (without leaking sensitive paths).
- Adding tests for new edge cases (e.g. nested frontmatter objects, unusual filenames).

For larger changes (for example, supporting `.mdx`, nested directory traversal, or alternate output layouts):

- Clearly separate new behavior behind explicit options.
- Maintain backward‑compatible defaults.
- Document migration notes in `README.md` if defaults change.

---

### 6. How to interact with this repo as an AI agent

- **If asked to “improve docs”**:
  - Prefer editing `README.md` and, if relevant, this `AGENTS.md`.
  - Keep explanations concise and oriented towards Astro users.

- **If asked to “change behavior”**:
  - Start by reading `src/index.ts` and `src/index.test.ts` for current behavior.
  - Propose changes that preserve the public API shape when possible.
  - Update tests and docs to match the new behavior.

- **If asked to “add features for bots/LLMs”**:
  - Think in terms of frontmatter and path conventions that help downstream consumers.
  - Avoid embedding provider‑specific behavior (for example, special‑casing one crawler) unless explicitly requested.

Always keep the integration focused on its core responsibility: **exporting Astro content as well‑structured Markdown files suitable for bots, crawlers, and AI agents, without surprising Astro users.**


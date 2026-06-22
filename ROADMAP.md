# ROADMAP — outlion

> Supersedes `TODO.md` as the planning document. Every TODO item maps to a phase below.
> Last updated: 2026-06-12.
>
> **Status (2026-06-12): Phases 0–8 all implemented** on branch
> `feat/wasm-engine-phase-0-1` (unpushed). 45 file extensions on the unified tree-sitter engine,
> 11 output formatters, and the deterministic Symbol API. Deferred (see `TECHDEBT.md`): Dart +
> Protobuf/GraphQL grammars (runtime pin), PDF export, and reference edges beyond TS/JS/Python.

## Purpose & primary consumer

This library is past PoC validation: it works, and **kg-gen depends on it**
(`@wanshi-kg/outlion`, formerly `github:AlexSabaka/document-outline-gen`). kg-gen wraps it in
`src/shared/utils/documentOutline.ts`, calls `generateFromContent(content, ext, options)`
per file, and renders its own ASCII tree from the returned `OutlineNode[]` to inject as
`{{fileOutline}}` into LLM prompts (`PromptTemplateEngine.enhanceContext()`, configured by
the YAML-only `readers.outline` group).

**Contract stability rule.** kg-gen reads these `OutlineNode` fields: `title`, `type`,
`line`, `children`, and `metadata.{visibility, isStatic, isAbstract, parameters[].name,
dataType}`, plus options `{maxDepth, includeLineNumbers, includePrivate, includeComments}`.
The `OutlineNode` shape and `generateFromContent` signature are a public API — every phase
below is **additive** to that contract, never breaking.

## Architecture decisions

These three decisions shape the whole roadmap (confirmed 2026-06-12):

1. **Unified tree-sitter query engine for code languages.** One generic generator driven
   by per-language `.scm` query files (the `tags.scm` pattern used by GitHub code
   navigation, Zed, and nvim outlines) replaces bespoke per-language generators. Adding a
   language becomes "add grammar + query file + fixtures" instead of a 400–700 line class.
2. **web-tree-sitter (WASM), not node-tree-sitter (native).** kg-gen installs this repo
   from GitHub and `prepare` builds on every install; native grammars would drag node-gyp
   compilation into every consumer install. Prebuilt `.wasm` grammars (`tree-sitter-wasms`
   npm package; fallbacks: `@vscode/tree-sitter-wasm`, kreuzberg-dev
   `tree-sitter-language-pack` with 305+ languages) need zero compilation and run in
   Node/Bun/browser. WASM parses ~2–3× slower than native — irrelevant in kg-gen's
   LLM-bound pipeline.
3. **kg-gen Phase-8 enablement is in scope.** kg-gen's roadmap (Phase 8, "AST-seeded code
   extraction") wants deterministic tree-sitter symbol enumeration with `calls`/`imports`
   edges and content-hash incrementality. Outline generation and symbol enumeration share
   the same AST walk; this library is the natural home for that API (Phase 8 below).

## Current state (2026-06)

| Area | Engine | State |
|---|---|---|
| C++ | **native** tree-sitter | Only tree-sitter generator (`CppGenerator.ts`, 713 lines); the refactor stalled here |
| TS/JS | acorn + acorn-typescript | Works; plugin is a dead end (stale, no decorators, partial modern TS) |
| Python | pure regex (183 lines) | Weakest parser; README overclaims "deep AST parsing" |
| Java | java-ast (ANTLR) | Works, bespoke |
| C# | @fluffy-spoon/csharp-parser | Works, bespoke |
| md/json/xml/yaml/html/csv | regex / cheerio / fast-xml-parser / js-yaml | Adequate |
| CLI | commander (`src/cli.ts`) | Exists but **not registered** as `bin` in package.json |
| Tests | Jest, 1 file | Covers 3 of 15 generators |
| Deps | 8 native tree-sitter grammars installed | Only `tree-sitter-cpp` actually used |

Known consumer pain (logged in kg-gen `TECHDEBT.md` / `docs/AUDIT_REPORT.md` KG-17):
unknown extensions **throw**, producing noisy per-chunk warnings — kg-gen's `TextReader`
feeds ~70 extensions, we support 17. Parsing cost is paid per chunk on kg-gen's side, so
cheap parser initialization matters.

---

## Phase 0 — Foundation hardening

**Goal:** trustworthy build/test/release baseline before any engine work.
**Closes TODO:** "Test the build process", "Error handling improvements".

| # | Feature | Overview & steps | Effort |
|---|---|---|---|
| 0.1 | Build verification | `npm run build` clean on Node ≥ 18; remove stale `dist/`+`index.d.ts` from repo root or document why committed; CI workflow (build + test on push). | S |
| 0.2 | CLI registration | Add `"bin": {"document-outline-gen": "dist/cli.js"}` + shebang; smoke-test `npx`. | S |
| 0.3 | Graceful unknown extensions | Add `generateFromContentSafe()` (or option `{throwOnUnsupported: false}`) returning `null`/`[]` instead of throwing; keep the throwing path for compat. Directly silences kg-gen's per-chunk warning noise. | S |
| 0.4 | Typed errors | `OutlineError` hierarchy (`UnsupportedExtensionError`, `ParseError` with file/line context); parse failures degrade to partial outlines where possible, never crash the caller. | M |
| 0.5 | Test harness | Golden-file fixtures: `tests/fixtures/<lang>/input.*` + `expected.json` snapshots; one suite that walks all fixtures. This harness is the parity gate for Phases 1–2 migrations. | M |
| 0.6 | README truth-pass | Align claims with reality (Python is regex today; package name mismatch `document-outline-gen` vs README's `document-outline-generator`). | S |

## Phase 1 — Tree-sitter WASM engine core

**Goal:** the unified engine everything else builds on.
**Closes TODO:** "Position tracking" (all three items — tree-sitter gives start/end
row/column natively).

1. **Dependencies.** Add `web-tree-sitter` + `tree-sitter-wasms`; remove unused native
   grammar deps (keep `tree-sitter`/`tree-sitter-cpp` until the C++ pilot migrates).
2. **`TreeSitterGenerator` base class** (`src/generators/code/TreeSitterGenerator.ts`):
   lazy one-time WASM init, per-language parser cache (module-level singleton — kg-gen
   calls per chunk), grammar `.wasm` resolution from `tree-sitter-wasms` with override
   hook for custom grammars.
3. **Query-driven extraction.** Per-language `src/queries/<lang>/outline.scm` files
   (seeded from upstream `queries/tags.scm`, extended with captures for fields,
   properties, visibility modifiers). Generic walk: run query → captures →
   `OutlineNode[]` with **true parent-child nesting from the AST** (replaces the current
   line-number/indentation heuristics).
4. **Position mapping.** `node.startPosition`/`endPosition` → `line`, `column`, plus new
   optional `endLine`/`endColumn` (additive to the contract). Source-map support is
   deliberately dropped — outline consumers work on source, not bundles.
5. **Pilot: migrate C++** from native to WASM behind the new base class; parity-check
   against Phase 0.5 fixtures; then drop the native `tree-sitter`/`tree-sitter-cpp` deps.

**Effort:** L. **Gate:** C++ fixtures byte-identical (or reviewed-better) vs the native
implementation; cold-start parse of a 1k-line file < 100 ms, warm < 10 ms.

## Phase 2 — Migrate existing code languages

**Goal:** TS/JS/Python/Java/C# on the unified engine; bespoke parser deps deleted.
**Closes TODO:** "Improved TypeScript parsing" (decorators, JSDoc hooks, generics,
import/export), "Enhanced Python parsing" (async, inheritance, property decorators, type
hints), "Better JavaScript parsing" (ES6+, JSX, module exports).

Order is kg-gen-value-first (its near-term corpora are TS/JS/Python):

1. **Python** (biggest quality jump from regex): `tree-sitter-python` grammar — async
   defs, decorators, class inheritance (`argument_list` of `class_definition`), type
   hints, properties all fall out of the grammar + query file.
2. **TypeScript/JavaScript/TSX/JSX**: `tree-sitter-typescript`/`-javascript` — decorators,
   generics in signatures, import/export statements (new node type `import`/`export`),
   destructuring/spread, JSX components (capture `jsx_element` function components).
3. **Java**, then **C#**: migrate, verify against existing generators' output.
4. **Per language:** keep old generator until fixture parity (every node type the old one
   emitted is present or consciously improved), then delete it. After all five: drop
   `acorn`, `acorn-typescript`, `@babel/parser`, `@babel/traverse`, `java-ast`,
   `@fluffy-spoon/csharp-parser` from deps.

**Effort:** M per language (Python L — no AST baseline to crib from).
**Gate:** kg-gen's rendered `{{fileOutline}}` for a sample corpus is unchanged-or-better;
no metadata key kg-gen reads disappears.

## Phase 3 — Metadata depth

**Goal:** rich docstrings + signatures across all unified-engine languages.
**Closes TODO:** "Comment/docstring parsing" (all 4), "Signature analysis" (all 4).

| # | Feature | Overview & steps | Effort |
|---|---|---|---|
| 3.1 | Comment attachment | Generic "adjacent comment node" resolution in `TreeSitterGenerator` (leading comment for C-family/JS, trailing string-literal for Python docstrings); raw text into `metadata.docstring` behind `includeComments`. | M |
| 3.2 | Docstring style parsers | Pluggable parsers per style: JSDoc (`@param/@returns` tags), Python Google/NumPy/Sphinx sections, Javadoc, C# XML doc. Output structured `metadata.doc = {summary, params, returns}`; keep raw text too. | L |
| 3.3 | Signature analysis | Parameter names + types + defaults (extend the existing `parameters[]` shape — kg-gen already reads `.name`), `returnType`, generic type parameters (`metadata.typeParameters`), overload grouping (same-name siblings merged with `metadata.overloads: n`). | M |

**Gate:** kg-gen's tree formatter shows `params:` lists for Python/TS identical in shape
to today, now with types available.

## Phase 4 — Language expansion, wave 1 (code)

**Goal:** the TODO language list, each as grammar + query + fixtures on the Phase-1 engine.
**Closes TODO:** Go, Rust, PHP, Ruby, Swift, Kotlin, Dart, C/C++ (done in Ph.1), Scala, Lua.

Per-language recipe (document once in `CONTRIBUTING.md`, repeat 10×):

1. Confirm `.wasm` availability in `tree-sitter-wasms` (all ten are covered; Swift/Kotlin
   grammar quality is the weakest — validate against real-world files first).
2. Seed `src/queries/<lang>/outline.scm` from the upstream grammar's `queries/tags.scm`.
3. Extend captures for the TODO-specified constructs: Go packages/structs/methods; Rust
   modules/traits/impl blocks; PHP traits/namespaces; Ruby modules/constants; Swift
   protocols/extensions; Kotlin objects/extension functions; Dart mixins/extensions;
   Scala objects/traits; Lua tables/module functions.
4. Fixtures + registry entries (multi-extension: `.go`, `.rs`, `.php`, `.rb`, `.swift`,
   `.kt/.kts`, `.dart`, `.c/.h`, `.scala/.sbt`, `.lua`).

**Priority order** (by kg-gen `TextReader` extension list + ecosystem size): Go, Rust,
Ruby, PHP, Kotlin, Swift, Scala, Lua, Dart. **Effort:** S–M each once the recipe exists.

## Phase 5 — Config & data formats

**Closes TODO:** TOML, INI, Properties, CSV, Protocol Buffers, GraphQL.

| Format | Approach | Effort |
|---|---|---|
| TOML | tree-sitter grammar (wasm available); sections + key-value pairs, nested tables as children | S |
| INI / Properties | No grammar needed — simple line parsers extending `OutlineGenerator` directly (sections → keys; properties files are flat key-value) | S |
| CSV | Upgrade existing `CsvGenerator`: header row → column nodes with inferred `metadata.dataType` (string/number/date/bool sampling first N rows) | S |
| Protocol Buffers | tree-sitter-proto grammar; messages, services, RPCs, enums | M |
| GraphQL | tree-sitter-graphql grammar; types, queries, mutations, subscriptions, fields w/ types | M |

These all matter to kg-gen: `.toml`, `.ini`, `.cfg`, `.conf`, `.csv`, `.env` are in its
`TextReader` list and currently warn.

## Phase 6 — Markup formats

**Closes TODO:** reStructuredText, AsciiDoc, LaTeX, Org-mode, Wiki markup.

| Format | Approach | Effort |
|---|---|---|
| reStructuredText | tree-sitter-rst; section adornment hierarchy + directives | M |
| AsciiDoc | tree-sitter-asciidoc exists but is young — start regex on `=` heading levels + block delimiters, swap to grammar when it matures | M |
| LaTeX | tree-sitter-latex (solid); `\part/\chapter/\section…` hierarchy + selected commands/environments | M |
| Org-mode | tree-sitter-org; star-depth headings + `#+BEGIN` blocks | S |
| Wiki markup | Regex on `== heading ==` levels (MediaWiki); no reliable grammar — keep deliberately minimal | S |

Also: consider migrating `MarkdownGenerator` from regex to `tree-sitter-markdown` (already
conceptually proven; gives setext headings, nested structures) — optional, current one works.

## Phase 7 — Output formats & exports

**Closes TODO:** "Different output formats" (Mermaid, PlantUML, DOT, HTML, PDF), "Export
options" (CSV, XML, YAML, SQL).

**Key design move:** introduce a **formatter layer** decoupled from generators —
`src/formatters/`, interface `OutlineFormatter: (nodes: OutlineNode[], opts) => string`,
registry keyed by format name, wired to CLI `--format <name>` and exported for library use.

1. **`ascii-tree`** — port kg-gen's `formatAsTree`/`formatMetadata` upstream (same output,
   single source of truth; kg-gen deletes its copy and gains every future improvement). Add
   a `compact` option (no line numbers/metadata) for token-efficient prompt injection. (S)
2. **`json`** (exists — formalize), **`yaml`**, **`xml`**, **`csv`** (flattened rows:
   `path,title,type,depth,line`) — for spreadsheet analysis and tool integration. (S each)
3. **`mermaid`** — `classDiagram` for class-bearing outlines, `flowchart` fallback for
   document hierarchies. (M)
4. **`plantuml`** — class diagram syntax, same model mapping as Mermaid. (S after 3)
5. **`dot`** — Graphviz digraph of containment (and, post-Phase-8, `calls`/`imports`
   edges). (S)
6. **`html`** — standalone page, nested `<ul>` nav + anchors; no framework, one template
   string. (M)
7. **`sql`** — `CREATE TABLE outline_nodes (…)` + `INSERT`s with parent-id references;
   for database storage of large corpus scans. (S)
8. **PDF — deferred.** A headless-browser dependency (puppeteer) is not worth it for this
   library; document `--format html | <print-to-pdf>` as the supported path. Revisit only
   on real demand.

## Phase 8 — Symbol API (kg-gen Phase-8 enablement)

**Goal:** the deterministic symbol/edge layer kg-gen's roadmap Phase 8 ("AST-seeded code
extraction", `kg-gen/docs/ROADMAP.md`) needs: enumerate definitions before the LLM pass so
the LLM augments rather than originates the symbol set.

1. **`extractSymbols(content, ext, opts) → SymbolTable`** — new public API beside the
   outline API, same parser/query infrastructure. Flat list: `{name, qualifiedName, kind,
   span: {startLine, endLine}, exported: boolean, signature?}`. Kinds drawn from a small
   stable enum that kg-gen maps into its Phase-2 type vocabulary (coordinate the enum —
   it must not become a parallel taxonomy). (M)
2. **Reference edges** — second query pass per language (`queries/<lang>/references.scm`,
   seeded from upstream `tags.scm` `@reference.call` captures + import/export statement
   queries): emit `{from, to, kind: 'calls' | 'imports', line}` with name-resolution
   *within file only* (cross-file resolution stays kg-gen's job). (L)
3. **Content-hash helper** — `hashContent(content) → string` (xxh3 or BLAKE3 via a pure-JS
   /wasm lib — no native deps, per the WASM decision) so kg-gen can skip re-parsing
   unchanged files; enables its Phase-10 incremental pipeline. (S)
4. **Versioned JSON schema** — publish the `SymbolTable` schema (typed exports + a
   `SCHEMA_VERSION` constant); kg-gen pins against it. (S)

**Gate (mirrors kg-gen's):** every top-level exported symbol of kg-gen's self-test corpus
appears in `extractSymbols` output for TS/JS/Python; zero network calls; re-run on
unchanged content is hash-equal.

---

## Cross-cutting concerns

- **Versioning & release.** Start tagging (`v1.1.0` after Phase 0). Recommend kg-gen pin
  `@wanshi-kg/outlion@^1.0` (npm) — today it tracks the default
  branch, so any push lands in kg-gen's next install. Consider npm publish once Phase 2
  stabilizes (name `document-outline-gen` vs README's `document-outline-generator` —
  resolve in Phase 0.6).
- **CI.** GitHub Actions: build + jest on push/PR; matrix Node 18/20/22. WASM runtime
  means no per-platform build matrix needed.
- **Performance budget.** Parser instances cached per language (kg-gen calls per chunk);
  WASM grammars lazy-loaded on first use of each language; target < 10 ms warm parse for
  typical source files. Re-measure at each phase gate.
- **Token efficiency.** kg-gen's docs flag "outline toggle to trade context for tokens" —
  the `compact` ascii-tree mode (7.1) plus existing `maxDepth` cover this; document the
  combination in README for kg-gen's `readers.outline` tuning.

## Suggested sequencing

```
Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phases 5/6 (parallel)
 (gates      (engine)    (parity     (depth)     (breadth)        │
  parity)                 migration)    │                         │
                                        └────► Phase 8 ◄──────────┘
                                               (symbol API — only needs Phases 1–2)
Phase 7 (formatters) — independent of 3–6; can start any time after Phase 1.
```

Phase 8 deliberately needs only Phases 1–2 (TS/JS/Python on the unified engine) — if
kg-gen's Phase 8 becomes urgent, it can jump the queue past Phases 3–7.

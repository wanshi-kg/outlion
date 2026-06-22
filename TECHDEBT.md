# Tech debt

Tracked shortcuts and known gaps.

## Pre-existing parser gaps (surfaced 2026-06-12 when the jest harness was restored)

The test suite never actually ran before (no jest config). Standing it up revealed
generators that produce wrong output for cases the legacy tests assert. The remaining two are
**out of scope** for the engine work and are marked `it.skip` in
`tests/DocumentOutlineGenerator.test.ts` with back-references here. (The acorn-TypeScript gap
was resolved by the Phase 2 migration and its test is un-skipped.)

| Generator | Symptom | Resolution path |
|---|---|---|
| `MarkdownGenerator` | gray-matter frontmatter is parsed away but not exposed as `metadata.frontmatter` | Markdown rework (Phase 6, optional) |
| `HtmlGenerator` (cheerio) | does not emit `id`'d `<section>` nodes | HTML rework (not currently scheduled) |

## WASM engine (Phase 1)

- **`web-tree-sitter` is pinned `<0.25` (`^0.24.7`).** The 0.25 release rewrote the WASM
  loader (new dylink format) and cannot load the prebuilt grammars shipped by
  `tree-sitter-wasms@0.1.x` (which tops out at 0.1.13). Upgrading the runtime requires a
  0.25-compatible grammar source (e.g. `@vscode/tree-sitter-wasm` or self-built wasm).
  Until then we stay on the 0.24.x API (`Parser.Language.load`, `lang.query`).
- **Dart is deferred (consequence of the pin).** `tree-sitter-wasms@0.1.13`'s
  `tree-sitter-dart.wasm` is grammar ABI version 15, but web-tree-sitter 0.24.7 only loads
  13–14 (`Incompatible language version 15`). Dart is the one Phase 4 language not yet
  shipped; it lands once the runtime upgrade above is done.
- **Protocol Buffers and GraphQL are deferred (Phase 5).** `tree-sitter-wasms@0.1.13` ships
  no `proto`/`graphql` grammar (only TOML, of the Phase-5 formats), and `@vscode/tree-sitter-wasm`
  needs the 0.25 runtime we're pinned away from. Both land when the runtime upgrade lands or an
  ABI-13/14 wasm source appears — or sooner via hand-written line parsers (the same pattern as
  `IniGenerator`/`PropertiesGenerator`; both are declarative `keyword Name { … }` IDLs).
- **Markup formats are regex parsers, not tree-sitter (Phase 6).** `tree-sitter-wasms@0.1.13`
  ships no `rst`/`asciidoc`/`latex`/`org`/`wiki` grammar (nor `markdown`), so RST/AsciiDoc/LaTeX/
  Org/Wiki are hand-written line parsers on the shared `MarkupGenerator` base — appropriate, since
  markup is line-oriented. The optional `MarkdownGenerator` → `tree-sitter-markdown` migration
  (Phase 6) stays blocked for the same reason; the current regex Markdown parser is fine.

## Notes

- **`OutlineNode` contract is additive-only (kg-gen depends on it).** kg-gen reads `title`,
  `type`, `line`, `children`, and `metadata.{visibility, isStatic, isAbstract, parameters[].name,
  dataType}`, plus the `{maxDepth, includeLineNumbers, includePrivate, includeComments}` options.
  Never remove or rename these fields — only add. (Preserved here from the retired ROADMAP.)
- `generateFromContent` rejects with `UnsupportedExtensionError` on unknown extensions.
  Heterogeneous-input callers (kg-gen) should switch to `generateFromContentSafe` /
  `generateFromFileSafe`, which return `[]` instead. kg-gen still calls the throwing variant
  in `src/shared/utils/documentOutline.ts` — switch it over to silence the per-chunk warnings.
- **Bare `.env` dotfiles don't dispatch by path.** `path.extname('.env')` is `''`, so
  `generateFromFile('.env')` finds no generator. `*.env` files (e.g. `prod.env`) and direct
  `generateFromContent(content, 'env')` calls route to `PropertiesGenerator` correctly.
- **kg-gen still ships its own ascii-tree copy.** Phase 7 made `formatOutline(nodes, 'ascii-tree')`
  the canonical renderer (byte-identical to the old inline version). `kg-gen/src/shared/utils/
  documentOutline.ts` should delete its private `formatAsTree`/`formatMetadata` and call the
  exported formatter so it inherits future improvements (e.g. the `compact` mode). Cross-repo
  follow-up; not done here.
- **PDF export is intentionally deferred (Phase 7).** A headless-browser dep (puppeteer) isn't
  worth it for this library; the supported path is `--format html` piped through a browser's
  print-to-PDF. Revisit only on real demand.
- **Symbol reference edges are TS/JS/Python only (Phase 8).** `extractSymbols` enumerates
  definitions for all code languages, but `calls`/`imports` edges need a per-language
  `queries/<lang>/references.scm` and only ship for TS/JS/Python (kg-gen's near-term corpora; it
  explicitly defers Go/C/C++ call precision). Other code languages return symbols with
  `references: []` — drop in a `references.scm` to light each up.
- **Symbol edges are coarse by design (Phase 8).** `imports` edges carry the module specifier, not
  per-imported-name edges; within-file call resolution is name-based (no type/overload resolution).
  Adequate for seeding a downstream extractor, not a precise call graph — the latter is the
  consumer's job (cross-file) or a future refinement.

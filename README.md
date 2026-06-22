# Document Outline Generator

A universal document outline structure generator for various file types and programming languages. Perfect for knowledge graphs, documentation tools, and content analysis.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Multi-format Support**: Handles documents (Markdown, JSON, XML, YAML, HTML, CSV) and code files
- **Code Analysis**: AST-based parsing for TypeScript, JavaScript, Python, Java, C#, and C++. Python & C++ run on tree-sitter; the engine is migrating to a unified tree-sitter query core — see [ROADMAP.md](ROADMAP.md)
- **Hierarchical Structure**: Maintains proper parent-child relationships
- **Rich Metadata**: Line numbers, visibility, parameters, docstrings, and more
- **Extensible Architecture**: Easy to add support for new file types
- **CLI Tool**: Command-line interface for batch processing
- **TypeScript First**: Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install @wanshi-kg/outlion
# or from GitHub: npm install github:wanshi-kg/outlion
```

The `outlion` CLI binary is available after install (see [CLI Usage](#cli-usage)).

## 🎯 Quick Start

### Basic Usage

```typescript
import DocumentOutlineGenerator from '@wanshi-kg/outlion';

const generator = new DocumentOutlineGenerator();

// Analyze a file
const outline = await generator.generateFromFile('./example.md');
console.log(JSON.stringify(outline, null, 2));

// Analyze content directly
const outline = await generator.generateFromContent(
  '# Title\n## Subtitle\nContent here', 
  'md'
);
```

### With Options

```typescript
const outline = await generator.generateFromFile('./src/app.ts', {
  includeLineNumbers: true,
  maxDepth: 3,
  includePrivate: false,
  includeComments: true
});
```

### CLI Usage

```bash
# Basic analysis
outlion example.ts

# With options
outlion src/app.py --line-numbers --max-depth 2 --format json

# Export formats: ascii-tree (default), json, yaml, xml, csv, sql, dot, mermaid, plantuml, html
outlion src/app.ts --format mermaid
outlion data.csv --format sql --output nodes.sql

# Token-lean tree (no line numbers / metadata)
outlion src/app.ts --format tree --compact

# Save to file
outlion README.md --output outline.json

# List supported extensions / output formats
outlion list-extensions
outlion list-formats
```

## 📋 Supported File Types

| Extension | Type | Features |
|-----------|------|----------|
| `.md`, `.markdown` | Markdown | Headings (H1-H6), frontmatter support |
| `.json` | JSON | Schema analysis, nested object structure |
| `.xml` | XML | Element hierarchy, attributes detection |
| `.yaml`, `.yml` | YAML | Object structure, array handling |
| `.html`, `.htm` | HTML | Headings, semantic elements (`<section>`, `<article>`, etc.) |
| `.csv` | CSV | Header columns with inferred `dataType` (string/number/date/bool/email/url) |
| `.ts`, `.tsx` | TypeScript | Classes, interfaces, functions, types, enums |
| `.js`, `.jsx` | JavaScript | Classes, functions, variables, methods |
| `.py` | Python | Classes, functions, methods, properties, decorators (tree-sitter) |
| `.java` | Java | Classes, methods, fields, constructors |
| `.cs` | C# | Classes, methods, properties, events |
| `.cpp` | C++ | Namespaces, classes, structs, enums, functions, methods (tree-sitter) |
| `.go` | Go | Structs, interfaces, functions, methods, fields, constants |
| `.rs` | Rust | Structs, enums, traits, impls, functions, modules |
| `.rb`, `.rake`, `.gemspec` | Ruby | Modules, classes, methods, singleton methods |
| `.php`, `.phtml` | PHP | Namespaces, classes, interfaces, traits, methods, properties |
| `.kt`, `.kts` | Kotlin | Classes, interfaces, objects, functions, properties |
| `.swift` | Swift | Classes, structs, enums, protocols, functions, properties |
| `.scala`, `.sbt` | Scala | Classes, objects, traits, methods |
| `.lua` | Lua | Functions, local functions, table functions |
| `.toml` | TOML | Tables, nested tables, array-of-tables, key/value pairs |
| `.ini`, `.cfg`, `.conf` | INI | Sections and key/value pairs (`.conf` best-effort) |
| `.properties`, `.env` | Properties | Flat key/value pairs with values |
| `.rst`, `.rest` | reStructuredText | Adornment-order section hierarchy, directives |
| `.adoc`, `.asciidoc` | AsciiDoc | `=`-level headings, source/admonition blocks |
| `.tex`, `.latex` | LaTeX | `\section`-family hierarchy, selected environments |
| `.org` | Org-mode | `*`-star headings (TODO/priority/tags), `#+BEGIN` blocks |
| `.wiki`, `.mediawiki` | Wiki | MediaWiki `== ==` headings, code blocks |

All code languages run on a single tree-sitter (WASM) query engine. TOML uses the same engine;
INI/Properties and the markup formats (RST/AsciiDoc/LaTeX/Org/Wiki) are line parsers. Protocol
Buffers and GraphQL are deferred (no grammar under the pinned runtime — see
[TECHDEBT.md](TECHDEBT.md)). See [ROADMAP.md](ROADMAP.md).

## 📊 Output Format

### OutlineNode Structure

```typescript
interface OutlineNode {
  title: string;              // Name/title of the item
  type: string;               // Type: heading, function, class, etc.
  depth: number;              // Nesting level (1 = top-level)
  line?: number;              // Line number (1-based)
  column?: number;            // Column number (1-based)
  children?: OutlineNode[];   // Child items
  metadata?: {                // Additional information
    visibility?: 'public' | 'private' | 'protected';
    isStatic?: boolean;
    isAbstract?: boolean;
    parameters?: Parameter[];
    returnType?: string;
    docstring?: string;
    // ... more metadata based on file type
  };
  id?: string;               // Unique identifier
  anchor?: string;           // Link anchor (for web documents)
}
```

### Example Outputs

#### Markdown File
```json
[
  {
    "title": "Introduction",
    "type": "heading",
    "depth": 1,
    "line": 1,
    "anchor": "introduction",
    "children": [
      {
        "title": "Getting Started",
        "type": "heading",
        "depth": 2,
        "line": 5,
        "anchor": "getting-started"
      }
    ]
  }
]
```

#### TypeScript Class
```json
[
  {
    "title": "UserService",
    "type": "class",
    "depth": 1,
    "line": 10,
    "children": [
      {
        "title": "constructor",
        "type": "method",
        "depth": 2,
        "line": 12,
        "metadata": {
          "visibility": "public",
          "parameters": [
            {"name": "apiKey", "type": "string"}
          ]
        }
      },
      {
        "title": "getUser",
        "type": "method",
        "depth": 2,
        "line": 16,
        "metadata": {
          "visibility": "public",
          "parameters": [
            {"name": "id", "type": "number"}
          ],
          "returnType": "Promise<User>"
        }
      }
    ]
  }
]
```

### Export Formatters

The same outline can be rendered into any registered format from the library:

```typescript
import DocumentOutlineGenerator, { formatOutline, getFormats } from '@wanshi-kg/outlion';

const generator = new DocumentOutlineGenerator();
const outline = await generator.generateFromFile('./src/app.ts');

getFormats(); // ['ascii-tree','csv','dot','html','json','mermaid','plantuml','sql','tree','xml','yaml']

const tree    = formatOutline(outline, 'ascii-tree', { compact: true }); // token-lean prompt view
const diagram = formatOutline(outline, 'mermaid');  // classDiagram / flowchart
const rows    = formatOutline(outline, 'csv');      // path,title,type,depth,line
const inserts = formatOutline(outline, 'sql');      // CREATE TABLE + INSERTs
```

`ascii-tree` is the canonical view (kg-gen renders it into `{{fileOutline}}` prompts). Data
exports (`json`/`yaml`/`xml`/`csv`/`sql`) suit tooling and storage; diagram exports
(`mermaid`/`plantuml`/`dot`/`html`) suit visualization. PDF is intentionally out of scope — use
`html` + a browser's print-to-PDF.

## 🧬 Symbol API (code)

Beside the outline, `extractSymbols` enumerates code symbols **deterministically and network-free**
— for AST-seeded extraction pipelines that want the symbol set before any LLM pass. It returns
definitions for every code language, plus within-file `calls`/`imports` edges for TypeScript,
JavaScript and Python.

```typescript
import DocumentOutlineGenerator, { hashContent, SYMBOL_SCHEMA_VERSION } from '@wanshi-kg/outlion';

const generator = new DocumentOutlineGenerator();
const table = await generator.extractSymbols(source, 'ts');
// {
//   schemaVersion: 1,
//   symbols:    [{ name, qualifiedName, kind, span: { startLine, endLine }, exported, signature? }],
//   references: [{ from, to, kind: 'calls' | 'imports', line }],
// }

hashContent(source); // sha256 hex — skip re-parsing unchanged files
```

`kind` is a small, stable, **snake_case** enum (`function`, `method`, `class`, `interface`, `enum`,
`enum_member`, `struct`, `trait`, `type_alias`, `field`, `property`, `constant`, `module`, …) meant
to fold cleanly into a downstream normalized vocabulary. References resolve names **within the file
only** — cross-file resolution is the consumer's job. Non-code extensions return an empty table.
The `SymbolTable` shape is versioned (`SYMBOL_SCHEMA_VERSION`) with an exported JSON Schema
(`SYMBOL_TABLE_JSON_SCHEMA`).

CLI: `outlion symbols src/app.ts`.

## ⚙️ Configuration Options

```typescript
interface GeneratorOptions {
  includeLineNumbers?: boolean;    // Include position information
  maxDepth?: number;              // Limit nesting depth
  fileName?: string;              // File context for better analysis
  includePrivate?: boolean;       // Include private/internal members
  includeComments?: boolean;      // Include documentation/comments
  
  // Custom options for specific generators
  [key: string]: any;
}
```

## 🔧 Advanced Usage

### Custom Generators

Create your own generator for unsupported file types:

```typescript
import { OutlineGenerator, OutlineNode, GeneratorOptions } from '@wanshi-kg/outlion';

class SqlGenerator extends OutlineGenerator {
  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const nodes: OutlineNode[] = [];
    
    // Your parsing logic here
    const tables = this.extractTables(content);
    
    for (const table of tables) {
      const node = this.createNode(
        table.name,
        'table',
        1,
        table.position,
        { columns: table.columns }
      );
      nodes.push(node);
    }
    
    return nodes;
  }

  getSupportedExtensions(): string[] {
    return ['sql'];
  }
  
  private extractTables(content: string) {
    // Implementation here
    return [];
  }
}

// Register the custom generator
const generator = new DocumentOutlineGenerator();
generator.registerGenerator('sql', new SqlGenerator());
```

### Batch Processing

```typescript
import fs from 'fs/promises';
import path from 'path';

async function analyzeProject(projectPath: string) {
  const generator = new DocumentOutlineGenerator();
  const results = new Map();
  
  async function processDirectory(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        await processDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).slice(1);
        
        if (generator.isSupported(ext)) {
          try {
            const outline = await generator.generateFromFile(fullPath);
            results.set(fullPath, outline);
          } catch (error) {
            console.warn(`Failed to process ${fullPath}:`, error);
          }
        }
      }
    }
  }
  
  await processDirectory(projectPath);
  return results;
}
```

## 🧪 Development

### Setup

```bash
git clone https://github.com/wanshi-kg/outlion.git
cd outlion
npm install
```

### Available Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Watch mode for development
npm test             # Run tests
npm run test:watch   # Watch mode for tests
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
```

### Project Structure

```
src/
├── index.ts                    # Main entry point + generator registry
├── types.ts                    # OutlineNode / GeneratorOptions definitions
├── errors.ts                   # Typed error hierarchy
├── cli.ts                      # CLI implementation
├── generators/
│   ├── OutlineGenerator.ts     # Base generator class
│   ├── MarkdownGenerator.ts    # Markdown
│   ├── JsonGenerator.ts        # JSON
│   ├── XmlGenerator.ts         # XML
│   ├── YamlGenerator.ts        # YAML
│   ├── HtmlGenerator.ts        # HTML
│   ├── CsvGenerator.ts         # CSV
│   ├── EmptyGenerator.ts       # Empty / fallback
│   └── code/
│       ├── TreeSitterGenerator.ts  # Shared WASM tree-sitter base
│       ├── TypeScriptGenerator.ts  # TypeScript (acorn)
│       ├── JavaScriptGenerator.ts  # JavaScript (acorn)
│       ├── PythonGenerator.ts      # Python (tree-sitter)
│       ├── JavaGenerator.ts        # Java (ANTLR)
│       ├── CSharpGenerator.ts      # C#
│       └── CppGenerator.ts         # C++ (tree-sitter)
├── queries/                    # Per-language tree-sitter .scm query files
tests/
├── DocumentOutlineGenerator.test.ts
├── golden.test.ts              # Golden-file fixture harness
└── fixtures/<lang>/            # input.* + expected.json
```

### Adding New Language Support

For tree-sitter languages (the target architecture):

1. Add a `src/queries/<lang>/outline.scm` query file
2. Subclass `TreeSitterGenerator` for the language
3. Register the extension in `DocumentOutlineGenerator`
4. Add a `tests/fixtures/<lang>/` golden fixture

See [ROADMAP.md](ROADMAP.md) for the unified engine design.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [web-tree-sitter](https://github.com/tree-sitter/tree-sitter) + [tree-sitter-wasms](https://github.com/Gregoor/tree-sitter-wasms) for code parsing (TS, JS, Python, Java, C#, C++)
- [Gray Matter](https://github.com/jonschlinkert/gray-matter) for frontmatter support
- [Cheerio](https://github.com/cheeriojs/cheerio) for HTML parsing
- [Fast XML Parser](https://github.com/NaturalIntelligence/fast-xml-parser) for XML support

## 🔗 Related Projects

- [markdown-toc](https://github.com/jonschlinkert/markdown-toc) - Generate table of contents for markdown files
- [json-schema-generator](https://github.com/krg7880/json-schema-generator) - Generate JSON schemas
- [tree-sitter](https://github.com/tree-sitter/tree-sitter) - Incremental parsing system

---

Made with ❤️ for better code analysis and documentation tools.
import { TreeSitterGenerator, DefinitionCapture } from './TreeSitterGenerator';
import { GeneratorOptions, OutlineNode } from '../../types';

/**
 * TOML outline generator. Tables (`[section]`) and array-of-tables (`[[name]]`)
 * become `section` nodes; key/value pairs become `property` nodes nested under
 * their table via real AST containment.
 *
 * TOML tables are flat siblings in the AST — `[server]` and `[server.tls]` are
 * both direct children of the document — so after the base builds the (flat)
 * outline we reparent dotted sub-tables under their longest existing prefix
 * table to recover the logical hierarchy outlion exposes.
 */
export class TomlGenerator extends TreeSitterGenerator {
  protected readonly grammarName = 'toml';

  getSupportedExtensions(): string[] {
    return ['toml'];
  }

  protected mapKindToType(kind: string): string {
    return kind === 'key' ? 'property' : 'section'; // table / table-array
  }

  protected extractMetadata(def: DefinitionCapture): Record<string, unknown> | undefined {
    if (def.kind !== 'key') {
      return undefined;
    }
    const pair = def.defNode;
    const value = pair.namedChildren[pair.namedChildren.length - 1];
    if (value && value.id !== def.nameNode?.id) {
      return { value: value.text };
    }
    return undefined;
  }

  async generate(content: string, options: GeneratorOptions = {}): Promise<OutlineNode[]> {
    const flat = await super.generate(content, { ...options, maxDepth: undefined });
    const nested = this.nestDottedTables(flat);
    return this.filterByDepth(nested, options.maxDepth);
  }

  /** Reparent `[a.b]` under `[a]` (longest existing prefix), recompute depths. */
  private nestDottedTables(roots: OutlineNode[]): OutlineNode[] {
    const byName = new Map<string, OutlineNode>();
    for (const node of roots) {
      if (node.type === 'section') {
        byName.set(node.title, node);
      }
    }
    const result: OutlineNode[] = [];
    for (const node of roots) {
      if (node.type === 'section' && node.title.includes('.')) {
        const parent = this.prefixParent(node.title, byName);
        if (parent) {
          (parent.children ||= []).push(node);
          continue;
        }
      }
      result.push(node);
    }
    for (const root of result) {
      this.recomputeDepth(root, 1);
    }
    return result;
  }

  private prefixParent(
    name: string,
    byName: Map<string, OutlineNode>,
  ): OutlineNode | undefined {
    const parts = name.split('.');
    for (let i = parts.length - 1; i >= 1; i--) {
      const parent = byName.get(parts.slice(0, i).join('.'));
      if (parent) {
        return parent;
      }
    }
    return undefined;
  }

  private recomputeDepth(node: OutlineNode, depth: number): void {
    node.depth = depth;
    for (const child of node.children ?? []) {
      this.recomputeDepth(child, depth + 1);
    }
  }
}

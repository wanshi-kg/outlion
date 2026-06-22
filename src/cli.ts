#!/usr/bin/env node

import { program } from 'commander';
import fs from 'fs/promises';
import DocumentOutlineGenerator from '.';
import { GeneratorOptions } from './types';
import { formatOutline, getFormats } from './formatters';
import { UnsupportedFormatError } from './errors';

program
  .name('outlion')
  .description('Generate outline structures for various document types and code files')
  .version('1.0.0');

program
  .argument('<file>', 'file to analyze')
  .option('-d, --max-depth <number>', 'maximum depth to traverse', parseInt)
  .option('-l, --line-numbers', 'include line numbers in output')
  .option('-p, --include-private', 'include private members (for code files)')
  .option('-c, --include-comments', 'include comments and docstrings')
  .option('-f, --format <type>', `output format (${getFormats().join('|')})`, 'tree')
  .option('--compact', 'compact output (ascii-tree/json: drop line numbers & metadata)')
  .option('-o, --output <file>', 'output file (default: stdout)')
  .action(async (file: string, options: any) => {
    try {
      const generator = new DocumentOutlineGenerator();

      // Check if file exists
      await fs.access(file);

      // Prepare options
      const generatorOptions: GeneratorOptions = {
        includeLineNumbers: options.lineNumbers,
        maxDepth: options.maxDepth,
        includePrivate: options.includePrivate,
        includeComments: options.includeComments,
      };

      // Generate outline
      const outline = await generator.generateFromFile(file, generatorOptions);

      // Format output through the formatter registry
      const output = formatOutline(outline, options.format, { compact: options.compact });

      // Write output
      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(`Outline written to ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        console.error('Error:', error.message);
      } else {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      }
      process.exit(1);
    }
  });

program
  .command('symbols <file>')
  .description('Extract a deterministic symbol table (code files)')
  .action(async (file: string) => {
    try {
      const generator = new DocumentOutlineGenerator();
      await fs.access(file);
      const table = await generator.extractSymbolsFromFile(file);
      console.log(JSON.stringify(table, null, 2));
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program
  .command('list-extensions')
  .description('List all supported file extensions')
  .action(() => {
    const generator = new DocumentOutlineGenerator();
    const extensions = generator.getSupportedExtensions();

    console.log('Supported file extensions:');
    extensions.sort().forEach((ext) => {
      console.log(`  .${ext}`);
    });
  });

program
  .command('list-formats')
  .description('List all supported output formats')
  .action(() => {
    console.log('Supported output formats:');
    getFormats().forEach((format) => {
      console.log(`  ${format}`);
    });
  });

// Add to package.json scripts
if (require.main === module) {
  program.parse();
}

export { program };

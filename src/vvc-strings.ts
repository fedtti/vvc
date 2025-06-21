#!/usr/bin/env node

import type { MultiLanguageString } from '@vivocha/public-entities';
import { Scopes } from 'arrest';
import { Command } from 'commander';
import fs from 'fs';
import { access } from 'fs/promises';
import * as jsonpolice from 'jsonpolice';
import { parse as parsePath } from 'path';
import { meta, read as readConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';
import { exportPOFiles, fetchStrings, importPOFiles, uploadStringChanges } from './lib/strings.js';
import { retriever, wsUrl } from './lib/ws.js';

(async () => {
  const program = new Command();
  const options = program.opts();

  try {
    await checkLoginAndVvcVersion();
    const config: Config = await readConfig();

    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output');

    const commands = {
      push: program
        .command('push <strings_json_file> [other_json_files...]')
        .description('Push a new version of the strings to the Vivocha servers')
        .action(async (strings_json_file, other_json_files, options) => {
          let exitCode = 0;
          let files;
          if (other_json_files) {
            files = [strings_json_file, ...other_json_files];
          } else {
            files = [strings_json_file];
          }
          try {
            let schemaUrl = await wsUrl('schemas/string');
            let parser = await jsonpolice.create(
              {
                "type": "array",
                "items": {"$ref": schemaUrl},
                "minItems": 2
              },
              { scope: schemaUrl,
                retriever }
            );

            for (let f of files) {
              await access(f, fs.constants.R_OK).catch(() => {
                throw "file not found";
              });

              // load strings.json
              const strings: MultiLanguageString[] = await new Promise<MultiLanguageString[]>(resolve => {
                const raw = fs.readFileSync(f).toString();
                resolve(JSON.parse(raw) as MultiLanguageString[]);
              }).catch(() => {
                throw "Failed to parse file";
              });

              // get the strings schema
              // validate the strings
              await parser.validate(strings).catch(err => {
                throw `invalid format of strings.json, ${err.message} ${err.path || ''}`;
              });

              await uploadStringChanges(strings, options.global);
            }
          } catch (e) {
            console.error(e);
            exitCode = 1;
          }
          process.exit(exitCode);
        }),
      pull: program
        .command('pull')
        .description('Pull strings from the Vivocha servers to stdout')
        .option('-p, --prefix <strings prefix>', 'Pull only the strings starting with prefix', '')
        .action(async options => {
          let exitCode = 0;

          try {
            const strings = await fetchStrings(options.prefix, options.global).catch(() => {
              throw 'Failed to download the strings';
            });

            process.stdout.write(JSON.stringify(strings, null, 2) + '\n');
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.exit(exitCode);
          }
        }),
      import: program
        .command('import <po_file> [other_po_files...]')
        .description('Import gettext formatted strings and convert them into the Vivocha format')
        .option('-p, --prefix <strings prefix>', 'Import only the strings starting with prefix', '')
        .option('-m, --merge <json to merge>', 'Merge existing strings into the output file', '')
        .action(async (po_file, other_po_files, options) => {
          let exitCode = 0;
          let files;
          if (other_po_files) {
            files = [po_file, ...other_po_files];
          } else {
            files = [po_file];
          }
          try {
            const mergeTo: MultiLanguageString[] = options.merge ? JSON.parse(fs.readFileSync(options.merge, { encoding: "utf8" })) : [];
            const strings = (await importPOFiles(files, mergeTo, options.prefix)).sort((a,b) => a.id.localeCompare(b.id));
            process.stdout.write(JSON.stringify(strings, null, 2) + '\n');
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.exit(exitCode);
          }
        }),
      export: program
        .command('export <strings_json_file> [other_json_files...]')
        .description('Export Vivocha strings to gettext formatted strings')
        .option('-l, --language <name>', 'Export only the specified language', '')
        .option('-r, --reference <language>', 'Reference translation to include in exported files', '')
        .option('-p, --prefix <strings prefix>', 'Export only the strings starting with prefix', '')
        .option('-P, --path <output path>', 'Use the specified path/prefix when exporting', './')
        .option('-b, --basename <output basename>', 'Use the specified basename when exporting', '')
        .option('-i, --project-id <id>', 'Set the project id', '')
        .action(async (strings_json_file, other_json_files, options) => {
          let exitCode = 0;
          let files;
          if (other_json_files) {
            files = [strings_json_file, ...other_json_files];
          } else {
            files = [strings_json_file];
          }
          try {
            let basename = options.path;
            if (options.basename) {
              basename += options.basename;
            } else if (files.length === 1) {
              basename += `${parsePath(files[0]).name}_`;
            } else {
              basename += 'exported_';
            }
            let project = options.projectId;
            if (!project) {
              if (files.length === 1) {
                project = parsePath(files[0]).name;
              } else {
                project = 'vivocha';
              }
            }
            await exportPOFiles(files, project, options.language, options.prefix, basename, options.reference);
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.exit(exitCode);
          }
        }),
      '*': program
        .command('*', null, { noHelp: true })
        .action(() => { program.help(); })
    };

    if (config.info.scopes) {
      const scopes: Scopes = new Scopes(config.info.scopes);
      if (scopes.match('String.global')) {
        commands.push.option('-g, --global', 'Push as global strings');
        commands.pull.option('-g, --global', 'Pull a global version of the requested strings');
      }
    }

    program.parse(process.argv);
  } catch(err) {
    if (options.verbose) {
      console.error(err);
    } else {
      console.error('Failed');
    }
    process.exit(1);
  }
})();

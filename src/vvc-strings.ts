#!/usr/bin/env node

import * as fs from 'fs';
import { promisify } from 'util';
import * as program from 'commander';
import * as jsonpolice from 'jsonpolice';
import { Scopes } from 'arrest';
import { Asset, WidgetManifest, WidgetSettings, MultiLanguageString } from '@vivocha/public-entities';
import { Config, read as readConfig, meta } from './lib/config';
import { wsUrl, retriever } from './lib/ws';
import { fetchStrings, uploadStringChanges } from './lib/strings';
import { checkLoginAndVersion } from './lib/startup';

const access = promisify(fs.access);

(async () => {
  try {
    await checkLoginAndVersion();
    const config: Config = await readConfig();

    program
      .version(meta.version);

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
            let parser = await jsonpolice.create({
              "type": "array",
              "items": {"$ref": schemaUrl},
              "minItems": 2
            }, {retriever});

            for (let f of files) {
              await access(f, fs.constants.R_OK).catch(() => {
                throw "file not found";
              });

              // load strings.json
              const strings: MultiLanguageString[] = await new Promise<MultiLanguageString[]>(resolve => {
                const raw = fs.readFileSync(f).toString('utf8');
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
    console.error(err);
    process.exit(1);
  }

})();

#!/usr/bin/env node

import { Asset, MultiLanguageString, WidgetManifest } from '@vivocha/public-entities';
import { getStringsObject } from '@vivocha/public-entities/dist/wrappers/language';
import { Scopes } from 'arrest';
import * as bodyParser from 'body-parser';
import * as columnify from 'columnify';

import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import express from 'express';

import fs from 'fs/promises';
import * as http from 'http';
import * as jsonpolice from 'jsonpolice';
import _ from 'lodash';
import { open as openurl } from 'openurl';
import * as path from 'path';
import * as reload from 'reload';
import { downloadAssets, hashWidgetAssets, scanWidgetAssets, uploadWidgetAssetChanges } from './lib/assets';
import { Config, meta, read as readConfig } from './lib/config';
import { checkLoginAndVersion } from './lib/startup';
import { fetchStrings, fetchWidgetStrings, uploadWidgetStringChanges } from './lib/strings';
import { retriever, ws, wsUrl } from './lib/ws';

(async () => {
  try {
    const program = new Command();
    const options = program.opts();

    await checkLoginAndVersion();
    const config: Config = await readConfig();

    program
      .version(meta.version);

    const commands = {
      list: program
        .command('list [widget_id]')
        .description('Display a list of available widgets. If an id is specified, the command lists all versions of the widget')
        .option('-e, --engagement', 'Only list engagement widgets')
        .option('-i, --interaction', 'Only list interaction widgets')
        .option('-v, --verbose', 'Verbose output')
        .action(async (widget_id, options) => {
          try {
            if (widget_id) {
              const qs: any = {
                fields: ['id', 'type', 'version', 'draft', 'acct_id' ].join(','),
                sort: '-version'
              };
              if (options.global) {
                qs.global = true;
              }
              const data = (await ws(`widgets/${widget_id}/all`, { qs }));
              if (!data || !data.length) {
                throw 'Unknown widget';
              }
              const columns = columnify(data, {
                columns: [
                  'version', 'draft', 'acct_id'
                ],
                config: {
                  draft: {
                    dataTransform: data => data ? '✓' : ''
                  },
                  acct_id: {
                    dataTransform: data => data ? '' : '✓',
                    headingTransform: () => 'global'.toUpperCase()
                  },
                }
              });
              console.log(columns);
            } else {
              const qs: any = {
                fields: ['id', 'type', 'version', 'draft', 'acct_id' ].join(','),
                sort: 'id'
              };
              if (options.global) {
                qs.global = true;
              }
              if (options.engagement) {
                qs.q = 'eq(type,engagement)';
              }
              if (options.interaction) {
                qs.q = 'eq(type,interaction)';
              }
              const data = (await ws('widgets', { qs })).reduce((o, i) => {
                o[i.id] = i;
                return o;
              }, {});
              if (!data || !Object.keys(data).length) {
                throw 'No widgets found';
              }
              (await fetchStrings(Object.keys(data).map(w => `WIDGET.${w}.NAME`).join(','), options.global)).reduce((o, i) => {
                const id = i.id.replace(/^WIDGET\.([^\.]*)\.NAME$/, '$1');
                if (o[id] && i.values && i.values.en && i.values.en.value) {
                  o[id].name = i.values.en.value;
                }
                return o;
              }, data);
  
              const columns = columnify(Object.entries(data).map(i => i[1]), {
                columns: [
                  'id', 'type', 'version', 'draft', 'acct_id', 'name',
                ],
                config: {
                  draft: {
                    dataTransform: data => data ? '✓' : ''
                  },
                  acct_id: {
                    dataTransform: data => data ? '' : '✓',
                    headingTransform: () => 'global'.toUpperCase()
                  },
                }
              });
              console.log(columns);
            }
          } catch(e) {
            console.error(e);
            process.exit(1);
          }
        }),
      push: program
        .command('push')
        .description('Push a new version of the widget to the Vivocha servers')
        .option('-a, --activate', 'Activate the pushed widget')
        .option('-d, --directory <widget path>', 'Use the widget at the specified path', process.cwd())
        .option('-r, --rescan', 'Rescan and upload all assets')
        .action(async options => {
          const startDir = process.cwd();
          let exitCode = 0;

          try {
            // change to the widget directory
            if (options.directory !== startDir) {
              process.chdir(options.directory);
            }

            // check if manifest.json exists
            await access('./manifest.json', fs.constants.R_OK | fs.constants.W_OK).catch(() => {
              throw "manifest.json not found";
            });

            // load manifest.json
            let manifest: WidgetManifest = await new Promise<WidgetManifest>(resolve => {
              const raw = fs.readFile('./manifest.json').toString();
              resolve(JSON.parse(raw) as WidgetManifest);
            }).catch(() => {
              throw "Failed to parse manifest.json";
            });
            delete manifest.acct_id;
            delete manifest.version;
            delete manifest.draft;

            // check if record exists on server
            const oldManifest = await ws(`widgets/${manifest.id}${options.global ? '?global=true' : ''}`).then(data => {
              if (data) {
                delete data.acct_id;
                delete data.version;
                delete data.draft;
              }
              return data;
            }, (err) => {
              return null;
            });

            // check if strings.json exists
            await access('./strings.json', fs.constants.R_OK).catch(() => {
              throw "strings.json not found";
            });

            // load strings.json
            const strings: MultiLanguageString[] = await new Promise<MultiLanguageString[]>(resolve => {
              const raw = fs.readFile('./strings.json').toString();
              resolve(JSON.parse(raw) as MultiLanguageString[]);
            }).catch(() => {
              throw "Failed to parse strings.json";
            });

            // get the strings schema
            let schemaUrl = await wsUrl('schemas/string');
            let parser = await jsonpolice.create({
              "type": "array",
              "items": { "$ref": schemaUrl },
              "minItems": 2
            }, { retriever });

            // validate the strings
            await parser.validate(strings).catch(err => {
              throw `invalid format of strings.json, ${err.message} ${err.path || ''}`;
            });

            // update strings and put ids in manifest
            manifest.stringIds = await uploadWidgetStringChanges(manifest.id, strings, options.global);

            if (manifest.stringIds.indexOf('NAME') === -1) {
              throw 'NAME string missing';
            }
            if (manifest.stringIds.indexOf('DESCRIPTION') === -1) {
              throw 'DESCRIPTION string missing';
            }

            // update assets and put data in manifest
            let assets: Asset[] = await scanWidgetAssets('.').catch(err => {
              throw `failed to scan assets, ${err.message}`;
            });
            assets = await hashWidgetAssets(assets).catch(err => {
              throw `failed to hash assets, ${err.message}`;
            });
            if (manifest.assets && manifest.assets.length) {
              for (let a of manifest.assets) {
                if (a.id && ((options.global && a.id.indexOf('_/') !== 0) || (!options.global && a.id.indexOf('_/') === 0))) {
                  delete a.id;
                }
              }
            }
            await uploadWidgetAssetChanges(manifest.id, !options.rescan && Array.isArray(manifest.assets) ? manifest.assets : [], assets, options.global).catch(err => {
              throw `failed to upload assets, ${err.message}`;
            });

            manifest.assets = assets;

            let a = manifest.assets.find(i => i.path === 'main.html');
            if (!a) {
              throw 'no main.html in the assets';
            } else {
              manifest.htmlId = a.id;
            }

            a = manifest.assets.find(i => i.path === 'main.scss');
            if (!a) {
              throw 'no main.scss in the assets';
            } else {
              manifest.scssId = a.id;
            }

            a = manifest.assets.find(i => i.path === 'thumbnail.png');
            if (a) {
              manifest.thumbnailId = a.id;
            } else {
              delete manifest.thumbnailId;
            }

            // parse manifest with schema
            schemaUrl = await wsUrl('schemas/widget_create');
            parser = await jsonpolice.create(schemaUrl, { retriever });

            // validate the strings
            await parser.validate(manifest).catch(err => {
              throw `invalid format of manifest.json, ${err.message} ${err.path || ''}`;
            });

            if (!oldManifest) { // create new
              console.log('uploading manifest.json');
              const newManifest = await ws(`widgets${options.global ? '?global=true' : ''}`, {
                method: 'POST',
                body: manifest
              }).catch(err => {
                throw `failed to upload manifest.json, ${err.message}`;
              });
              console.log(`created first ${newManifest.draft ? 'draft' : 'version'}`);
            } else if (!_.isEqual(oldManifest, manifest)) { // update server record
              console.log('uploading manifest.json');
              const newManifest = await ws(`widgets/${manifest.id}${options.global ? '?global=true' : ''}`, {
                method: 'PUT',
                body: manifest
              }).catch(err => {
                throw `failed to upload manifest.json, ${err.message || err.name}`;
              });
              console.log(`saved version ${newManifest.version} ${newManifest.draft ? 'draft' : ''}`);
            }

            if (options.activate) {
              console.log('activating the new version');
              await ws(`widgets/${manifest.id}/activate${options.global ? '?global=true' : ''}`, {
                method: 'POST'
              }).catch(err => {
                throw `failed to activate the widget, ${err.message || err.name}`;
              });
            }

            // update local manifest
            fs.writeFileSync('./manifest.json', JSON.stringify(manifest, null, 2));
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.chdir(startDir);
            process.exit(exitCode);
          }
        }),
      pull: program
        .command('pull <widget_id> [version]')
        .description('Pull a version of the widget from the Vivocha servers')
        .option('-d, --directory <widget path>', 'Pull the widget into the specified path')
        .option('-k, --keep-original-id', 'If the requested widget is global, do not add the suffix -custom to the pulled widget')
        .option('-v, --verbose', 'Verbose output')
        .action(async (widget_id, version, options) => {
          const startDir = process.cwd();
          let exitCode = 0;
          let curr_widget_id = widget_id;

          try {
            // get the manifest
            const manifest = await ws(`widgets/${widget_id}${version ? '/' + version : ''}${options.global ? '?global=true' : ''}`).catch(() => {
              throw `Failed to download ${version ? 'the request version of ' : ''}widget ${widget_id}`;
            });
            if (!manifest) {
              throw 'Unknown widget';
            }
            if (!manifest.acct_id && !options.keepOriginalId) {
              curr_widget_id += '-custom';
              manifest.id = curr_widget_id;
            }
            delete manifest.acct_id;
            delete manifest.version;
            delete manifest.draft;

            // check that the destination dir does not exist
            const widgetDir = options.directory || `./${curr_widget_id}`;
            await access(widgetDir).then(() => {
              throw 'Destination path already exists';
            }, () => {});

            // create the destination dir and move into it
            await fs.mkdir(widgetDir, { recursive: true }, () => {
              throw `Cannot create directory ${widgetDir}`;
            });
            process.chdir(widgetDir);

            // download and write the strings
            console.log(`Downloading strings.json`);
            const strings = await fetchWidgetStrings(widget_id, options.global).catch(() => {
              throw 'Failed to download the strings';
            });
            await writeFile('./strings.json', JSON.stringify(strings, null, 2), 'utf8').catch(() => {
              throw 'Failed to write the strings';
            });

            await downloadAssets(manifest.assets);

            // write the manifest
            await writeFile('./manifest.json', JSON.stringify(manifest, null, 2), 'utf8').catch(() => {
              throw 'Failed to write the manifest';
            });

            console.log(`Widget successfully pulled into directory ${widgetDir}`);

          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.chdir(startDir);
            process.exit(exitCode);
          }
        }),
      delete: program
        .command('delete <widget_id>')
        .description('Permanently delete all versions of a widget')
        .option('-y, --yes', 'Do not ask for confirmation')
        .option('-v, --verbose', 'Verbose output')
        .action(async (widget_id, options) => {
          const startDir = process.cwd();
          let exitCode = 0;

          try {
            const proceed: boolean = options.yes || await confirm({
              default: false,
              message: 'WARNING: this operation is irreversible: are you sure you want to proceed?'
            });

            if (proceed) {
              await ws(`widgets/${widget_id}${options.global ? '?global=true' : ''}`, { method: 'DELETE' }).catch(() => {
                throw `Failed to remove all version of widget ${widget_id}`;
              });
              console.log(`Widget successfully removed`);
            }
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.chdir(startDir);
            process.exit(exitCode);
          }
        }),
      activate: program
        .command('activate')
        .description('Publish a draft as a new production version')
        .option('-d, --directory <widget path>', 'Use the widget at the specified path', process.cwd())
        .action(async options => {
          const startDir = process.cwd();
          let exitCode = 0;

          try {
            // change to the widget directory
            if (options.directory !== startDir) {
              process.chdir(options.directory);
            }

            // check if manifest.json exists
            await access('./manifest.json', fs.constants.R_OK | fs.constants.W_OK).catch(() => {
              throw "manifest.json not found";
            });

            // load manifest.json
            let manifest: WidgetManifest = await new Promise<WidgetManifest>(resolve => {
              const raw = fs.readFile('./manifest.json').toString();
              resolve(JSON.parse(raw) as WidgetManifest);
            }).catch(() => {
              throw "Failed to parse manifest.json";
            });

            await ws(`widgets/${manifest.id}/activate${options.global ? '?global=true' : ''}`, {
              method: 'POST'
            }).catch(err => {
              throw `failed to activate the widget, ${err.message || err.name}`;
            });
          } catch(e) {
            console.error(e);
            exitCode = 1;
          } finally {
            process.chdir(startDir);
            process.exit(exitCode);
          }
        }),
      server: program
        .command('server')
        .description('Start a development server to test the widget on the local machine')
        .option('-p, --port <port>', 'Server port, default 8085', '8085')
        .option('-h, --host <host>', 'Server host, default localhost', 'localhost')
        .option('-n, --no-open', 'Do not attempt to open the test app on a browser')
        .option('-w, --watch', 'Automatically reload the page if any file change is detected')
        .action(async options => {
          const startDir = process.cwd();

          try {
            const manifest: WidgetManifest = JSON.parse(fs.readFile(path.join(startDir, 'manifest.json')).toString());

            if (manifest.type !== 'engagement') {
              throw 'Server mode only supports engagement widgets';
            }

            // update assets and put data in manifest
            let assets: Asset[] = await scanWidgetAssets('.').catch(err => {
              throw `failed to scan assets, ${err.message}`;
            });
            assets = await hashWidgetAssets(assets).catch(err => {
              throw `failed to hash assets, ${err.message}`;
            });
            if (manifest.assets && manifest.assets.length) {
              for (let a of manifest.assets) {
                if (a.id && ((options.global && a.id.indexOf('_/') !== 0) || (!options.global && a.id.indexOf('_/') === 0))) {
                  delete a.id;
                }
              }
            }

            manifest.assets = assets;

            for (let a of manifest.assets) {
              if (!a.id) {
                a.id = a.hash
              }
            }

            let a = manifest.assets.find(i => i.path === 'main.html');
            if (!a) {
              throw 'no main.html in the assets';
            } else {
              manifest.htmlId = a.id;
            }

            a = manifest.assets.find(i => i.path === 'main.scss');
            if (!a) {
              throw 'no main.scss in the assets';
            } else {
              manifest.scssId = a.id;
            }

            a = manifest.assets.find(i => i.path === 'thumbnail.png');
            if (a) {
              manifest.thumbnailId = a.id;
            } else {
              delete manifest.thumbnailId;
            }

            const app = express();
            app.set('port', options.port);
            app.set('host', options.host);
            app.use(bodyParser.json());
            app.use(express.static(path.join(__dirname, '../app')));
            app.use('/main.html', express.static(path.join(startDir, 'main.html')));
            app.use('/main.scss', express.static(path.join(startDir, 'main.scss')));
            app.use('/assets', express.static(path.join(startDir, 'assets')));
            app.get('/widget', async (req, res) => {
              let settings: any;
              try {
                settings = JSON.parse(fs.readFile(path.join(startDir, 'settings.json')).toString())
              } catch(e) {
                settings = {
                  templateId: manifest.id,
                  variables: (manifest.variables || []).reduce((o, i) => {
                    if (typeof i.defaultValue !== 'undefined') {
                      o[i.id] = i.defaultValue;
                    }
                    return o;
                  }, {}),
                  requestedLanguage: 'en',
                  defaultLanguage: 'en'
                };
                fs.writeFile(path.join(startDir, 'settings.json'), JSON.stringify(settings, null, 2));
              }

              const requestedLanguage = settings.requestedLanguage || 'en';
              const defaultLanguage = settings.defaultLanguage || requestedLanguage || 'en';
              delete settings.requestedLanguage;
              delete settings.defaultLanguage;

              const strings: any = getStringsObject(JSON.parse(fs.readFile(path.join(startDir, 'strings.json')).toString()), requestedLanguage, defaultLanguage);

              res.json({
                id: '' + +new Date(),
                manifest,
                settings,
                strings,
                requestedLanguage,
                defaultLanguage,
                assetsBaseUrl: '/'
              });
            });

            const server = http.createServer(app);
            const reloader = reload(app);
            const serverUrl = `http://${options.host}:${options.port}`;
            console.log(`starting debug server at ${serverUrl}`);
            server.listen(options.port, options.host);

            if (options.watch) {
              fs.watch(startDir, (event, filename) => {
                reloader.reload();
              });
            }

            if (options.open !== false) {
              openurl(serverUrl);
            }

            process.on('SIGTERM', () => {
              process.exit(0);
            });
            process.on('SIGINT', () => {
              process.exit(0);
            });
          } catch(e) {
            console.error(e);
            process.exit(1);
          }
        }),
      '*': program
        .command('*', null, { noHelp: true })
        .action(() => { program.help(); })
    };

    if (config.info.scopes) {
      const scopes: Scopes = new Scopes(config.info.scopes);
      if (scopes.match('Widget.global')) {
        commands.list.option('-g, --global', 'List only global widgets');
        commands.push.option('-g, --global', 'Push as global widget');
        commands.pull.option('-g, --global', 'Pull a global version of the requested widget');
        commands.activate.option('-g, --global', 'Activate a global widget');
        commands.delete.option('-g, --global', 'Delete a global widget');
      }
    }

    program.parse(process.argv);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }
})();

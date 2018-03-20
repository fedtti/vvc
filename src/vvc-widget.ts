#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { promisify } from 'util';
import * as _ from 'lodash';
import * as program from 'commander';
import * as _mkdirp from 'mkdirp';
import * as jsonpolice from 'jsonpolice';
import * as express from 'express';
import * as bodyParser from 'body-parser';
import { Scopes } from 'arrest';
import * as reload from 'reload';
import { open as openurl } from 'openurl';
import * as watch from 'watch';
import * as columnify from 'columnify';
import { Asset, WidgetManifest, WidgetSettings, MultiLanguageString } from '@vivocha/public-entities';
import { getStringsObject } from '@vivocha/public-entities/dist/wrappers/language';
import { Config, read as readConfig, meta } from './lib/config';
import { ws, wsUrl, retriever } from './lib/ws';
import { fetchStrings, fetchWidgetStrings, uploadWidgetStringChanges } from './lib/strings';
import { downloadAssets, scanWidgetAssets, hashWidgetAssets, uploadWidgetAssetChanges } from './lib/assets';
import { checkLoginAndVersion } from './lib/startup';

const access = promisify(fs.access);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(_mkdirp);

(async () => {
  try {
    await checkLoginAndVersion();
    const config: Config = await readConfig();

    program
      .version(meta.version);

    const commands = {
      list: program
        .command('list')
        .description('Display a list of available widgets')
        .option('-e, --engagement', 'Only list engagement widgets')
        .option('-i, --interaction', 'Only list interaction widgets')
        .action(async options => {
          try {
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
          } catch(e) {
            console.error(e);
            process.exit(1);
          }
        }),
      /*
      init: program
        .command('init')
        .description('Create a new widget')
        .action(async options => {
          try {
            process.exit(0);
          } catch(e) {
            console.error(e);
            process.exit(1);
          }
        }),
      */
      push: program
        .command('push')
        .description('Push a new version of the widget to the Vivocha servers')
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
              const raw = fs.readFileSync('./manifest.json').toString('utf8');
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
              const raw = fs.readFileSync('./strings.json').toString('utf8');
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
              throw `failed to scan aseets, ${err.message}`;
            });
            assets = await hashWidgetAssets(assets).catch(err => {
              throw `failed to hash assets, ${err.message}`;
            });
            await uploadWidgetAssetChanges(manifest.id, Array.isArray(manifest.assets) ? manifest.assets : [], assets, options.global).catch(err => {
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
        .command('pull <widget_id>')
        .description('Pull a version of the widget from the Vivocha servers')
        .option('-d, --directory <widget path>', 'Pull the widget into the specified path')
        .option('-v, --ver <widget version>', 'Pull the specified version')
        .action(async (widget_id, options) => {
          const startDir = process.cwd();
          let exitCode = 0;

          try {
            // get the manifest
            const manifest = await ws(`widgets/${widget_id}${options.ver ? '/' + options.ver : ''}${options.global ? '?global=true' : ''}`).catch(() => {
              throw `Failed to download ${options.ver ? 'the request version of ' : ''}widget ${widget_id}`;
            });
            delete manifest.acct_id;
            delete manifest.version;
            delete manifest.draft;

            // check that the destination dir does not exist
            const widgetDir = options.directory || `./${widget_id}`;
            await access(widgetDir).then(() => {
              throw 'Destination path already exists';
            }, () => {});

            // create the destination dir and move into it
            await mkdirp(widgetDir).catch(() => {
              throw `Cannot create directory ${widgetDir}`;
            });
            process.chdir(widgetDir);

            // download and write the strings
            const strings = await fetchWidgetStrings(widget_id, options.global).catch(() => {
              throw 'Failed to download the strings';
            });
            await writeFile('./strings.json', JSON.stringify(strings, null, 2), 'utf8').catch(() => {
              throw 'Failed to write the strings';
            });

            await downloadAssets(manifest.assets);

            // write the manifest
            delete manifest.assets;
            delete manifest.stringIds;
            delete manifest.htmlId;
            delete manifest.scssId;
            delete manifest.thumbnailId;
            await writeFile('./manifest.json', JSON.stringify(manifest, null, 2), 'utf8').catch(() => {
              throw 'Failed to write the manifest';
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
        .option('-p, --port <port>', 'Server port, default 8085', 8085)
        .option('-h, --host <host>', 'Server host, default localhost', 'localhost')
        .option('-n, --no-open', 'Do not attempt to open the test app on a browser')
        .option('-w, --watch', 'Automatically reload the page if any file change is detected')
        .action(async options => {
          const startDir = process.cwd();

          try {
            const manifest: WidgetManifest = JSON.parse(fs.readFileSync(path.join(startDir, 'manifest.json')).toString('utf8'));

            if (manifest.type !== 'engagement') {
              throw 'Server mode only supports engagement widgets';
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
              let settings: WidgetSettings;
              try {
                settings = JSON.parse(fs.readFileSync(path.join(startDir, 'settings.json')).toString('utf8'))
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
                fs.writeFileSync(path.join(startDir, 'settings.json'), JSON.stringify(settings, null, 2));
              }

              const requestedLanguage = settings.requestedLanguage || 'en';
              const defaultLanguage = settings.defaultLanguage || requestedLanguage || 'en';
              delete settings.requestedLanguage;
              delete settings.defaultLanguage;

              const strings: any = getStringsObject(JSON.parse(fs.readFileSync(path.join(startDir, 'strings.json')).toString('utf8')), requestedLanguage, defaultLanguage);

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
              const filterRegExp: RegExp = new RegExp(`^${startDir}/(assets|main.html$|main.scss$|manifest.json$|strings.json$|settings.json$)`);
              watch.watchTree(startDir, {
                ignoreDotFiles: true,
                filter: f => filterRegExp.test(f)
              }, (f, curr, prev) => {
                if (curr && prev) {
                  reloader.reload();
                }
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
      }
    }

    program.parse(process.argv);
  } catch(err) {
    console.error(err);
    process.exit(1);
  }

})();

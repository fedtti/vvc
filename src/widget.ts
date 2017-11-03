#!/usr/bin/env node

import * as fs from 'fs';
import { promisify } from 'util';
import * as _ from 'lodash';
import * as program from 'commander';
import * as _mkdirp from 'mkdirp';
import * as jsonpolice from 'jsonpolice';
import { Asset, WidgetManifest, MultiLanguageString } from '@vivocha/public-entities';
import { Config, read as readConfig, meta } from './lib/config';
import { ws, wsUrl, retriever } from './lib/ws';
import { fetchWidgetStrings, uploadWidgetStringChanges } from './lib/strings';
import { downloadAssets, scanWidgetAssets, hashWidgetAssets, uploadWidgetAssetChanges } from './lib/assets';
import { checkLoginAndVersion } from './lib/startup';

const access = promisify(fs.access);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(_mkdirp);

program
  .version(meta.version);

program
  .command('init')
  .description('Create a new widget')
  .action(async options => {
    try {
      const config: Config = await readConfig();
      process.exit(0);
    } catch(e) {
      console.error(e);
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Push a new version of the widget to the Vivocha servers')
  .option('-d, --directory <widget path>', 'Use the widget at the specified path', process.cwd())
  .action(async options => {
    const startDir = process.cwd();
    let exitCode = 0;

    try {
      await checkLoginAndVersion();

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
      const oldManifest = await ws(`widgets/${manifest.id}`).catch((err) => {
        throw "Failed to get the current version of the Widget";
      });
      delete oldManifest.acct_id;
      delete oldManifest.version;
      delete oldManifest.draft;

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
      manifest.stringIds = await uploadWidgetStringChanges(manifest.id, strings);

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
      await uploadWidgetAssetChanges(manifest.id, Array.isArray(manifest.assets) ? manifest.assets : [], assets).catch(err => {
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

      // update server record
      if (!_.isEqual(oldManifest, manifest)) {
        console.log('uploading manifest.json');
        const newManifest = await ws(`widgets/${manifest.id}`, {
          method: 'PUT',
          body: manifest
        }).catch(err => {
          throw `failed to upload manifest.json, ${err.message}`;
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
  });

program
  .command('pull <widget_id>')
  .description('Pull a version of the widget from the Vivocha servers')
  .option('-d, --directory <widget path>', 'Pull the widget into the specified path')
  .option('-v, --ver <widget version>', 'Pull the specified version')
  .action(async options => {
    const startDir = process.cwd();
    let exitCode = 0;

    try {
      await checkLoginAndVersion();

      // get the manifest
      const manifest = await ws(`widgets/${options.widget_id}${options.ver ? '/' + options.ver : ''}`).catch(() => {
        throw `Failed to download ${options.ver ? 'the request version of ' : ''}widget ${options.widget_id}`;
      });
      delete manifest.acct_id;
      delete manifest.version;
      delete manifest.draft;

      // check that the destination dir does not exist
      const widgetDir = options.directory || `./${options.widget_id}`;
      await access(widgetDir).then(() => {
        throw 'Destination path already exists';
      }, () => {});

      // create the destination dir and move into it
      await mkdirp(widgetDir).catch(() => {
        throw `Cannot create directory ${widgetDir}`;
      });
      process.chdir(widgetDir);

      // write the manifest
      await writeFile('./manifest.json', JSON.stringify(manifest, null, 2), 'utf8').catch(() => {
        throw 'Failed to write the manifest';
      });

      // download and write the strings
      const strings = await fetchWidgetStrings(options.widget_id).catch(() => {
        throw 'Failed to download the strings';
      });
      await writeFile('./strings.json', JSON.stringify(strings, null, 2), 'utf8').catch(() => {
        throw 'Failed to write the strings';
      });

      await downloadAssets(manifest.assets);

    } catch(e) {
      console.error(e);
      exitCode = 1;
    } finally {
      process.chdir(startDir);
      process.exit(exitCode);
    }
  });

program.parse(process.argv);

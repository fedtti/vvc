#!/usr/bin/env node

import * as fs from 'fs';
import { promisify } from 'util';
import * as program from 'commander';
import * as _mkdirp from 'mkdirp';
import { meta } from './lib/config';
import { ws } from './lib/ws';
import { fetchWidgetStrings } from './lib/strings';
import { downloadAssets } from './lib/assets';
import { checkLoginAndVersion } from './lib/startup';

const access = promisify(fs.access);
const writeFile = promisify(fs.writeFile);
const mkdirp = promisify(_mkdirp);

program
  .version(meta.version)
  .usage('[options] <widget id>')
  .option('-d, --directory <widget path>', 'Pull the widget into the specified path')
  .option('-v, --ver <widget version>', 'Pull the specified version')
  .parse(process.argv);

(async () => {
  const startDir = process.cwd();
  let exitCode = 0;

  try {
    await checkLoginAndVersion();

    if (typeof program.args[0] === 'undefined') {
      throw program.help();
    }
    const widgetId = program.args[0];

    // get the manifest
    const manifest = await ws(`widgets/${widgetId}${program.ver ? '/' + program.ver : ''}`).catch(() => {
      throw `Failed to download ${program.ver ? 'the request version of ' : ''}widget ${widgetId}`;
    });
    delete manifest.acct_id;
    delete manifest.version;
    delete manifest.draft;

    // check that the destination dir does not exist
    const widgetDir = program.directory || `./${widgetId}`;
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
    const strings = await fetchWidgetStrings(widgetId).catch(() => {
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
})();

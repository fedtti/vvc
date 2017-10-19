#!/usr/bin/env node

import * as program from 'commander';

const meta = require(__dirname + '/../package.json');

program
  .version(meta.version)
  .command('init', 'Create a new widget')
  .command('push', 'Push a new version of the widget to the Vivocha servers')
  .parse(process.argv);

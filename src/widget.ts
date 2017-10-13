#!/usr/bin/env node

import * as program from 'commander';

const meta = require(__dirname + '/../package.json');

program
  .version(meta.version)
  .command('init', 'Create a new widget')
  .parse(process.argv);

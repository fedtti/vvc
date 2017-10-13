#!/usr/bin/env node

import * as program from 'commander';

const meta = require(__dirname + '/../package.json');

program
  .version(meta.version)
  .description(meta.description)
  .command('login', 'Login to you Vivocha account')
  .command('widget', 'Manage engagement widgets')
  .parse(process.argv);
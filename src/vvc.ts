#!/usr/bin/env node

import { Command } from 'commander';
import { meta } from './lib/config.js';

const program = new Command();

program.name(meta.name);
program.version(meta.version);
program.description(meta.description);
program
  .command('login', 'Login to your Vivocha account')
  .command('info', 'Print information on the currently logged-in user')
  .command('logout', 'Logout from your Vivocha account')
  .command('widget', 'Manage engagement widgets')
  .command('strings', 'Manage translation strings')
  .parse(process.argv);

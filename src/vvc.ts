#!/usr/bin/env node

import { Command } from 'commander';
import { meta } from './lib/config.js';

const program = new Command();

program
  // .name(meta.name)
  // .version(meta.version)
  // .description(meta.description)
  .command('info', 'Print information on the currently logged-in user')
  .command('login', 'Login to your Vivocha account')
  .command('logout', 'Logout from your Vivocha account')
  .command('strings', 'Manage translation strings')
  .command('widget', 'Manage engagement widgets')
  .parse(process.argv);

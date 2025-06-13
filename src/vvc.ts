#!/usr/bin/env node

import { Command } from 'commander';
import { meta } from './lib/config'; // To be renamed to 'Meta'.

const program = new Command();

program
  .name(meta.name)
  .description(meta.description)
  .version(meta.version);

program
  .command('info', 'Print info on the currently logged in user')
  .command('login', 'Login to you Vivocha account')
  .command('logout', 'Logout from your Vivocha account')
  .command('widget', 'Manage engagement widgets')
  .command('strings', 'Manage translation strings')
  .parse(process.argv);
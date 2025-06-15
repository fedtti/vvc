#!/usr/bin/env node

import { Command } from 'commander';

import { meta } from './lib/config'; // TODO: Rename to 'Meta'.

const program = new Command();

program
  .name(meta.name)
  .description(meta.description)
  .version(meta.version);

program
  .command('login', 'Login to your Vivocha account')
  .command('info', 'Print information on the currently logged-in user')
  .command('logout', 'Logout from your Vivocha account')
  .command('widget', 'Manage engagement widgets')
  .command('strings', 'Manage translation strings')
  .parse(process.argv);
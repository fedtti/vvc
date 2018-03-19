#!/usr/bin/env node

import * as program from 'commander';
import { meta } from './lib/config';

program
  .version(meta.version)
  .description(meta.description)
  .command('login', 'Login to you Vivocha account')
  .command('widget', 'Manage engagement widgets')
  .command('strings', 'Manage translation strings')
  .parse(process.argv);
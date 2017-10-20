#!/usr/bin/env node

import * as program from 'commander';
import { meta } from './lib/config';

(async () => {
  program
    .version(meta.version)
    .command('init', 'Create a new widget')
    .command('push', 'Push a new version of the widget to the Vivocha servers')
    .command('pull', 'Pull a version of the widget from the Vivocha servers')
    .parse(process.argv);
})();

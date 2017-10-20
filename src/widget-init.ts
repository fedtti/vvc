#!/usr/bin/env node

import * as program from 'commander';
import * as request from 'request';
import { Config, read as readConfig, meta } from './lib/config';

program
  .version(meta.version)
  .parse(process.argv);

(async () => {
  try {
    const config: Config = await readConfig();
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
})();

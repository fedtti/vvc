#!/usr/bin/env node

import { Command } from 'commander';
import { meta, read as readConfig } from './lib/config.js';
import { checkVersion } from './lib/startup.js';
import type { Config } from './lib/config.d.js';

const program = new Command();
const options = program.opts();

program
  // .version(meta.version)
  .option('-v, --verbose', '')
  .parse(process.argv);

(async (): Promise<void> => {
  try {
    // await checkVersion();
    const config: Config = await readConfig();
    if (!!config) {
      console.info(`Currently logged in to account ${config.account} on ${config.server}.`);
      process.exit(0);
    }
  } catch (error) {
    if (!!options.verbose) {
      console.error(error.message);
    } else {
      console.error(error);
    }
    process.exit(1);
  }
})();

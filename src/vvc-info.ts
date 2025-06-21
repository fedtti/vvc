#!/usr/bin/env node

import { Command } from 'commander';
import { meta, read as readConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';

(async (): Promise<void> => {
  const program = new Command();
  const options = program.opts();

  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output') // TODO: Give a better description.
      .parse(process.argv);
  
    await checkLoginAndVvcVersion();
    const config: Config = await readConfig();

    console.info(`Currently logged in to account ${config.account} on world ${config.server}.`);

    if (options.verbose) {
      console.log(`Server info: ${JSON.stringify(config.info, null, 2)}`);
    }
    process.exit(0);
  } catch (error) {
    if (error === 'Not logged in' || error.toString().match(/^Config file not found/)) {
      console.log('Not logged in');
    } else if (options.verbose) {
      console.error(error.message);
    } else {
      console.error('Failed');
    }
    process.exit(1);
  }
})();

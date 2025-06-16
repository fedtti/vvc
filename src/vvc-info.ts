#!/usr/bin/env node

import { Command } from 'commander';
import { type Config, meta, read as readConfig } from './lib/config.js';
import { checkLoginAndVersion } from './lib/startup.js';

(async () => {
  const program = new Command();
  const options = program.opts();

  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output') // TODO: Give a better description.
      .parse(process.argv);
  
    await checkLoginAndVersion();
    const config: Config = await readConfig();

    console.log(`Currently logged in to account ${config.accountId} on world ${config.server}.`);

    if (options.verbose) {
      console.log(`Server info: ${JSON.stringify(config.info, null, 2)}`);
    }

    process.exit(0);
  } catch(error) {
    if (error === 'Not logged in' || error.toString().match(/^Config file not found/)) {
      console.log('Not logged in');
    } else if (options.verbose) {
      console.error(error);
    } else {
      console.error('Failed');
    }
    process.exit(1);
  }
})();

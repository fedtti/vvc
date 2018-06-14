#!/usr/bin/env node

import * as program from 'commander';
import { Config, meta, read as readConfig } from './lib/config';
import { checkLoginAndVersion } from './lib/startup';

(async () => {
  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output')
      .parse(process.argv);
  
    await checkLoginAndVersion();
    const config: Config = await readConfig();

    console.log(`Currently logged in to account ${config.acct_id} on world ${config.server}`);
    if (program.verbose) {
      console.log(`Server info: ${JSON.stringify(config.info, null, 2)}`);
    }
    process.exit(0);
  } catch(e) {
    if (e === 'Not logged in' || e.toString().match(/^Config file not found/)) {
      console.log('Not logged in');
    } else if (program.verbose) {
      console.error(e);
    } else {
      console.error('Failed');
    }
    process.exit(1);
  }
})();

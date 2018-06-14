#!/usr/bin/env node

import * as program from 'commander';
import { Config, meta, read as readConfig, unlink as unlinkConfig } from './lib/config';
import { checkLoginAndVersion } from './lib/startup';
import { ws } from './lib/ws';

(async () => {
  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output')
      .parse(process.argv);
  
    await checkLoginAndVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.user_id}`, { method: 'DELETE' });
    await unlinkConfig();
    console.log('Logged out');
    process.exit(0);
  } catch(e) {
    if (program.verbose) {
      console.error(e);
    }
    unlinkConfig().then(() => {
      console.log('Logged out');
      process.exit(0);
    }, err => {
      console.error('Logout failed');
      process.exit(1);
    });
  }
})();

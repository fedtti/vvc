#!/usr/bin/env node

import { Command } from 'commander';
import { type Config, meta, read as readConfig, unlink as unlinkConfig } from './lib/config.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';
import { ws } from './lib/ws.js';

(async () => {
  const program = new Command();
  const options = program.opts();

  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output')
      .parse(process.argv);
  
    await checkLoginAndVvcVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.userId}`, { method: 'DELETE' });
    await unlinkConfig();
    console.log('Logged out');
    process.exit(0);
  } catch(e) {
    if (options.verbose) {
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

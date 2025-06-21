#!/usr/bin/env node

import { Command } from 'commander';
import { meta, read as readConfig, unlink as unlinkConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';
import { ws } from './lib/ws.js';

(async (): Promise<void> => {
  const program = new Command();
  const options = program.opts();

  try {
    program
      .version(meta.version)
      .option('-v, --verbose', 'Verbose output')
      .parse(process.argv);
  
    await checkLoginAndVvcVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.username}`, { method: 'DELETE' });
    await unlinkConfig();
    console.log('Logged out');
    process.exit(0);
  } catch(error) {
    if (options.verbose) {
      console.error(error.message);
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

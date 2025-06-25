#!/usr/bin/env node

import { confirm as inputConfirm } from '@inquirer/prompts';
import { Command } from 'commander';
import { meta, read as readConfig, unlink as unlinkConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkVersion } from './lib/startup.js';
import { ws } from './lib/ws.js';

const program = new Command();
const options = program.opts();

program
  // .version(meta.version)
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

(async (): Promise<void> => {
  try {
    // await checkVersion();
    const config: Config = await readConfig();

    const confirm: boolean = await inputConfirm({
      message: `You are logged in to account ${config.account}. Do you really want to log out?`,
      default: false
    });

    if (!!confirm) {
      await ws(`clients/${config.username}`, { method: 'DELETE' });
      await unlinkConfig();
      console.info('Logged out.');
      process.exit(0);
    } else {
      console.info('\nLogout cancelled.');
      process.exit(0);
    }
  } catch(error) {
    if (options.verbose) {
      console.error(error.message);
    }

    try {
      await unlinkConfig();
      console.info('\nLogged out.');
      process.exit(0);
    } catch (error) {
      console.error('\nLogout failed.');
      process.exit(1);
    }
  }
})();

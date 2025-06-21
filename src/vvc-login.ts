#!/usr/bin/env node

import { Command } from 'commander';
import { input, password as inputPassword } from '@inquirer/prompts';
import { meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';
import { ws } from './lib/ws.js';

const program = new Command();
const options = program.opts();

program
  // .version(meta.version)
  .option('-s, --server [FQDN]', '') // TODO: @fedtti - Add a description.
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

const checkAccount = async (account: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.vivocha.com/a/${account}/api/v3/openapi.json`, { method: 'HEAD' });
    return response.ok;
  } catch (error) {
    throw new Error(error.message);
  }
};

const getServer = async (account: string): Promise<string> => {
  try {
    const response = await fetch(`https://www.vivocha.com/a/${account}/api/v3/openapi.json`, { method: 'HEAD'});
    if (response.status !== 302 || !response.headers.get('Location')) {
      console.error('Invalid account.'); // TODO: Write a better error message.
      throw new Error('Invalid account.');
    } else { 
      const url = new URL(Array.isArray(response.headers.get('Location')) ? response.headers.get('Location')[0] as string : response.headers.get('Location') as string);
      return url.host;
    }
  } catch (error) {

  }
};

const getClient = async (server: string, account: string, username: string, password: string): Promise<string> => {
  try {
    const response = await fetch(`https://${server}/a/${account}/api/v3/clients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
      },
      body: JSON.stringify({
        scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli', 'Client.remove' ],
        user_id: username
      })
    });
    if (!response.ok || response.status !== 201) {
      console.error('Login failed.'); // TODO: Write a better error message.
      throw new Error('Login failed.');
    }
    const data = await response.json();
    return data;
  } catch (error) {

  }
}

/**
 * Checks if the user is logged in and if the VVC version is compatible.
 * @returns {Promise<void>} - Resolves if the user is logged in and the version is compatible, rejects otherwise.
 */
(async (): Promise<void> => {
  try {
    // try {
    //   await checkLoginAndVvcVersion();
    //   const config: Config = await readConfig();
    //   await ws(`clients/${config.username}`, { method: 'DELETE' });
    //   await unlinkConfig();
    // } catch (error) {
    //   console.error(); // TODO
    //   throw new Error(error.message);
    // }

    let account: string;

    if (!options.server) {
      account = await input({
        message: 'Account ID',
        required: true,
        validate: checkAccount
      });
    }

    const username: string = await input({
      message: 'Username',
      required: true,
    });

    const password: string = await inputPassword({
      message: 'Password',
      // mask: true
    });

    const server: string = options.server || await getServer(account);
    const client: any = await getClient(server, account, username, password);
    const config: Config = await readConfig().catch(() => { return {} as Config });
          config.server = server || 'www.vivocha.com';
          config.account = account;
          config.username = client.id;
          config.password = client.secret;
    await writeConfig(config);
    console.info('Logged in.');
    process.exit(0);
  } catch(error) {
    if (options.verbose) {
      console.error(error.message);
      throw new Error(error.message);
    }
    console.error('Login failed.');
    process.exit(1);
  }
})();

#!/usr/bin/env node

import { input, confirm as inputConfirm, password as inputPassword } from '@inquirer/prompts';
import { Command } from 'commander';
import { meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config.js';
import { checkVersion } from './lib/startup.js';
import type { Config } from './lib/config.d.js';
import type { Client } from './vvc-login.d.js';

const program = new Command();
const options = program.opts();

program
  // .version(meta.version)
  .option('-s, --server [FQDN]', '')
  .option('-v, --verbose', '')
  .parse(process.argv);

/**
 * Fetches the server FQDN for a given account ID by making a HEAD request to the Vivocha API.
 * If the account is invalid or the server cannot be reached, it logs an error and exits the process. 
 * @param {string} account - The account ID to check.
 * @returns {Promise<string>} - Returns the server FQDN for the given account.
 * @throws {Error} - Throws an error if the account is invalid or the server cannot be reached.
 */
const getServer = async (account: string): Promise<string> => {
  try {
    const response = await fetch(`https://www.vivocha.com/a/${account}/api/v3/openapi.json`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    if (response.status !== 200 && response.status !== 302 && response.status !== 307 || !response.headers.get('Location')) {
      console.error(`\nInvalid account: ${account}.`);
      process.exit(1);
    } else { 
      const url = new URL(Array.isArray(response.headers.get('Location')) ? response.headers.get('Location')[0] as string : response.headers.get('Location') as string);
      return url.host;
    }
  } catch (error) {
    if (!!options.verbose) {
      console.error(`\nError in reaching the server, impossible to check the validity of: ${account}.`);
    } else {
      console.error(`\nInvalid account: ${account}.`);
    }
    process.exit(1);
  }
};

const getClient = async (server: string, account: string, username: string, password: string): Promise<Client> => {
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
      if (!!options.verbose) {
        const data = await response.json();
        console.error(`\n${data.info}.`);
        process.exit(1);
      }
      console.error(`\nLogin failed.`);
      process.exit(1);
    }
    const data = await response.json();
    return data;
  } catch (error) {

    console.error(`\nLogin failed.`);
    process.exit(1);
  }
}

(async (): Promise<void> => {
  const oldConfig: Config = await readConfig(true, false);

  if (!!oldConfig) {
    // await checkVersion();

    const confirm: boolean = await inputConfirm({
      message: `You are already logged in on ${oldConfig.account}. Do you want to log out?`,
      default: false
    });

    if (!!confirm) {
      await unlinkConfig();
    } else {
      console.info('Login cancelled.');
      process.exit(0);
    }
  }

  try {
    let account: string;

    if (!options.server) {
      account = await input({
        message: 'Account ID',
        required: true,
        validate: string => !!string
      });
    }

    const username: string = await input({
      message: 'Username',
      required: true,
      validate: string => !!string
    });

    const password: string = await inputPassword({
      message: 'Password',
      // mask: true,
      validate: string => !!string
    });

    const server: string = options.server || await getServer(account);
    const client: Client = await getClient(server, account, username, password);
    const config: Config = {
      server,
      account,
      username: client.id,
      password: client.secret
    } as Config;
    // await checkVersion();
    await writeConfig(config);
    console.info('Logged in.');
    process.exit(0);
  } catch(error) {
    if (!!options.verbose) {
      console.error(error.message);
      throw new Error(error.message);
    }
    console.error('Login failed.');
    process.exit(1);
  }
})();

#!/usr/bin/env node

import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config.js';
import type { Config } from './lib/config.d.js';
import { checkLoginAndVvcVersion } from './lib/startup.js';
import { ws } from './lib/ws.js';

const program = new Command();
const options = program.opts();

program
  .version(meta.version)
  .option('-v, --verbose', 'Verbose output') // TODO: Write a better description.
  .parse(process.argv);

/**
 * Checks the validity of the account ID provided.
 * @param {string} account - The account ID to check.
 * @returns {boolean} - True if the account ID is valid, false otherwise.
 */
const checkAccountId = async (account: string): Promise<boolean> => {
  try {
    const response = await fetch(`https://www.vivocha.com/a/${account}/api/v3/openapi.json`, {
      method: 'HEAD',
      redirect: 'manual'
    });
    return response.ok; // If the response is OK, the account ID is valid.
  } catch (error) {
    console.error(`Invalid account ID: ${account}.`);
    throw new Error(error.message);
  }
};

/**
 * 
 * @param account - The account ID to get the server for.
 * @returns 
 */
const getServer = async (account: string): Promise<string> => {
  try {
    const response = await fetch(`https://www.vivocha.com/a/${account}/api/v3/openapi.json`, {
      method: 'HEAD',
      redirect: 'manual'
    });
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

/**
 * 
 * @param server - The server to connect to.
 * @param account 
 */
const getClient = async (server: string, account: string, user: string, password: string): Promise<string> => {
  try {
    const response = await fetch(`https://${server}/a/${account}/api/v3/client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`
      },
      body: JSON.stringify({
        scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli', 'Client.remove' ],
        user_id: user
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
    await checkLoginAndVvcVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.username}`, { method: 'DELETE' });
    await unlinkConfig();
  } catch (error) {
    console.error(); // TODO
    throw new Error(error.message);
  }

  try {
    const accountId: string = await input({
      message: 'Account ID',
      required: true,
      validate: checkAccountId
    });
    const userId: string = await input({
      message: 'Username',
      required: true,
    });
    const userPassword: string = await password({
      message: 'Password'
    });
    const server: string = options.server || await getServer(accountId);
    const client: any = await getClient(server, accountId, userId, userPassword);
    const config: Config = await readConfig().catch(() => { return {} as Config });
          config.server = server || 'www.vivocha.com';
          config.account = accountId;
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

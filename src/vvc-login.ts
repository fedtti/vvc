#!/usr/bin/env node

import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';
import { type Config, meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config.js';
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
const getClient = async (server: string, account: string): Promise<string> => {
  try {
  
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
    await ws(`clients/${config.userId}`, { method: 'DELETE' });
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

    const server: string = options.server || getServer(accountId);
    const client: any = getClient(server, accountId);
    
    await new Promise((resolve, reject) => {
    // request({ // TODO: Replace with fetch().
    //     url: `https://${server}/a/${accountId}/api/v3/client`,
    //     method: 'POST',
    //     json: true,
    //     body: {
    //       scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli', 'Client.remove' ],
    //       user_id: userId
    //     },
    //     auth: {
    //       user: userId,
    //       pass: userPassword,
    //       sendImmediately: true
    //     }
    //   }, function(err, res, data) {
    //     if (err) {
    //       reject(err);
    //     } else if (res.statusCode !== 201) {
    //       reject(new Error('login failed'));
    //     } else {
    //       resolve(data);
    //     }
    //   });
    //  });

    const config: Config = await readConfig().catch(() => { return {} as Config });

    config.server = server || 'www.vivocha.com';
    config.accountId = accountId;
    config.userId = client.id;
    config.secret = client.secret;

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

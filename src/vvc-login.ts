#!/usr/bin/env node

import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';

import { Config, meta, outerRead as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config.js';
import { checkLoginAndVersion } from './lib/startup.js';
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
    const url = `https://www.vivocha.com/a/${account}/api/v3/openapi.json`;
    const response = await fetch(url, {
      method: 'HEAD'
    });
    return response.ok; // If the response is OK, the account ID is valid.
  } catch (error) {
    console.error(`Invalid account ID: ${account}.`);
    throw new Error(error.message);
  }
};

(async (): Promise<void> => {
  try {
    await checkLoginAndVersion();

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
    
    const client: any = await new Promise((resolve, reject) => {
    //   request({
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
     });

    const config: Config = await readConfig().catch(() => { return {} as Config });

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

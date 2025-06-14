#!/usr/bin/env node

import { Command } from 'commander';
import { input, password } from '@inquirer/prompts';

import { Config, meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config';
import { checkLoginAndVersion } from './lib/startup';
import { ws } from './lib/ws';

const program = new Command();
const options = program.opts();

program
  .version(meta.version)
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

/**
 * Checks the validity of the account ID provided.
 * @param {string} account - 
 * @returns {boolean} - 
 */
const checkAccountId = async (account: string): Promise<boolean> => {
  try {
    const url = `https://www.vivocha.com/a/${account}/api/v3/openapi.json`;

    return true;
  } catch (error) {
    console.error(`Invalid account ID: ${account}.`);
  }
};

(async () => {
  try {
    await checkLoginAndVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.user_id}`, { method: 'DELETE' });
    await unlinkConfig();
  } catch (error) {}

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
    
    new Promise<string>((resolve, reject) => {
      request({
        url: `https://www.vivocha.com/a/${accountId}}/api/v3/openapi.json`,
        method: 'HEAD',
        followRedirect: false
      }, function(err, res, data) {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 302 || !res.headers.location) {
          reject(new Error('invalid account'));
        } else {
          let u = new URL(Array.isArray(res.headers.location) ? res.headers.location[0] as string: res.headers.location as string);
          resolve(u.host);
        }
      });
    });
    
    const client: any = await new Promise((resolve, reject) => {
      request({
        url: `https://${server}/a/${accountId}/api/v3/client`,
        method: 'POST',
        json: true,
        body: {
          scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli', 'Client.remove' ],
          user_id: userId
        },
        auth: {
          user: userId,
          pass: userPassword,
          sendImmediately: true
        }
      }, function(err, res, data) {
        if (err) {
          reject(err);
        } else if (res.statusCode !== 201) {
          reject(new Error('login failed'));
        } else {
          resolve(data);
        }
      });
    });
    const config: Config = await readConfig().catch(() => { return {} as Config });

    config.acct_id = accountId;
    config.user_id = client.id;
    config.secret = client.secret;
    config.server = server;
    await writeConfig(config);
    console.log('Logged in');
    process.exit(0);
  } catch(e) {
    if (options.verbose) {
      console.error(e);
    }
    console.error('Login failed');
    process.exit(1);
  }
})();

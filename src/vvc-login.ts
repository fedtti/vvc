#!/usr/bin/env node

import { Command } from 'commander';

import * as inquirer from 'inquirer';

import request from 'request'; // TODO: replace with fetch().

import { URL } from 'url';
import { Config, meta, read as readConfig, unlink as unlinkConfig, write as writeConfig } from './lib/config';
import { checkLoginAndVersion } from './lib/startup';
import { ws } from './lib/ws';

const program = new Command();
const options = program.opts();

program
  .version(meta.version)
  .option('-s, --server [FQDN]', 'Login on custom Vivocha world/server')
  .option('-v, --verbose', 'Verbose output')
  .parse(process.argv);

(async () => {
  try {
    await checkLoginAndVersion();
    const config: Config = await readConfig();
    await ws(`clients/${config.user_id}`, { method: 'DELETE' });
    await unlinkConfig();
  } catch(e) {}

  try {
    const data: any = await inquirer.prompt([
      {
        name: 'acct_id',
        message: 'Account ID',
        validate: v => !!v
      },
      {
        name: 'user_id',
        message: 'Username',
        validate: v => !!v
      },
      {
        name: 'password',
        type: 'password',
        message: 'Password',
        validate: v => !!v
      }
    ]);
    const server: string = options.server || await new Promise<string>((resolve, reject) => {
      request({
        url: `https://www.vivocha.com/a/${data.acct_id}/api/v2/swagger.json`,
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
        url: `https://${server}/a/${data.acct_id}/api/v2/clients`,
        method: 'POST',
        json: true,
        body: {
          scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli', 'Client.remove' ],
          user_id: data.user_id
        },
        auth: {
          user: data.user_id,
          pass: data.password,
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

    config.acct_id = data.acct_id;
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

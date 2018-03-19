#!/usr/bin/env node

import { URL } from 'url';
import * as program from 'commander';
import * as inquirer from 'inquirer';
import * as request from 'request';
import { Config, read as readConfig, write as writeConfig, meta } from './lib/config';

program
  .version(meta.version)
  .parse(process.argv);

(async () => {
  try {
    const data = await inquirer.prompt([
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
    const server: string = await new Promise<string>((resolve, reject) => {
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
          scope: [ 'Widget.*', 'Asset.*', 'String.*', 'Reflect.cli' ],
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
    console.error(e);
    process.exit(1);
  }
})();

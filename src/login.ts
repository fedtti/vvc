#!/usr/bin/env node

import { promisify } from 'util';
import { URL } from 'url';
import * as program from 'commander';
import * as prompt from 'prompt';
import * as request from 'request';
import { Config, read as readConfig, write as writeConfig } from './lib/config';

const meta = require(__dirname + '/../package.json');

program
  .version(meta.version)
  .parse(process.argv);

prompt.start();
prompt.message = '';

(async () => {
  try {
    const data = await promisify(prompt.get)([
      {
        name: 'acct_id',
        required: true,
        message: 'Account ID'
      },
      {
        name: 'user_id',
        required: true,
        message: 'Username'
      },
      {
        name: 'password',
        required: true,
        hidden: true,
        message: 'Password'
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
          scope: [ 'Widget.*', 'Asset.*', 'String.*' ],
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

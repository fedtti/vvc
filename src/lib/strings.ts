import * as request from 'request';
import { Config, read as readConfig } from './config';
import { MultiLanguageString } from '@vivocha/public-entities';

export async function fetchStrings(widgetId: string): Promise<MultiLanguageString[]> {
  const config: Config = await readConfig();
  return new Promise<MultiLanguageString[]>((resolve, reject) => {
    request({
      method: 'GET',
      url: `https://${config.server}/a/${config.acct_id}/api/v2/strings/`,
      qs: {
        path: `WIDGET.${widgetId}.`
      },
      auth: {
        user: config.user_id,
        pass: config.secret,
        sendImmediately: true
      }
    }, function(err, resp, body) {
      if (err) {
        console.error('string get error', err);
        reject(err);
      } else if (resp.statusCode !== 200) {
        console.error('string get failed', resp.statusCode);
        reject(new Error('' + resp.statusCode));
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
}

fetchStrings('popup1').then(strings => {
  console.log(JSON.stringify(strings, null, 2));
}, err => {
  console.error(err)
});
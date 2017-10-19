import * as request from 'request';
import { Config, read as readConfig } from './config';

const _config: Promise<Config> = readConfig();

export class RequestError extends Error {
  constructor(public originalError: any, public response: any, public body: any) {
    super();
  }
}

export async function ws(path: string, opts?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<any> {
  const config = await _config;
  const url = await wsUrl(path);
  return new Promise((resolve, reject) => {
    request(Object.assign({
      method: 'GET',
      url,
      auth: {
        user: config.user_id,
        pass: config.secret,
        sendImmediately: true
      },
      json: true
    }, opts), function(err, resp, body) {
      if (err || okStatusCodes.indexOf(resp.statusCode) === -1) {
        reject(new RequestError(err, resp, body));
      } else {
        resolve(body);
      }
    });
  });
}

export async function wsUrl(path: string): Promise<string> {
  const config = await _config;
  return `https://${config.server}/a/${config.acct_id}/api/v2/${path}`;
}

export async function retriever(url: string): Promise<any> {
  return new Promise(function(resolve, reject) {
    request({
      url: url,
      method: 'GET',
      json: true
    }, function(err, resp, body) {
      if (err || resp.statusCode !== 200) {
        reject(new RequestError(err, resp, body));
      } else {
        resolve(body);
      }
    });
  });
}
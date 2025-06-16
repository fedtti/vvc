import fs from 'fs';
import { read as readConfig } from './config.js';

export class RequestError extends Error {
  constructor(public originalError: any, public response: any, public body: any) {
    super();
  }
}

export async function ws(path: string, opts?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<any> {
  const config = await readConfig();
  const url = await wsUrl(path);
  return new Promise((resolve, reject) => {
    request(Object.assign({ // TODO: Replace with fetch().
      method: 'GET',
      url,
      auth: {
        user: config.userId,
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
  const config = await readConfig();
  return `https://${config.server}/a/${config.accountId}/api/v2/${path}`;
}

export async function retriever(url: string): Promise<any> {
  return new Promise(function(resolve, reject) {
    request({ // TODO: replace with fetch().
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

export async function download(url, filename) {
  return new Promise((resolve, reject) => {
    request(url).pipe(fs.createWriteStream(filename).on('close', resolve).on('error', reject));
  });
}
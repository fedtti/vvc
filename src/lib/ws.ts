import fs from 'fs';
import { read as readConfig } from './config.js';

export class RequestError extends Error {
  constructor(message: string, public originalError: any, public response: any, public body: any) {
    super(message);
    this.name = 'RequestError';
  }
}

/**
 * Constructs the WebSocket URL for the given path using the server and account ID from the configuration.
 * @param {string} path - The path to the WebSocket API endpoint.
 * @returns {Promise<string>} - The WebSocket URL for the given path.
 * @throws {Error} - If the configuration cannot be read.
 */
export const wsUrl = async (path: string): Promise<string> => {
  const config = await readConfig();
  return Promise.resolve(`https://${config.server}/a/${config.account}/api/v3/${path}`) ||
         Promise.reject(new Error('Configuration file not found: perform a login to create it.'));
};

export const ws = async (path: string, options?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<any> => {
  const config = await readConfig();
  const url = await wsUrl(path);
  // return new Promise((resolve, reject) => {
  //   request(Object.assign({ // TODO: Replace with fetch().
  //     method: 'GET',
  //     url,
  //     auth: {
  //       user: config.userId,
  //       pass: config.secret,
  //       sendImmediately: true
  //     },
  //     json: true
  //   }, opts), function(err, resp, body) {
  //     if (err || okStatusCodes.indexOf(resp.statusCode) === -1) {
  //       reject(new RequestError(err, resp, body));
  //     } else {
  //       resolve(body);
  //     }
  //   });
  // });
};

export const retriever = async (url: string): Promise<void> => {
  // return new Promise(function(resolve, reject) {
  //   request({ // TODO: replace with fetch().
  //     url: url,
  //     method: 'GET',
  //     json: true
  //   }, function(err, resp, body) {
  //     if (err || resp.statusCode !== 200) {
  //       reject(new RequestError(err, resp, body));
  //     } else {
  //       resolve(body);
  //     }
  //   });
  // });
};


export const download = async (url: string, filename: string): Promise<void> => {
  // return new Promise((resolve, reject) => {
  //   request(url).pipe(fs.createWriteStream(filename).on('close', resolve).on('error', reject));
  // });
};

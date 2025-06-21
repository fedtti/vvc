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

/**
 * Performs a WebSocket request to the specified path with the given options and expected status codes.
 * @param {string} path - The path to the WebSocket API endpoint.
 * @param {any} options - Optional configuration options for the request, such as headers or query parameters.
 * @param {number[]} okStatusCodes - An array of expected HTTP status codes that indicate a successful response.
 *                                   Defaults to [200, 201].
 * @returns {Promise<any>} - A promise that resolves with the response data if the request is successful.
 * @throws {RequestError} - If the request fails or the response status is not in the expected status codes. 
 */
export const ws = async (path: string, options?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<any> => {
  const config = await readConfig();
  const url = await wsUrl(path);
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
        },
        ...options
      });
      if (!response.ok || okStatusCodes.indexOf(response.status) === -1) {
        const body = await response.text();
        reject(new RequestError(`Request failed with status: ${response.status}.`, null, response, body));
      } else {
        const data = await response.json();
        resolve(data);
      }
    } catch (error) { 
      reject(new RequestError(`Request failed: ${error.message}.`, error, null, null));
    }
  });
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

import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { read as readConfig } from './config.js';

export class RequestError extends Error {
  constructor(message: string, public originalError: Error, public response: Response, public data: any) {
    super(message);
    this.name = 'RequestError';
  }
}

export const wsUrl = async (path: string): Promise<string> => {
  const config = await readConfig();
  return `https://${config.server}/a/${config.account}/api/v3/${path}`;
};

export const ws = async (path: string, options?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<void> => {
  try {
    const config = await readConfig();
    const url = await wsUrl(path);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
      },
      ...options
    });
    if (!response.ok || !okStatusCodes.includes(response.status)) {
      const data = await response.text();
      new RequestError(`Request failed with status: ${response.status}.`, null, response, data);
    } else {
      await response.json();
    }
  } catch (error) { 
    new RequestError(`Request failed: ${error.message}.`, error, null, null);
  }
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
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.statusText}.`);
    }
    await pipeline(response.body, createWriteStream(filename));
  } catch (error) {
    throw new RequestError(`Download failed: ${error.message}.`, error, null, null);
  }
};

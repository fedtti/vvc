import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { read as readConfig } from './config.js';
import type { Config } from './config.d.js';

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

export const ws = async (path: string, options?: any, okStatusCodes: number[] = [ 200, 201 ]): Promise<any> => {
  try {
    const config: Config = await readConfig();
    const url: string = await wsUrl(path);
    const response: Response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${config.username}:${config.password}`).toString('base64')}`,
      },
      ...options
    });
    if (!response.ok || !okStatusCodes.includes(response.status)) {
      const data: string = await response.text();
      new RequestError(`Request failed with status: ${response.status}.`, null, response, data);
    } else {
      const data: any = await response.json();
      return data;
    }
  } catch (error) { 
    new RequestError(`Request failed: ${error.message}.`, error, null, null);
  }
};

export const retriever = async (url: string): Promise<any> => {
  try {
    const response: Response = await fetch(url);
    if (!response.ok || response.status !== 200) {
      throw new RequestError(`Unexpected response: ${response.statusText}.`, null, response, null);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new RequestError(`Retrieval failed: ${error.message}.`, error, null, null);
  }
};

export const download = async (url: string, filename: string): Promise<void> => {
  try {
    const response: Response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unexpected response: ${response.statusText}.`);
    }
    await pipeline(response.body, createWriteStream(filename));
  } catch (error) {
    throw new RequestError(`Download failed: ${error.message}.`, error, null, null);
  }
};

import fs from 'fs/promises';
import { homedir } from 'os';
import type { Config } from './config.d.js';

class ErrorCode extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ErrorCode';
  }
}

export const meta: any = await import(`${import.meta.dirname}/../../package.json`, { with: { type: 'json' } });

const configFileDir: string = `${homedir()}/.vvc`;
const configFilePath: string = `${configFileDir}/config.json`;

let config: Promise<Config>;

const loadConfig = async (login): Promise<Config> => {
  try {
    const data = await fs.readFile(configFilePath, { encoding: 'utf8' });
    return JSON.parse(data);
  } catch (error) {
    if (!!login) {
      return;
    }
    console.error(`Error reading config file: ${error.message}.`);
    throw new Error('Failed to load configuration. Please ensure the config file exists and is valid.');
  }
};

export const read = async (login: boolean = false, force: boolean = false): Promise<Config> => {
  if (!config || !!force) {
    config = loadConfig(login);
  }
  return config;
};

export const write = async (newConfig: Config): Promise<Config> => {
  try {
    const stat = await fs.stat(configFileDir);
    if (!stat.isDirectory()) {
      const error: ErrorCode = new Error(`Error: '${configFileDir}' is not a directory.`);
            error.code = 'ENOTDIR';
      throw error;
    }
  } catch(error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    await fs.mkdir(configFileDir);
  }
  await fs.writeFile(configFilePath, JSON.stringify((({ info, ...keys }) => keys)(newConfig)));
  return config;
};

export const unlink = (): Promise<void> => {
  return fs.unlink(configFilePath);
};

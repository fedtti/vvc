import fs from 'fs/promises';
import { homedir } from 'os';
import type { Config } from './config.d.js';

class ErrorCode extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'ErrorCode';
  }
}

export const meta: any = await import(`${__dirname}/../../package.json`, { with: { type: 'json' } }); // Import package metadata to get its version and other details.

const configFileDir: string = `${homedir()}/.vvc`;
const configFilePath: string = `${configFileDir}/config.json`;

let config: Promise<Config>;

/**
 * Load the configuration file.
 * @returns {Promise<Config>}
 */
const loadConfig = async (): Promise<Config> => {
  const data = await fs.readFile(configFilePath, { encoding: 'utf8' });
  return JSON.parse(data.toString());
};

/**
 * Read the configuration file.
 * @param {boolean} [force=false] - If true, force a reload of the configuration file.
 * @returns {Promise<Config>}
 */
export const read = async (force: boolean = false): Promise<Config> => {
  if (!config || !!force) {
    config = loadConfig();
  }
  return config;
};

/**
 * Write a new configuration file.
 * @param {Config} newConfig - The new configuration object to write.
 * @returns {Promise<Config>}
 */
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
  return config = Promise.resolve(newConfig);
};

/**
 * Delete the existing configuration file.
 * @returns {Promise<void>}
 */
export const unlink = (): Promise<void> => {
  return fs.unlink(configFilePath);
};

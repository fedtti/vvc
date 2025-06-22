import { lt } from 'semver';
import { meta } from './config.js';
import { ws } from './ws.js';
import type { Cli } from './startup.d.js';

/**
 * Checks if the installed version of Vivocha Command Line Tools is compatible.
 * If the installed version is lower than the minimum required version, an error is thrown.
 * 
 * @returns {Promise<void>} - A promise that resolves if the version check passes.
 * @throws {Error} - If the installed version is incompatible or if there is an error during the check.
 */
export const checkVersion = async (): Promise<void> => {
  try {
    const cli: Cli = await ws('reflect/cli');
    if (!!cli.minVersion && lt(meta.version, cli.minVersion)) {
      throw new Error(`Incompatible Vivocha Command Line Tools version: please, upgrade it to at least version ${cli.minVersion}.`);
    }
  } catch (error) {
    throw new Error('Failed to check Vivocha Command Line Tools version. Please, ensure you have the latest version installed.');    
  }
}

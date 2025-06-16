import { lt } from 'semver';
import { meta, read as readConfig } from './config.js';
import { ws } from './ws.js';

/**
 * Checks if the user is logged in and if the Vivocha CLI version is compatible with the server.
 * @returns {Promise<any>} - Resolves with the server info if the user is logged in and the version is compatible.
 */
export const checkLoginAndVvcVersion = async (): Promise<any> => {
  const config = await readConfig().catch(err => {
    throw 'Config file not found, perform a login to create it';
  });

  const info = await ws('reflect/cli').catch(err => {
    if (err.response && err.response.statusCode === 401) {
      throw 'Not logged in';
    } else {
      throw err;
    }
  });

  if (!!info.minVersion && lt(meta.version, info.minVersion)) {
    throw `Incompatible CLI version: please upgrade the Vivocha CLI to at least version ${info.minVersion}.`;
  }

  config.info = info;
}

import { lt } from 'semver';
import { meta, read as readConfig } from './config.js';
import { ws } from './ws.js';

/**
 * Check if the user is logged in and the Vivocha Command Line Tools version is compatible with the server.
 * @returns {Promise<any>} - Resolve with the server information if the user is logged in and the version is compatible.
 */
export const checkLoginAndVvcVersion = async (): Promise<any> => {
  const config = await readConfig()
                         .catch(() => {
                           throw 'Configuration file not found: perform a login to create it.';
                         });

  const info = await ws('reflect/cli')
                       .catch(error => {
                         if (error.response && error.response.statusCode === 401) {
                           throw 'Not logged in.';
                         } else {
                           throw error;
                         }
                       });

  if (!!info.minVersion && lt(meta.version, info.minVersion)) {
    throw `Incompatible Vivocha Command Line Tools version: please, upgrade it to at least version ${info.minVersion}.`;
  }

  config.info = info;
}

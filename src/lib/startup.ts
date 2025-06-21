import { lt } from 'semver';
import { meta, read as readConfig } from './config.js';
import { ws } from './ws.js';

export const checkLoginAndVvcVersion = async (): Promise<void> => {
  const config = await readConfig();
  const info = await ws('reflect/cli');

  if (!!info.minVersion && lt(meta.version, info.minVersion)) {
    throw `Incompatible Vivocha Command Line Tools version: please, upgrade it to at least version ${info.minVersion}.`;
  }

  config.info = info;
}

import { lt } from 'semver';
import { meta } from './config.js';
import { ws } from './ws.js';

export const checkVersion = async (): Promise<void> => {
  const info = await ws('reflect/cli');

  if (!!info.minVersion && lt(meta.version, info.minVersion)) {
    throw `Incompatible Vivocha Command Line Tools version: please, upgrade it to at least version ${info.minVersion}.`;
  }
}

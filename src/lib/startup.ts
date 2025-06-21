import { lt } from 'semver';
import { meta } from './config.js';
import { ws } from './ws.js';
import type { Cli } from './startup.d.js';

export const checkVersion = async (): Promise<void> => {
  const cli: Cli = await ws('reflect/cli');
  console.log('Versione: ', cli);
  if (!!cli.minVersion && lt(meta.version, cli.minVersion)) {
    throw `Incompatible Vivocha Command Line Tools version: please, upgrade it to at least version ${cli.minVersion}.`;
  }
}

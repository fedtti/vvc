import { lt } from 'semver';

import { read as readConfig, meta } from './config';
import { ws } from './ws';

export async function checkLoginAndVersion() {
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
    throw `Incompatible CLI version: please upgrade the Vivocha CLI to version ${info.minVersion} at least`;
  }
  config.info = info;
}

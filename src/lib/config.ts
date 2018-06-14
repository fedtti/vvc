import * as fs from 'fs';
import * as _ from 'lodash';
import { promisify } from 'util';

export interface Config {
  acct_id: string;
  user_id: string;
  secret: string;
  server: string;
  info: any;
}

function homedir(): string {
	const user = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
  switch(process.platform) {
    case 'win32':
		  return process.env.USERPROFILE || process.env.HOMEDRIVE + process.env.HOMEPATH || process.env.HOME || null;
    case 'darwin':
		  return process.env.HOME || (user ? '/Users/' + user : null);
    case 'linux':
		  return process.env.HOME || (process.getuid() === 0 ? '/root' : (user ? '/home/' + user : null));
    default:
      return process.env.HOME || null;
  }
}

export const meta =  require(__dirname + '/../../package.json');
const _config_file_dir = `${homedir()}/.vvc`;
const _config_file_path = `${_config_file_dir}/config.json`;
let config: Promise<Config>;


async function innerRead(): Promise<Config> {
  const raw = await promisify(fs.readFile)(_config_file_path, 'utf8');
  return JSON.parse(raw.toString());
}


export async function read(force: boolean = false): Promise<Config> {
  if (!config || force) {
    config = innerRead();
  }
  return config;
}

export async function write(newConfig:Config): Promise<Config> {
  try {
    const stat = await promisify(fs.stat)(_config_file_dir);
    if (!stat.isDirectory()) {
      let e: any = new Error(`${_config_file_dir} is not a directory`);
      e.code = 'ENOTDIR';
      throw e;
    }
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    await promisify(fs.mkdir)(_config_file_dir);
  }

  await promisify(fs.writeFile)(_config_file_path, JSON.stringify(_.omit(newConfig, [ 'info']), null , 2));
  return config = Promise.resolve(newConfig);
}

export function unlink(): Promise<any> {
  return promisify(fs.unlink)(_config_file_path);
}

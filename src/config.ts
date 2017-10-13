import * as fs from 'fs';
import { promisify } from 'util';

export interface Config {
  acct_id: string;
  user_id: string;
  secret: string;
  server: string;
}

const _config_file_dir = `${process.env.HOME}/.vvc`;
const _config_file_path = `${_config_file_dir}/config.json`;

export async function read(): Promise<Config> {
  const raw = await promisify(fs.readFile)(_config_file_path, 'utf8');
  return JSON.parse(raw.toString());
}

export async function write(config:Config) {
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

  return promisify(fs.writeFile)(_config_file_path, JSON.stringify(config, null , 2));
}
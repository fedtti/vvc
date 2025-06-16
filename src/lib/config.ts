import fs from 'fs/promises';

export interface Config {
  accountId: string;
  userId: string;
  secret: string;
  info: any;
}

const getHomeDir = (): string => {
	const user = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
  switch(process.platform) {
    case 'win32':
		  return process.env.USERPROFILE || `${process.env.HOMEDRIVE}${process.env.HOMEPATH}` || process.env.HOME || null;
    case 'darwin':
		  return process.env.HOME || (!!user ? `/Users/${user}` : null);
    case 'linux':
		  return process.env.HOME || (process.getuid() === 0 ? '/root' : (!!user ? `/home/${user}` : null));
    default:
      return process.env.HOME || null;
  }
};

export const meta = await import(`${__dirname}/../../package.json`, { with: { type: 'json' } });

const _config_file_dir: string = `${getHomeDir()}/.vvc`;
const _config_file_path: string = `${_config_file_dir}/config.json`;

let config: Promise<Config>;

const innerRead = async (): Promise<Config> => {
  const data = await fs.readFile(_config_file_path, 'utf8');
  return JSON.parse(data.toString());
};


export const outerRead = async (force: boolean = false): Promise<Config> => {
  if (!config || force) {
    config = innerRead();
  }
  return config;
};

export const write = async (newConfig: Config): Promise<Config> => {
  try {
    const stat = await fs.stat(_config_file_dir);
    if (!stat.isDirectory()) {
      let e: any = new Error(`${_config_file_dir} is not a directory`);
      e.code = 'ENOTDIR';
      throw e;
    }
  } catch(e) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    await fs.mkdir(_config_file_dir);
  }

  await fs.writeFile(_config_file_path, JSON.stringify((({ info, ...array }) => array)(newConfig)));
  return config = Promise.resolve(newConfig);
};

export const unlink = (): Promise<any> => {
  return fs.unlink(_config_file_path);
};

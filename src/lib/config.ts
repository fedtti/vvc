import fs from 'fs/promises';

export interface Config {
  accountId: string;
  userId: string;
  secret: string;
  info: any;
}

interface ErrorCode extends Error {
  code?: string;
}

/**
 * 
 * @returns {string} - The home directory path for the current user.
 */
const getHomeDir = (): string => {
	const user: string = process.env.LOGNAME || process.env.USER || process.env.LNAME || process.env.USERNAME;
  let homeDir: string;
  switch(process.platform) {
    case 'win32':
		  homeDir = process.env.USERPROFILE || `${process.env.HOMEDRIVE}${process.env.HOMEPATH}` || process.env.HOME || null;
      break;
    case 'darwin':
		  homeDir = process.env.HOME || (!!user ? `/Users/${user}` : null);
      break;
      case 'linux':
		  homeDir = process.env.HOME || (process.getuid() === 0 ? '/root' : (!!user ? `/home/${user}` : null));
      break;
    default:
      homeDir = process.env.HOME || null;
  }
  return homeDir;
};

export const meta = await import(`${__dirname}/../../package.json`, { with: { type: 'json' } }); //

const configFileDir: string = `${getHomeDir()}/.vvc`;
const configFilePath: string = `${configFileDir}/config.json`;

let config: Promise<Config>;

/*
 *
 */
const innerRead = async (): Promise<Config> => {
  const data = await fs.readFile(configFilePath, { encoding: 'utf8' });
  return JSON.parse(data.toString());
};

/*
 *
 */
export const outerRead = async (force: boolean = false): Promise<Config> => {
  if (!config || !!force) {
    config = innerRead();
  }
  return config;
};

export const write = async (newConfig: Config): Promise<Config> => {
  try {
    const stat = await fs.stat(configFileDir);
    if (!stat.isDirectory()) {
      let error: ErrorCode = new Error(`${configFileDir} is not a directory.`);
      error.code = 'ENOTDIR';
      throw error;
    }
  } catch(error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
    await fs.mkdir(configFileDir);
  }

  await fs.writeFile(configFilePath, JSON.stringify((({ info, ...keys }) => keys)(newConfig)));
  return config = Promise.resolve(newConfig);
};

export const unlink = (): Promise<any> => {
  return fs.unlink(configFilePath);
};

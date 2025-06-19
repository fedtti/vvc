import type { Asset } from '@vivocha/public-entities';
import crypto from 'crypto';
import { createReadStream, mkdir, Stats } from 'fs';
import { access, constants, stat } from 'fs/promises';
import path from 'path';
import { type Config, read as readConfig } from './config.js';
import { listFiles } from './walkdir.js';
import { download, ws } from './ws.js';

/**
 *
 * @param {string} basePath -
 * @returns {Promise<Asset[]>} -
 */
export const scanWidgetAssets = async (basePath: string): Promise<Asset[]> => {
  const assets: Promise<Asset>[] = [];
  const resolvedPath: string = path.resolve(basePath);

  /**
   * 
   * @param fileName -
   * @returns 
   */
  const checkAsset = async (fileName: string): Promise<Asset> => {
    let readOk: boolean = true,
        info: Stats;
    try {
      await access(fileName, constants.R_OK);
      info = await stat(fileName);
    } catch (error) {
      readOk = false;
    }
    let baseFileName = fileName.replace(`${resolvedPath}/`, '');
    if (!!readOk && !!info.isFile()) {
      return {
        path: baseFileName
      } as Asset;
    } else {
      throw new Error(baseFileName);
    }
  };

  const html = checkAsset(`${resolvedPath}/main.html`);
  const scss = checkAsset(`${resolvedPath}/main.scss`);
  const thumbnail = checkAsset(`${resolvedPath}/thumbnail.png`);
  assets.push(html);
  assets.push(scss);

  try {
    await thumbnail;
    assets.push(thumbnail);
  } catch (error) { }

  const assetsPath: string = `${basePath}/assets`;

  try {
    assets.push(...(await listFiles(assetsPath))
                            .map(file => file.replace(/^\.\//, ''))
                            .map(file => checkAsset(file)));
  } catch (error) { }
  return Promise.all(assets);
};

/**
 * 
 * @param {Asset[]} assets -
 * @returns {Asset[]}
 */
export const hashWidgetAssets = (assets: Asset[]): Promise<Asset[]> => {
  const hashedAssets: Promise<Asset>[] = [];
  assets.forEach(({ path: filename }) => {
    hashedAssets.push(new Promise<Asset>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = createReadStream(filename);
      stream.on('error', error => reject(error));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve({
        path: filename,
        hash: hash.digest('hex')
      } as Asset));
    }));
  });
  return Promise.all(hashedAssets);
};

/**
 * 
 * @param widgetId 
 * @param oldAssets 
 * @param newAssets 
 * @param global 
 */
export const uploadWidgetAssetChanges = async (widgetId: string, oldAssets: Asset[], newAssets: Asset[], global: boolean): Promise<void> => {
  async function upload(asset: Asset): Promise<Asset> {
    try {
      let data = await ws(`widgets/${widgetId}/upload${!!global ? '?global=true' : ''}`, {
        method: 'POST',
        qs: {
          id: `${asset.path}/${asset.hash.substr(0, 7)}`
        },
        formData: {
          file: createReadStream(asset.path)
        }
      });
      asset.id = data.id;
      asset.type = data.type;
      asset.size = data.size;
      return asset;
    } catch (error) {
      if (error.originalError) {
        console.error('upload error', error.originalError);
      } else if (error.response) {
        console.error('upload failed', error.response.statusCode);
      } else {
        console.error(error);
      }
      throw error;
    }
  }
  function reduce(o, i) {
    o[i.path] = i;
    return o;
  }
  const oldMap = oldAssets.reduce(reduce, {});
  const newMap = newAssets.reduce(reduce, {});

  for (let k in newMap) {
    const o = oldMap[k], n = newMap[k];
    if (!o || !o.id || o.hash !== n.hash) {
      console.log(`${k} changed, uploading`);
      await upload(n);
    } else {
      n.id = o.id;
      if (o.size) n.size = o.size;
      if (o.type) n.type = o.type;
    }
  }
};

/**
 * 
 * @param {string} url - 
 * @param {string} fileName - 
 */
const downloadAsset = async (url: string, fileName: string): Promise<void> => {
  const pathInfo = path.parse(fileName);
  if (!!pathInfo.dir) {
    await access(pathInfo.dir)
            .then(async () => {
              const statInfo = await stat(pathInfo.dir)
                                       .catch(() => {
                                         throw `Cannot access destination path '${pathInfo.dir}.'`;
                                       });
      if (!statInfo.isDirectory()) {
        throw `Destination path '${pathInfo.dir}' already exists and it’s not a directory.`;
      }
    }, async () => {
      mkdir(pathInfo.dir, { recursive: true }, () => {
        throw `Cannot create path '${pathInfo.dir}'.`;
      });
    });
  }
  console.info(`Downloading ${fileName}…`);
  await download(url, fileName);
};

/**
 * 
 * @param {Asset[]} assets -
 */
export const downloadAssets = async (assets: Asset[]): Promise<void> => {
  const config: Config = await readConfig();
  for (let asset of assets) {
    await downloadAsset(`${config.info.assets}${asset.id}`, asset.path);
  }
};

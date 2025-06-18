import type { Asset } from '@vivocha/public-entities';
import crypto from 'crypto';
import { createReadStream, mkdir, PathLike, Stats } from 'fs';
import { access, constants, stat } from 'fs/promises';
import path from 'path';
import { type Config, read as readConfig } from './config.js';
import { listFiles } from './walkdir.js';
import { download, ws } from './ws.js';

/**
 * Scans the specified basepath for widget assets and returns an array of Asset objects.
 * @param {string} basepath - The path to the widget directory.
 * @returns {Promise<Asset[]>} - A promise that resolves to an array of Asset objects.
 */
export const scanWidgetAssets = async (basePath: string): Promise<Asset[]> => {
  const assets: Promise<Asset>[] = [];
  const resolvedPath: string = path.resolve(basePath);

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
  } catch(error) { }

  const assetsPath: string = `${basePath}/assets`;

  try {
    assets.push(...(await listFiles(assetsPath))
                            .map(file => file.replace(/^\.\//, ''))
                            .map(file => checkAsset(file)));
  } catch(error) { }
  return Promise.all(assets);
};

export const hashWidgetAssets = (assets: Asset[]): Promise<Asset[]> => {
  const hashedAssets: Promise<Asset>[] = [];
  assets.forEach(({ path: filename }) => {
    hashedAssets.push(new Promise<Asset>((resolve, reject) => {
      let hash = crypto.createHash('sha256');
      let stream = createReadStream(filename);
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve({
        path: filename,
        hash: hash.digest('hex')
      } as Asset));
    }));
  });
  return Promise.all(hashedAssets);
};

export async function uploadWidgetAssetChanges(widgetId: string, oldAssets: Asset[], newAssets: Asset[], global: boolean) {
  async function upload(asset: Asset): Promise<Asset> {
    try {
      let data = await ws(`widgets/${widgetId}/upload${global ? '?global=true' : ''}`, {
        method: 'POST',
        qs: {
          id: `${asset.path}/${asset.hash.substr(0,7)}`
        },
        formData: {
          file: createReadStream(asset.path)
        }
      });
      asset.id = data.id;
      asset.type = data.type;
      asset.size = data.size;
      return asset;
    } catch(err) {
      if (err.originalError) {
        console.error('upload error', err.originalError);
      } else if (err.response) {
        console.error('upload failed', err.response.statusCode);
      } else {
        console.error(err);
      }
      throw err;
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
}

/**
 * Downloads an asset from the server and saves it to the specified destination path.
 * @param {string} url - The URL of the asset to download.
 * @param {string} filename - The path where the asset should be saved.
 */
const downloadAsset = async (url: string, filename: string): Promise<void> => {
  const pathInfo = path.parse(filename);
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
  console.info(`Downloading ${filename}…`);
  await download(url, filename);
};

/**
 * Download assets from the server.
 * @param {Asset[]} assets - Array of assets to download.
 */
export const downloadAssets = async (assets: Asset[]): Promise<void> => {
  const config: Config = await readConfig();
  for (let asset of assets) {
    await downloadAsset(`${config.info.assets}${asset.id}`, asset.path);
  }
};

import type { Asset } from '@vivocha/public-entities';
import crypto from 'crypto';
import { access, constants, stat } from 'fs/promises';
import { createReadStream, mkdir } from 'fs';
import path from 'path';
import { type Config, read as readConfig } from './config.js';
import { listFiles } from './walkdir.js';
import { download, ws } from './ws.js';

export async function scanWidgetAssets(basepath: string): Promise<Asset[]> {
  const assets: Promise<Asset>[] = [];
  const resolvedPath = path.resolve(basepath);

  async function checkAsset(filename): Promise<Asset> {
    let rok = true, info;
    try {
      await access(filename, constants.R_OK);
      info = await stat(filename);
    } catch(err) {
      rok = false;
    }
    let base_filename = filename.replace(resolvedPath + '/', '');
    if (rok && info.isFile()) {
      return {
        path: base_filename
      } as Asset;
    } else {
      throw new Error(base_filename);
    }
  }

  const html = checkAsset(`${resolvedPath}/main.html`);
  const scss = checkAsset(`${resolvedPath}/main.scss`);
  const thumb = checkAsset(`${resolvedPath}/thumbnail.png`);

  assets.push(html);
  assets.push(scss);

  try {
    await thumb;
    assets.push(thumb);
  } catch(e) { }

  const assetsPath: string = `${basepath}/assets`;

  try {
    assets.push(... (await listFiles(assetsPath)).map(f => f.replace(/^\.\//, '')).map(f => checkAsset(f)));
  } catch(e) { }
  return Promise.all(assets);
}
export function hashWidgetAssets(assets: Asset[]): Promise<Asset[]> {
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
}
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

async function downloadAsset(url: string, filename: string) {
  const pathInfo = path.parse(filename);
  if (pathInfo.dir) {
    await access(pathInfo.dir).then(async () => {
      const statInfo = await stat(pathInfo.dir).catch(() => {
        throw `Cannot access destination path \'${pathInfo.dir}\'`;
      });
      if (!statInfo.isDirectory()) {
        throw `Destination path ${pathInfo.dir} exists and it\'s not a directory`;
      }
    }, async () => {
      await mkdir(pathInfo.dir, { recursive: true }, () => {
        throw `Cannot create path ${pathInfo.dir}`;
      });
    });
  }
  console.log(`Downloading ${filename}`);
  await download(url, filename);
}
export async function downloadAssets(assets: Asset[]) {
  const config: Config = await readConfig();
  for (let a of assets) {
    await downloadAsset(`${config.info.assets}${a.id}`, a.path);
  }
}
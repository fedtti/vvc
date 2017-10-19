import * as fs from 'fs';
import * as path  from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import * as walk from 'walkdir';
import { Asset } from '@vivocha/public-entities';
import { ws } from './ws';

const stat = promisify(fs.stat);
const access = promisify(fs.access);

export async function scanWidgetAssets(basepath: string): Promise<Asset[]> {
  const assets: Promise<Asset>[] = [];
  const resolvedPath = path.resolve(basepath);

  async function checkAsset(filename): Promise<Asset> {
    let rok = true, info;
    try {
      await access(filename, fs.constants.R_OK);
      info = await stat(filename);
    } catch(err) {
      rok = false;
    }
    let base_filename = filename.replace(resolvedPath + '/', '');
    if (rok && info.isFile()) {
      return {
        path: base_filename
      }
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
  } catch {
  }

  return new Promise<Asset[]>(resolve => {
    const emitter = walk(`${basepath}/assets`);
    emitter.on('file', filename => {
      assets.push(checkAsset(filename));
    });
    emitter.on('end', () => {
      resolve(Promise.all(assets));
    });
  });
}
export function hashWidgetAssets(assets: Asset[]): Promise<Asset[]> {
  const hashedAssets: Promise<Asset>[] = [];

  assets.forEach(({ path: filename }) => {
    hashedAssets.push(new Promise<Asset>((resolve, reject) => {
      let hash = crypto.createHash('sha256');
      let stream = fs.createReadStream(filename);
      stream.on('error', err => reject(err));
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve({
        path: filename,
        hash: hash.digest('hex')
      }));
    }));
  });
  return Promise.all(hashedAssets);
}
export async function uploadWidgetAssetChanges(widgetId, oldAssets: Asset[], newAssets: Asset[]) {
  async function upload(asset: Asset): Promise<Asset> {
    try {
      let data = await ws(`widgets/${widgetId}/upload`, {
        method: 'POST',
        qs: {
          id: asset.path
        },
        formData: {
          file: fs.createReadStream(asset.path)
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

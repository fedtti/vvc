import * as fs from 'fs';
import * as path  from 'path';
import * as crypto from 'crypto';
import { promisify } from 'util';
import * as walk from 'walkdir';
import * as request from 'request';
import { Asset } from '@vivocha/public-entities';
import { Config, read as readConfig } from './config';

const stat = promisify(fs.stat);
const access = promisify(fs.access);

export async function scanAssets(basepath: string): Promise<Asset[]> {
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
export function hashAssets(assets: Asset[]): Promise<Asset[]> {
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
export async function uploadAndUpdate(widgetId, oldAssets: Asset[], newAssets: Asset[]) {
  const config: Config = await readConfig();

  function upload(asset: Asset): Promise<Asset> {
    console.log('uploading', asset.path);
    return new Promise((resolve, reject) => {
      request({
        method: 'POST',
        url: `https://${config.server}/a/${config.acct_id}/api/v2/widgets/${widgetId}/upload`,
        qs: {
          id: asset.path
        },
        auth: {
          user: config.user_id,
          pass: config.secret,
          sendImmediately: true
        },
        formData: {
          file: fs.createReadStream(asset.path)
        }
      }, function(err, resp, body) {
        if (err) {
          console.error('upload error', err);
          reject(err);
        } else if (resp.statusCode !== 200) {
          console.error('upload failed', resp.statusCode);
          reject(new Error('' + resp.statusCode));
        } else {
          const data = JSON.parse(body);
          asset.id = data.id;
          asset.type = data.type;
          asset.size = data.size;
          resolve(asset);
        }
      });
    });
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
      console.log(`${k} changed`);
      await upload(n);
      console.log(n);
    } else {
      n.id = o.id;
      if (o.size) n.size = o.size;
      if (o.type) n.type = o.type;
    }
  }
}

const old = [
  {
    "path": "main.html",
    "hash": "88b7559e39863da3d0594c3f4c77c3619f1b38121746d9015fed6482141b0453",
    "id": "widgets/popup1/main.html",
    "type": "text/html",
    "size": 1529
  },
  {
    "path": "main.scss",
    "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "id": "widgets/popup1/main.scss",
    "type": "text/x-scss",
    "size": 0
  },
  {
    "path": "assets/artboard.png",
    "hash": "69236e4b929d969c3c5c6dd3f7becbd9e0d740f77ed2725077fd8c694d721f6f",
    "id": "widgets/popup1/assets/artboard.png",
    "type": "image/png",
    "size": 101484
  },
  {
    "path": "assets/company.png",
    "hash": "f80ec9668a6dd4f72542e417e8a7722242318c74b446ea0785f2b6fa74152f0e",
    "id": "widgets/popup1/assets/company.png",
    "type": "image/png",
    "size": 1689
  },
  {
    "path": "assets/vivicon/style.css",
    "hash": "e35e31e631519347281cf8318abe3fc5a5f3a6251bd706ffa28734b27bd61ab4",
    "id": "widgets/popup1/assets/vivicon/style.css",
    "type": "text/css",
    "size": 2262
  },
  {
    "path": "assets/vivicon/fonts/vvc-widget-ico.eot",
    "hash": "fb77f49309bae0a600b1f12cc4e05d426c30f22257164b39f99bc3729fa1a730",
    "id": "widgets/popup1/assets/vivicon/fonts/vvc-widget-ico.eot",
    "type": "application/vnd.ms-fontobject",
    "size": 7644
  },
  {
    "path": "assets/vivicon/fonts/vvc-widget-ico.woff",
    "hash": "0f6280ab22e4cd4c39f37f5777a87501615f3fa70217f75434a534c7b1c82861",
    "id": "widgets/popup1/assets/vivicon/fonts/vvc-widget-ico.woff",
    "type": "application/font-woff",
    "size": 7528
  },
  {
    "path": "assets/vivicon/fonts/vvc-widget-ico.svg",
    "hash": "753018d410fef41a4c714973c424cb37365af5d85351cc886a831114a40f7d86",
    "id": "widgets/popup1/assets/vivicon/fonts/vvc-widget-ico.svg",
    "type": "image/svg+xml",
    "size": 25387
  },
  {
    "path": "assets/vivicon/fonts/vvc-widget-ico.ttf",
    "hash": "840ccbb546b228ce092ef18427099ef053f1acab3fa5f5202bf123e3aafcbff2",
    "id": "widgets/popup1/assets/vivicon/fonts/vvc-widget-ico.ttf",
    "type": "application/x-font-ttf",
    "size": 7452
  }
];

scanAssets('.').then(assets => {
  hashAssets(assets).then(assets => {
    uploadAndUpdate('popup1', old, assets).then(() => {
      console.log(JSON.stringify(assets, null, 2));
    })
  });
});
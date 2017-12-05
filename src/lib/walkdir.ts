import { promisify } from 'util';
import * as fs from 'fs';

const readdir = promisify(fs.readdir) as (path: string, options?) => Promise<string[]>;
const stat = promisify(fs.stat) as (path: string) => Promise<fs.Stats>;

export default async function listFiles(path: string): Promise<string[]> {
  const out: string[] = [];
  let s = await stat(path);
  if (s.isDirectory()) {
    const files: string[] = (await readdir(path) || []).filter(f => f[0] !== '.').map(f => `${path}/${f}`);
    for (let f of files) {
      out.push(...await listFiles(f));
    }
  } else if (s.isFile()) {
    out.push(path);
  }
  return out;
}

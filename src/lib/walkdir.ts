import fs from 'fs/promises';

/**
 * Recursively lists all files in a directory.
 * 
 * @param {string} path - The path to the directory or file.
 * @returns {Promise<string[]>} - A promise that resolves to an array of file paths.
 */
export default async function listFiles(path: string): Promise<string[]> {
  const out: string[] = [];
  let s = await fs.stat(path);
  if (s.isDirectory()) {
    const files: string[] = (await fs.readdir(path) || []).filter(f => f[0] !== '.').map(f => `${path}/${f}`);
    for (let f of files) {
      out.push(...await listFiles(f));
    }
  } else if (s.isFile()) {
    out.push(path);
  }
  return out;
}

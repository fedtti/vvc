import fs from 'fs/promises';

/**
 * Recursively list all elements in a directory.
 * @param {string} path - Path to the element.
 * @returns {Promise<string[]>} - Resolve to an array of elements’ paths.
 */
export const listFiles = async (path: string): Promise<string[]> => {
  const out: string[] = [];
  let element = await fs.stat(path);
  if (element.isDirectory()) {
    const files: string[] = (await fs.readdir(path) || [])
                              .filter(file => file[0] !== '.') // Exclude hidden files.
                              .map(file => `${path}/${file}`);
    for (let file of files) {
      out.push(...await listFiles(file));
    }
  } else if (element.isFile()) {
    out.push(path);
  }
  return out;
};

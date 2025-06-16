import fs from 'fs/promises';

/**
 * Recursively lists all files in a directory.
 * 
 * @param {string} path - The path to the directory or file.
 * @returns {Promise<string[]>} - A promise that resolves to an array of file paths.
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

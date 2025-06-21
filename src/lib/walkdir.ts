import fs from 'fs/promises';

export const listFiles = async (path: string): Promise<string[]> => {
  const list: string[] = [];
  let element = await fs.stat(path);
  if (element.isDirectory()) {
    const files: string[] = (await fs.readdir(path) || [])
                              .filter(file => file[0] !== '.') // Exclude hidden files (those starting with a dot).
                              .map(file => `${path}/${file}`);
    for (let file of files) {
      list.push(...await listFiles(file));
    }
  } else if (element.isFile()) {
    list.push(path);
  }
  return list;
};

import * as _ from 'lodash';
import { Eredita } from 'eredita';
import { MultiLanguageString } from '@vivocha/public-entities/dist/language';
import { ws } from './ws';

interface StringMap {
  [id:string]: MultiLanguageString
}
function reducer(o: StringMap, i: MultiLanguageString): StringMap {
  o[i.id] = {
    id: i.id,
    values: i.values
  };
  if (i.description) {
    o[i.id].description = i.description;
  }
  return o;
}
function getPaths(strings: MultiLanguageString[]): string {
  let data: any = strings.map(s => s.id).reduce((o: any, i: string) => {
    Eredita.dot(o, i, true);
    return o;
  }, {});
  function _getPaths(data: any, curr_path: string, curr_depth: number): string {
    const keys = Object.keys(data);
    if (keys.length > 1) {
      if (curr_depth > 1 || keys.length > 2) {
        return curr_path;
      } else {
        return keys.map(k => _getPaths(data[k], `${curr_path}${curr_path ? '.' : ''}${k}`, curr_depth + 1)).join(',')
      }
    } else if (typeof data[keys[0]] === 'boolean') {
      return curr_path;
    } else {
      return _getPaths(data[keys[0]], `${curr_path}${curr_path ? '.' : ''}${keys[0]}`, curr_depth + 1);
    }
  }
  return _getPaths(data, '', 0);
}

export function fetchStrings(path: string, global: boolean): Promise<MultiLanguageString[]> {
  return ws(`strings${global ? '?global=true' : ''}`, { qs: { path } });
}
export async function uploadString(str: MultiLanguageString, global: boolean): Promise<MultiLanguageString> {
  return ws(`strings/${str.id}${global ? '?global=true' : ''}`, {
    method: 'PUT',
    body: str
  });
}
export async function fetchWidgetStrings(widgetId: string, global: boolean): Promise<MultiLanguageString[]> {
  const prefix = `WIDGET.${widgetId}.`;
  const prefix_re = new RegExp(`^${prefix}`);
  return (await fetchStrings(prefix, global)).map(i => {
    i.id = i.id.replace(prefix_re, '');
    return i;
  });
}
export async function uploadWidgetString(widgetId: string, str: MultiLanguageString, global: boolean): Promise<string> {
  let wstr: MultiLanguageString = Object.assign({}, str, { id: `WIDGET.${widgetId}.${str.id}`});
  return uploadString(wstr, global).then(() => str.id);
}
export async function uploadWidgetStringChanges(widgetId: string, newStrings: MultiLanguageString[], global: boolean): Promise<string[]> {
  const o: StringMap = (await fetchWidgetStrings(widgetId, global)).reduce(reducer, {});
  const n: StringMap = newStrings.reduce(reducer, {});
  const stringIds = Object.keys(n);
  for (let k of stringIds) {
    if (!o[k] || !_.isEqual(o[k], n[k])) {
      console.log(`string ${k} changed, uploading`);
      await uploadWidgetString(widgetId, n[k], global);
    }
  }
  return stringIds;
}
export async function uploadStringChanges(newStrings: MultiLanguageString[], global: boolean): Promise<string[]> {
  let paths: string = getPaths(newStrings);
  const o: StringMap = (await fetchStrings(paths, global)).reduce(reducer, {});
  const n: StringMap = newStrings.reduce(reducer, {});
  const stringIds = Object.keys(n);
  for (let k of stringIds) {
    if (!o[k] || !_.isEqual(o[k], n[k])) {
      console.log(`string ${k} changed, uploading`);
      await uploadString(n[k], global);
    }
  }
  return stringIds;
}

import * as _ from 'lodash';
import { MultiLanguageString } from '@vivocha/public-entities/dist/language';
import { ws } from './ws';

interface StringMap {
  [id:string]: MultiLanguageString
}
function reducer(o: StringMap, i: MultiLanguageString): StringMap {
  o[i.id] = {
    id: i.id,
    description: i.description,
    values: i.values
  };
  return o;
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
export async function uploadStringChanges(path: string, newStrings: MultiLanguageString[], global: boolean): Promise<string[]> {
  const o: StringMap = (await fetchStrings(path, global)).reduce(reducer, {});
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

import * as _ from 'lodash';
import { MultiLanguageString } from '@vivocha/public-entities';
import { ws } from './ws';

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
export async function uploadWidgetString(widgetId: string, str: MultiLanguageString, global: boolean): Promise<MultiLanguageString> {
  let wstr = Object.assign({}, str, { id: `WIDGET.${widgetId}.${str.id}`});
  return uploadString(wstr, global).then(() => str.id);
}
export async function uploadWidgetStringChanges(widgetId: string, newStrings: MultiLanguageString[], global: boolean): Promise<string[]> {
  function reduce(o, i) {
    o[i.id] = { id: i.id, values: i.values };
    return o;
  }
  interface StringMap { [id:string]: MultiLanguageString }
  const o: StringMap = (await fetchWidgetStrings(widgetId, global)).reduce(reduce, {});
  const n: StringMap = newStrings.reduce(reduce, {});

  const stringIds = Object.keys(n);

  for (let k of stringIds) {
    if (!o[k] || !_.isEqual(o[k], n[k])) {
      console.log(`string ${k} changed, uploading`);
      await uploadWidgetString(widgetId, n[k], global);
    }
  }

  return stringIds;
}

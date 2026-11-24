// 保存の層。画面(app.js)は、ここの関数だけを通してデータに触る。
// いまは端末の中(localStorage)に置く。あとで保存先を替えるときは、このファイルだけを書き換える。
// どの関数も Promise を返す(保存先がサーバーになっても、画面側を変えずに済むように)。

const APP_ID = '__APP_ID__';
const KEY = APP_ID + ':data';
const BROKEN_KEY = APP_ID + ':broken';
const FORMAT = 1;

let items = [];

function persist() {
  localStorage.setItem(KEY, JSON.stringify({ format: FORMAT, items }));
}

function isItem(x) {
  return x && typeof x.id === 'string' && typeof x.text === 'string' && typeof x.createdAt === 'string';
}

function newId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

/** 読み込む。壊れていたら中身を別の場所に退避し、空で始める。戻り値 { recovered: 退避したか } */
export async function load() {
  const raw = localStorage.getItem(KEY);
  if (raw === null) { items = []; return { recovered: false }; }
  try {
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.items) || !data.items.every(isItem)) throw new Error('形が違う');
    items = data.items;
    return { recovered: false };
  } catch (e) {
    localStorage.setItem(BROKEN_KEY, raw);
    items = [];
    return { recovered: true };
  }
}

/** 新しい順の一覧(写し) */
export async function list() {
  return items.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function add(text) {
  const t = String(text).trim();
  if (!t) return null;
  const item = { id: newId(), text: t.slice(0, 200), createdAt: new Date().toISOString() };
  items.push(item);
  persist();
  return item;
}

export async function remove(id) {
  items = items.filter((x) => x.id !== id);
  persist();
}

/** 書き出し用のまとまり */
export async function exportAll() {
  return { app: APP_ID, format: FORMAT, exportedAt: new Date().toISOString(), items: items.slice() };
}

/** 読み込み(置き換え)。形が違えば例外。戻り値は件数 */
export async function importAll(data) {
  if (!data || data.app !== APP_ID) throw new Error('このアプリの書き出しファイルではありません');
  if (!Array.isArray(data.items) || !data.items.every(isItem)) throw new Error('ファイルの形が違います');
  items = data.items.map((x) => ({ id: x.id, text: x.text.slice(0, 200), createdAt: x.createdAt }));
  persist();
  return items.length;
}

export async function clear() {
  items = [];
  localStorage.removeItem(KEY);
  localStorage.removeItem(BROKEN_KEY);
}

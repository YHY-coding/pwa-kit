// 画面の層。データは store.js の関数だけを通す。
import * as store from './store.js';

const $ = (id) => document.getElementById(id);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- 待機画面 ----------
// 読み込みが終わるまで本体を見せない。短すぎても落ち着かないので下限を置き、上限で必ず開く。押せば飛ばせる。
const SPLASH_MIN_MS = reduceMotion ? 0 : 1300;
const SPLASH_MAX_MS = 3000;

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function runSplash(ready) {
  const splash = $('splash');
  const skipped = new Promise((r) => splash.addEventListener('pointerdown', r, { once: true }));
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  const loaded = Promise.all([ready, fonts]);
  // 飛ばしても、データの読み込みだけは待つ(読み込み途中の画面を見せない)
  await Promise.race([
    Promise.all([loaded, Promise.race([wait(SPLASH_MIN_MS), skipped])]),
    wait(SPLASH_MAX_MS).then(() => ready)
  ]);
  $('app').hidden = false;
  splash.classList.add('leave');
  await wait(reduceMotion ? 0 : 420);
  splash.remove();
}

// ---------- 一覧 ----------
function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function render() {
  const rows = await store.list();
  const ol = $('list');
  ol.textContent = '';
  for (const it of rows) {
    const li = document.createElement('li');
    const body = document.createElement('p');
    body.className = 'item-text';
    body.textContent = it.text;
    const meta = document.createElement('div');
    meta.className = 'item-meta';
    const time = document.createElement('time');
    time.dateTime = it.createdAt;
    time.textContent = fmtDate(it.createdAt);
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'link';
    del.textContent = '消す';
    del.setAttribute('aria-label', `「${it.text.slice(0, 20)}」を消す`);
    del.addEventListener('click', async () => { await store.remove(it.id); render(); });
    meta.append(time, del);
    li.append(body, meta);
    ol.append(li);
  }
  $('empty').hidden = rows.length > 0;
  $('count').textContent = rows.length ? `${rows.length}件` : '';
}

function showToday() {
  const d = new Date();
  const w = '日月火水木金土'[d.getDay()];
  $('today').textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${w})`;
}

// ---------- 設定(書き出し・読み込み・全削除) ----------
function say(text) { $('msg').textContent = text; }

function setupSettings() {
  const dlg = $('settings');
  $('open-settings').addEventListener('click', () => {
    say(''); $('sure').checked = false; $('wipe').disabled = true;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  $('close-settings').addEventListener('click', () => dlg.close ? dlg.close() : dlg.removeAttribute('open'));

  $('export').addEventListener('click', async () => {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data.app}_${data.exportedAt.slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say(`${data.items.length}件を書き出しました。保存されたかは、ファイルの置き場所で確かめてください。`);
  });

  $('copy').addEventListener('click', async () => {
    const data = await store.exportAll();
    try {
      await navigator.clipboard.writeText(JSON.stringify(data));
      say(`${data.items.length}件を写しました。メモなどに貼って残せます。`);
    } catch (e) {
      say('写せませんでした。「ファイルに書き出す」を使ってください。');
    }
  });

  $('import').addEventListener('change', async (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    try {
      const n = await store.importAll(JSON.parse(await file.text()));
      await render();
      say(`${n}件を読み込みました。`);
    } catch (e) {
      say('読み込めませんでした: ' + (e && e.message ? e.message : '形が違います'));
    }
    ev.target.value = '';
  });

  $('sure').addEventListener('change', (ev) => { $('wipe').disabled = !ev.target.checked; });
  $('wipe').addEventListener('click', async () => {
    await store.clear();
    await render();
    $('sure').checked = false; $('wipe').disabled = true;
    say('全部消しました。');
  });
}

// ---------- サービスワーカー ----------
function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offer = (worker) => {
      $('update-bar').hidden = false;
      $('do-update').onclick = () => worker.postMessage('skip-waiting');
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
  }).catch(() => { /* 登録できなくても、通信がある間は使える */ });

  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; // 初回の登録では読み直さない
    reloaded = true;
    location.reload();
  });
}

// ---------- 始める ----------
async function main() {
  const ready = store.load().then(async (r) => {
    showToday();
    await render();
    return r;
  });
  setupSettings();
  $('entry').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const input = $('text');
    if (await store.add(input.value)) { input.value = ''; await render(); }
  });
  await runSplash(ready);
  const r = await ready;
  if (r.recovered) {
    $('empty').textContent = '保存されていたデータが読めなかったため、空で始めました(元の中身は端末の中に退避してあります)。';
  }
  setupServiceWorker();
}

main();

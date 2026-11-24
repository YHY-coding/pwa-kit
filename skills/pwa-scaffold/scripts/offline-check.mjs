#!/usr/bin/env node
// 「通信なしでも開くか」を、手元だけで確かめる。外へは何も送らない。
// やること: フォルダを手元のサーバーで配る → 画面なしの Chrome で開く(幅375px)
//   → サービスワーカーが配るファイルをしまい終えるのを待つ → サーバーを止める → 開き直す → 開けたかを見る。
// 使い方: node offline-check.mjs <アプリのフォルダ> [--chrome <Chromeの場所>]
// 要るもの: Node.js 22 以上と、Chrome(か Chromium)。iPhone の Safari そのものではない点に注意。
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { findChrome, openPage, sleep } from '../../../lib/cdp.mjs';

const args = process.argv.slice(2);
const chromeArg = args.includes('--chrome') ? args[args.indexOf('--chrome') + 1] : null;
const dir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--chrome');
if (!dir || !existsSync(join(dir, 'index.html'))) {
  console.error('使い方: node offline-check.mjs <index.html のあるフォルダ> [--chrome <場所>]');
  process.exit(2);
}
const chrome = findChrome(chromeArg);
if (!chrome) {
  console.error('Chrome が見つからない。--chrome か、環境変数 CHROME_PATH で場所を指定する。確かめは未実施。');
  process.exit(2);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const root = resolve(dir);
let hits = 0;
const server = http.createServer(async (req, res) => {
  hits++;
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const rows = [];
const check = (name, ok, info = '') => { rows.push({ name, ok, info }); };
let page;
let failed = false;
try {
  page = await openPage(chrome);
  const errors = [];
  page.on((m, p) => { if (m === 'Runtime.exceptionThrown') errors.push(p.exceptionDetails?.exception?.description || p.exceptionDetails?.text || '不明'); });
  await page.setViewport(375, 812, 'light');
  await page.goto(url);

  // 1. サービスワーカーが動きだし、配るファイルをしまい終えるまで待つ(最長10秒)
  const sw = await page.evaluate(`(async () => {
    if (!('serviceWorker' in navigator)) return { ok: false, why: 'この環境にサービスワーカーがない' };
    const t0 = Date.now();
    while (Date.now() - t0 < 10000) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.active && reg.active.state === 'activated') {
        const keys = await caches.keys();
        let n = 0;
        for (const k of keys) n += (await (await caches.open(k)).keys()).length;
        return { ok: true, caches: keys, files: n };
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return { ok: false, why: '10秒待っても登録が終わらなかった' };
  })()`);
  check('サービスワーカーの登録', sw.ok, sw.ok ? `キャッシュ ${sw.caches.join(', ')} に ${sw.files} 件` : sw.why);

  // 2. 通信ありの状態で、開けていること・幅375pxではみ出さないことを見る
  const online = await page.evaluate(`(async () => {
    await new Promise((r) => setTimeout(r, 3500)); // 待機画面が終わるのを待つ
    return { title: document.title, text: document.body.innerText.trim().length, overflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  check('通信ありで開く', online.text > 0, `題名「${online.title}」・文字 ${online.text} 字`);
  check('幅375pxで横にはみ出さない', online.overflow <= 0, `はみ出し ${Math.max(0, online.overflow)}px`);

  // 3. サーバーを止める(=通信を切る)。止まったことを確かめてから開き直す
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  let down = false;
  try { await fetch(url, { signal: AbortSignal.timeout(2000) }); } catch { down = true; }
  check('サーバーを止めた', down, down ? 'つながらないことを確かめた' : 'まだつながる');
  const hitsBefore = hits;

  let offline = { ok: false, why: '' };
  try {
    await page.goto(url);
    offline = await page.evaluate(`(async () => {
      await new Promise((r) => setTimeout(r, 3500));
      const styled = getComputedStyle(document.body).fontSize;
      return { ok: true, title: document.title, text: document.body.innerText.trim().length,
        controlled: !!navigator.serviceWorker.controller, css: document.styleSheets.length, fontSize: styled,
        scripts: !document.getElementById('splash') };
    })()`);
  } catch (e) { offline = { ok: false, why: e.message }; }
  check('通信なしで開く', offline.ok && offline.text > 0 && offline.controlled,
    offline.ok ? `題名「${offline.title}」・文字 ${offline.text} 字・サーバーへの問い合わせ ${hits - hitsBefore} 回` : offline.why);
  if (offline.ok) {
    check('通信なしでも見た目と動きが入る', offline.css > 0 && offline.scripts, `スタイル ${offline.css} 枚・待機画面は${offline.scripts ? '閉じた' : '残ったまま'}`);
  }
  check('ページの中のエラーなし', errors.length === 0, errors.slice(0, 3).join(' / '));
} catch (e) {
  check('確かめの実行', false, e.message);
} finally {
  if (page) await page.close();
  if (server.listening) server.close();
}

console.log('| 確かめたこと | 結果 | 中身 |');
console.log('|---|---|---|');
for (const r of rows) { console.log(`| ${r.name} | ${r.ok ? 'OK' : 'NG'} | ${r.info} |`); if (!r.ok) failed = true; }
console.log(failed ? '\nNG: 上の表の NG を直す。' : '\nOK: 全部通った(Chrome での結果。iPhone の Safari では未確認)。');
process.exit(failed ? 1 : 0);

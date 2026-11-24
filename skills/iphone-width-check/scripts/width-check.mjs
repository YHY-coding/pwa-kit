#!/usr/bin/env node
// 幅375px(iPhone の幅)で、明るい画面と暗い画面の数値を1枚の表にする。画面なしの Chrome を使う。
// 使い方: node width-check.mjs <URL> [--landscape] [--shot <画像の保存先.png>] [--wait <ミリ秒>] [--chrome <場所>]
// 画像は --shot を付けたときだけ、最後に1枚(暗い画面・縦)。数値が先、画像は最後。
// 要るもの: Node.js 22 以上と Chrome。iPhone の Safari そのものではない。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChrome, openPage, sleep } from '../../../lib/cdp.mjs';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const url = args.find((a) => /^https?:\/\//.test(a));
if (!url) { console.error('使い方: node width-check.mjs <URL> [--landscape] [--shot <png>] [--wait <ms>]'); process.exit(2); }
const chrome = findChrome(opt('--chrome'));
if (!chrome) { console.error('Chrome が見つからない。--chrome か CHROME_PATH で指定する。確かめは未実施。'); process.exit(2); }
const waitMs = Number(opt('--wait') || 3500);
const measure = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'measure.js'), 'utf8');

const cases = [
  { name: '縦 375×812・明', w: 375, h: 812, scheme: 'light' },
  { name: '縦 375×812・暗', w: 375, h: 812, scheme: 'dark' }
];
if (args.includes('--landscape')) cases.push({ name: '横 812×375・明', w: 812, h: 375, scheme: 'light' });

let page;
try { page = await openPage(chrome); } catch (e) { console.error('Chrome を起動できなかった(' + e.message + ')。確かめは未実施。'); process.exit(2); }
const out = [];
let failed = false;
try {
  for (const c of cases) {
    await page.setViewport(c.w, c.h, c.scheme);
    await page.goto(url);
    await sleep(waitMs); // 待機画面などが終わるのを待つ
    const m = await page.evaluate(measure);
    const ok = m.overflowPx === 0 && m.overflowCount === 0 && m.viewport.width === c.w && m.scheme === c.scheme;
    if (!ok) failed = true;
    out.push({ c, m, ok });
  }
  if (opt('--shot')) {
    const dark = cases[1];
    await page.setViewport(dark.w, dark.h, dark.scheme);
    await page.goto(url); await sleep(waitMs);
    writeFileSync(opt('--shot'), await page.screenshot());
  }
} catch (e) {
  await page.close();
  console.error('ページを開けなかった・測れなかった(' + e.message + ')。確かめは未実施。');
  process.exit(2);
} finally { await page.close(); }

console.log('| 画面 | 幅 | 横のはみ出し | はみ出す要素 | いちばん小さい文字 | 12px未満の文字 | 44px未満の押す所 | 文字と地の濃さの比 | 判定 |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const { c, m, ok } of out) {
  console.log(`| ${c.name} | ${m.viewport.width}px | ${m.overflowPx}px | ${m.overflowCount} | ${m.minFontPx}px | ${m.smallFontCount} | ${m.smallTapCount} | ${m.bodyContrast} | ${ok ? 'OK' : 'NG'} |`);
}
for (const { c, m } of out) {
  if (m.overflowTop.length) console.log(`\n${c.name} ではみ出す要素: ` + m.overflowTop.map((o) => `${o.el}(左${o.left}〜右${o.right})`).join(', '));
  if (m.smallTapTop.length) console.log(`\n${c.name} で小さい押す所: ` + m.smallTapTop.map((o) => `${o.el}(${o.w}×${o.h})`).join(', '));
}
console.log('\n判定は「横のはみ出しが0で、幅と明暗が指定どおりに効いているか」で付けている。文字・押す所・濃さの比は目安(Chrome での値。iPhone の Safari では未確認)。');
if (opt('--shot')) console.log('画像: ' + opt('--shot'));
process.exit(failed ? 1 : 0);

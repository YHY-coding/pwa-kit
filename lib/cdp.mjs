// 画面なしの Chrome を、追加の部品なしで動かすための小さな道具(Node.js 22 以上)。
// Chrome の「開発者ツールの通信」(CDP)を、Node に入っている WebSocket で話す。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';

/** 使える Chrome を探す。CHROME_PATH か引数が先。見つからなければ null */
export function findChrome(explicit) {
  const list = [];
  if (explicit) list.push(explicit);
  if (process.env.CHROME_PATH) list.push(process.env.CHROME_PATH);
  const home = homedir();
  for (const base of [join(home, 'Library', 'Caches', 'ms-playwright'), join(home, '.cache', 'ms-playwright')]) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter((n) => n.startsWith('chromium')).sort().reverse()) {
      for (const sub of readdirSync(join(base, d))) {
        list.push(join(base, d, sub, 'chrome-headless-shell'));
        list.push(join(base, d, sub, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'));
        list.push(join(base, d, sub, 'Chromium.app', 'Contents', 'MacOS', 'Chromium'));
        list.push(join(base, d, sub, 'chrome'));
      }
    }
  }
  list.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  );
  return list.find((p) => existsSync(p)) || null;
}

/** Chrome を起動して、1枚のページにつなぐ。戻り値 { send, on, close } */
export async function openPage(chromePath) {
  if (typeof WebSocket === 'undefined') throw new Error('Node.js 22 以上が要る(WebSocket が入っていない)');
  const profile = mkdtempSync(join(tmpdir(), 'pwa-kit-'));
  const proc = spawn(chromePath, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', 'about:blank'
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const giveUp = (msg) => { proc.kill(); try { rmSync(profile, { recursive: true, force: true }); } catch {} reject(new Error(msg)); };
    const timer = setTimeout(() => giveUp('Chrome が15秒以内に立ち上がらなかった'), 15000);
    proc.stderr.on('data', (d) => {
      buf += d;
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', (c) => { clearTimeout(timer); giveUp('Chrome が終了した(コード ' + c + ')'); });
  });

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('Chrome につなげなかった')); });
  let seq = 0;
  const waiting = new Map();
  const listeners = [];
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg.method, msg.params || {});
    }
  };
  const raw = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++seq;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

  const { targetId } = await raw('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await raw('Target.attachToTarget', { targetId, flatten: true });
  const send = (method, params) => raw(method, params, sessionId);
  await send('Page.enable');
  await send('Runtime.enable');

  return {
    send,
    on: (fn) => listeners.push(fn),
    /** ページの中で式を動かし、値を返す(Promise は待つ) */
    async evaluate(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('ページの中でエラー: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      return r.result.value;
    },
    /** 開いて、読み込みが終わるまで待つ。開けなければ例外 */
    async goto(url, timeoutMs = 15000) {
      const loaded = new Promise((resolve) => {
        const fn = (m) => { if (m === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(fn), 1); resolve(); } };
        listeners.push(fn);
      });
      const nav = await send('Page.navigate', { url });
      if (nav.errorText) throw new Error(nav.errorText);
      await Promise.race([loaded, new Promise((_, rej) => setTimeout(() => rej(new Error('読み込みが終わらなかった')), timeoutMs))]);
    },
    async setViewport(width, height, scheme) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile: true });
      await send('Emulation.setTouchEmulationEnabled', { enabled: true });
      if (scheme) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
    },
    async screenshot() {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(r.data, 'base64');
    },
    async close() {
      try { ws.close(); } catch {}
      proc.kill();
      await new Promise((r) => setTimeout(r, 300));
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    }
  };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

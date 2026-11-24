#!/usr/bin/env python3
"""sw.js の CACHE 番号の上げ忘れと、ASSETS(しまうファイルの一覧)の書きもれを調べる。読むだけ(--bump と --stamp を除く)。

使い方:
  cache-check.py <アプリのフォルダ>           調べる。問題があれば終了コード1
  cache-check.py <アプリのフォルダ> --bump    中身が変わっていれば CACHE の番号を1つ上げ、控えを更新する
  cache-check.py <アプリのフォルダ> --stamp   いまの状態を控えるだけ(番号を手で上げたあとに)

仕組み: 配るファイル全部のハッシュを .cache-stamp.json に控える。
中身が変わったのに CACHE の名前が控えと同じなら「上げ忘れ」とする。
"""
import argparse, hashlib, json, os, re, sys

STAMP = '.cache-stamp.json'
CACHE_RE = re.compile(r"(const\s+CACHE\s*=\s*['\"])([^'\"]*?-v)(\d+)(['\"])")
ASSETS_RE = re.compile(r"const\s+ASSETS\s*=\s*\[(.*?)\]", re.S)

def read_sw(app):
    path = os.path.join(app, 'sw.js')
    if not os.path.isfile(path):
        sys.exit(f'sw.js が見つからない: {path}')
    text = open(path, encoding='utf-8').read()
    m = CACHE_RE.search(text)
    if not m:
        sys.exit("sw.js に const CACHE = '名前-v数字' の行がない")
    a = ASSETS_RE.search(text)
    if not a:
        sys.exit('sw.js に const ASSETS = [...] がない')
    assets = re.findall(r"['\"]([^'\"]+)['\"]", a.group(1))
    return path, text, m, assets

def disk_files(app, ignore):
    out = []
    for root, dirs, files in os.walk(app):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            rel = os.path.relpath(os.path.join(root, f), app).replace(os.sep, '/')
            if f.startswith('.') or rel == 'sw.js' or rel in ignore:
                continue
            out.append(rel)
    return sorted(out)

def norm(asset):
    a = asset[2:] if asset.startswith('./') else asset
    return a or 'index.html'

def digest(app, files, sw_text):
    h = hashlib.sha256()
    for rel in files:
        h.update(rel.encode()); h.update(b'\0')
        h.update(open(os.path.join(app, rel), 'rb').read()); h.update(b'\0')
    h.update(CACHE_RE.sub(r'\1\2N\4', sw_text).encode())  # 番号そのものは数えない
    return h.hexdigest()

def main():
    ap = argparse.ArgumentParser(description='CACHE番号の上げ忘れとASSETSの書きもれを調べる')
    ap.add_argument('app')
    ap.add_argument('--bump', action='store_true')
    ap.add_argument('--stamp', action='store_true')
    ap.add_argument('--ignore', action='append', default=['README.md'],
                    help='配らないファイル(フォルダからの相対の名前)。何回でも指定できる')
    a = ap.parse_args()

    sw_path, sw_text, m, assets = read_sw(a.app)
    cache = m.group(2) + m.group(3)
    files = disk_files(a.app, set(a.ignore))
    listed = sorted({norm(x) for x in assets})
    missing_on_disk = [x for x in listed if x not in files]
    not_listed = [x for x in files if x not in listed]
    problems = []
    for x in missing_on_disk:
        problems.append(f'ASSETS にあるのにファイルがない: {x}(1つでも欠けると、しまう処理が丸ごと失敗する)')
    for x in not_listed:
        problems.append(f'ファイルがあるのに ASSETS にない: {x}(通信なしのとき開けない。配らないなら --ignore {x})')

    now = digest(a.app, files, sw_text)
    stamp_path = os.path.join(a.app, STAMP)
    stamp = json.load(open(stamp_path, encoding='utf-8')) if os.path.isfile(stamp_path) else None

    def write_stamp(name):
        json.dump({'cache': name, 'hash': now}, open(stamp_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

    if problems and (a.bump or a.stamp):
        print('\n'.join('NG  ' + p for p in problems))
        sys.exit('先に ASSETS を直す(何も書き換えていない)')

    if a.stamp:
        write_stamp(cache); print(f'控えた: {cache}'); return
    if a.bump:
        if stamp and stamp['hash'] == now:
            print(f'変わっていない。番号はそのまま: {cache}'); return
        if stamp and stamp['cache'] != cache:
            write_stamp(cache); print(f'番号は手で上げてある。控えだけ更新: {cache}'); return
        new = m.group(2) + str(int(m.group(3)) + 1)
        open(sw_path, 'w', encoding='utf-8').write(CACHE_RE.sub(lambda k: k.group(1) + new + k.group(4), sw_text, count=1))
        write_stamp(new); print(f'番号を上げた: {cache} → {new}'); return

    if stamp is None:
        problems.append('控え(.cache-stamp.json)がない。いまの状態が公開済みと同じなら --stamp、変えたあとなら --bump')
    elif stamp['hash'] != now and stamp['cache'] == cache:
        problems.append(f'上げ忘れ: 中身が変わったのに CACHE が {cache} のまま。--bump で上げる')
    elif stamp['hash'] != now:
        problems.append(f'番号は上がっている({stamp["cache"]} → {cache})が、控えが古い。--stamp で控える')

    print(f'CACHE: {cache} / ASSETS: {len(listed)}件 / 配るファイル: {len(files)}件')
    if problems:
        print('\n'.join('NG  ' + p for p in problems)); sys.exit(1)
    print('OK  上げ忘れなし・書きもれなし')

if __name__ == '__main__':
    main()

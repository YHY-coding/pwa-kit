#!/usr/bin/env python3
"""雛形から新しいPWAのフォルダを作る。

使い方:
  new-app.py <作る先のフォルダ> --name 'アプリの名前' --id app-id [--short '短い名前'] [--color '#2f5d50']

--id は半角の小文字・数字・ハイフン。保存の鍵とキャッシュの名前に使うので、あとから変えない。
作る先が空でないときは何もしない(上書きしない)。
"""
import argparse, os, re, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(HERE, '..', 'assets', 'template')
TEXT_EXT = ('.html', '.css', '.js', '.webmanifest', '.json', '.md')

def main():
    ap = argparse.ArgumentParser(description='雛形から新しいPWAを作る')
    ap.add_argument('dest')
    ap.add_argument('--name', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--short')
    ap.add_argument('--color', default='#2f5d50')
    a = ap.parse_args()
    short = a.short or a.name
    if not re.fullmatch(r'[a-z][a-z0-9-]{1,30}', a.id):
        sys.exit('--id は半角の小文字で始め、小文字・数字・ハイフンで2〜31文字')
    if not re.fullmatch(r'#[0-9a-fA-F]{6}', a.color):
        sys.exit('--color は #rrggbb の形')
    for label, v in (('--name', a.name), ('--short', short)):
        if not v.strip() or re.search(r'[<>&"\'\\\n]', v):
            sys.exit(f'{label} に使えない文字がある(< > & " \' \\ と改行は不可)')
    if os.path.exists(a.dest) and os.listdir(a.dest):
        sys.exit(f'作る先が空でない: {a.dest}(上書きしない)')

    shutil.copytree(TEMPLATE, a.dest, dirs_exist_ok=True)
    stale = os.path.join(a.dest, '.cache-stamp.json')
    if os.path.exists(stale):
        os.remove(stale)
    repl = {'__APP_NAME__': a.name, '__APP_SHORT__': short, '__APP_ID__': a.id, '__THEME__': a.color}
    for root, _, files in os.walk(a.dest):
        for f in files:
            if f.endswith(TEXT_EXT):
                p = os.path.join(root, f)
                s = open(p, encoding='utf-8').read()
                for k, v in repl.items():
                    s = s.replace(k, v)
                open(p, 'w', encoding='utf-8').write(s)
    subprocess.run([sys.executable, os.path.join(HERE, 'make-icons.py'), os.path.join(a.dest, 'icons'), '--color', a.color], check=True)
    subprocess.run([sys.executable, os.path.join(HERE, 'cache-check.py'), a.dest, '--stamp'], check=True)
    print(f'\nできた: {a.dest}')
    print(f'手元で開く: python3 -m http.server 8000 --bind 127.0.0.1 --directory "{a.dest}"  →  http://localhost:8000/')

if __name__ == '__main__':
    main()

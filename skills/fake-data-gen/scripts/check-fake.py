#!/usr/bin/env python3
"""架空データのファイルに、本物に見えるものが混ざっていないかを調べる。読むだけ。

使い方: check-fake.py <ファイル>...
1件でもあれば終了コード1。0件なら「0件」と出して終了コード0。
調べるもの: メール・URL・電話に見える番号・郵便番号の形・7桁以上の数字の並び(口座やカードに見える)・
  利用者のフォルダを含む絶対パス・会社や銀行を表す語・よくある名字・「架空」の目印がないこと。
これは形の検査。本物の情報かどうかの判定ではない。秘密情報の検索(鍵・トークンなど)は別の道具で行う。
"""
import re, sys

RULES = [
    ('メールアドレス', re.compile(r'[\w.+-]+@[\w-]+\.[\w.-]+')),
    ('URL', re.compile(r'https?://')),
    ('電話に見える番号', re.compile(r'(?<!\d)0\d{1,4}-\d{1,4}-\d{3,4}(?!\d)')),
    ('郵便番号の形', re.compile(r'(?<![\d-])\d{3}-\d{4}(?![\d-])')),
    ('7桁以上の数字の並び', re.compile(r'(?<!\d)\d(?:[ -]?\d){6,}(?!\d)')),
    ('絶対パス', re.compile(r'/(?:Users|home)/[^/\s]+|[A-Za-z]:\\{1,2}')),
    ('会社・銀行を表す語', re.compile(r'株式会社|有限会社|合同会社|㈱|銀行|信用金庫|支店')),
    ('よくある名字', re.compile(r'佐藤|鈴木|高橋|田中|伊藤|渡辺|山本|中村|小林|加藤|吉田|山田|佐々木|山口|松本|井上|木村|斎藤|斉藤')),
]
DATE_LIKE = re.compile(r'\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?')

def scan(path):
    hits = []
    try:
        lines = open(path, encoding='utf-8').read().splitlines()
    except (OSError, UnicodeDecodeError) as e:
        return [(0, '読めない', str(e))]
    if '架空' not in '\n'.join(lines[:5]):
        hits.append((1, '先頭に「架空」がない', '最初の5行に目印がない'))
    for no, line in enumerate(lines, 1):
        body = DATE_LIKE.sub('<日時>', line)  # 日付と時刻は数字の並びとして数えない
        for name, rx in RULES:
            for m in rx.finditer(body):
                hits.append((no, name, m.group(0)))
    return hits

def main():
    if len(sys.argv) < 2:
        sys.exit('使い方: check-fake.py <ファイル>...')
    total = 0
    print('| ファイル | 行 | 種類 | 見つかったもの |')
    print('|---|---|---|---|')
    for path in sys.argv[1:]:
        for no, name, text in scan(path):
            total += 1
            print(f'| {path} | {no} | {name} | {text} |')
    if total:
        print(f'\nNG: {total}件。試験用でも、このままでは使わない(作り直すか、該当の行を直す)。')
        sys.exit(1)
    print(f'\n0件({len(sys.argv) - 1}ファイル)。形の検査で、本物に見えるものは見つからなかった。')

if __name__ == '__main__':
    main()

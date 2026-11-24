#!/usr/bin/env python3
"""試験用の架空データを作る(家計・予定・PWA雛形の読み込み用)。実データは読まない・使わない。

使い方:
  gen-fake.py --kind kakeibo --count 30 --format csv  --out 架空_家計.csv
  gen-fake.py --kind yotei   --count 20 --format json --out 架空_予定.json
  gen-fake.py --kind records --app-id my-app --count 15 --out 架空_記録.json

決まり:
  - 人・店・場所の名前は「利用者A」「架空商店01」のように、ひと目で作り物と分かる形だけ。
  - 口座・カード・電話・郵便番号に見える数字の並びを作らない(7桁以上の数字を出さない)。
  - 先頭に「架空」と入れる。CSV は1行目が注記(# 架空データ…)、JSON は最初の項目 "_note"。
  - 同じ --seed なら同じ結果になる。
"""
import argparse, csv, io, json, random, sys
from datetime import date, datetime, timedelta

NOTE = '架空データ(試験用)。実在の人物・店・団体・口座とは関係ありません'
LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
EXPENSE = ['食費', '日用品', '交通', '通信', '水道光熱', '住まい', '医療', '娯楽', '学び', 'その他']
INCOME = ['給与(架空)', '臨時収入(架空)']
PAY = ['現金', 'カードA', 'カードB', '電子マネーA', '口座振替(架空)']
EVENTS = ['打ち合わせ', '買い出し', '手続き', '運動', '掃除', '読書', '提出の締め切り', '家族の用事', '点検', '集まり']
PLACES = ['架空会議室1', '架空会議室2', '架空公園', '架空センター', '自宅', '架空駅前']
MEMOS = ['試験用の記録', '架空の買い物', '見本の一行', '長い文の確かめ用に、わざと少し長めに書いた架空の一行です', '短い', '絵文字なしの見本', '数字 12 を含む見本']

def gen_kakeibo(rnd, n, start):
    rows = []
    d = start
    for i in range(n):
        d += timedelta(days=rnd.choice([0, 0, 1, 1, 2]))
        income = rnd.random() < 0.08
        amount = rnd.randrange(50, 400) * 1000 if income else rnd.choice([rnd.randrange(1, 50) * 10 + 100, rnd.randrange(5, 120) * 100])
        rows.append({
            '番号': f'架空-{i + 1:04d}', '日付': d.isoformat(), '区分': '収入' if income else '支出',
            '費目': rnd.choice(INCOME if income else EXPENSE), '金額': amount,
            '支払方法': '—' if income else rnd.choice(PAY),
            '店': '—' if income else f'架空商店{rnd.randrange(1, 13):02d}', 'メモ': rnd.choice(['', '', '試験用', '架空の買い物'])
        })
    return rows

def gen_yotei(rnd, n, start):
    rows = []
    d = start
    for i in range(n):
        d += timedelta(days=rnd.choice([0, 1, 1, 2, 3]))
        h = rnd.randrange(7, 21); m = rnd.choice([0, 15, 30, 45]); dur = rnd.choice([30, 45, 60, 90, 120])
        s = datetime(d.year, d.month, d.day, h, m); e = s + timedelta(minutes=dur)
        rows.append({
            '番号': f'架空-{i + 1:04d}', '日付': d.isoformat(), '開始': s.strftime('%H:%M'), '終了': e.strftime('%H:%M'),
            '題名': rnd.choice(EVENTS) + '(架空)', '場所': rnd.choice(PLACES),
            '相手': rnd.choice(['', '利用者' + rnd.choice(LETTERS), '利用者' + rnd.choice(LETTERS) + 'ほか'])
        })
    return rows

def gen_records(rnd, n, start, app_id):
    items = []
    t = datetime(start.year, start.month, start.day, 8, 0)
    for i in range(n):
        t += timedelta(minutes=rnd.randrange(20, 900))
        items.append({'id': f'kakuu-{i + 1:04d}', 'text': '(架空)' + rnd.choice(MEMOS), 'createdAt': t.strftime('%Y-%m-%dT%H:%M:%S.000Z')})
    return {'_note': NOTE, 'app': app_id, 'format': 1, 'exportedAt': t.strftime('%Y-%m-%dT%H:%M:%S.000Z'), 'items': items}

def main():
    ap = argparse.ArgumentParser(description='試験用の架空データを作る')
    ap.add_argument('--kind', required=True, choices=['kakeibo', 'yotei', 'records'])
    ap.add_argument('--count', type=int, default=20)
    ap.add_argument('--format', choices=['csv', 'json'], default=None, help='records は json だけ')
    ap.add_argument('--seed', type=int, default=1)
    ap.add_argument('--start', default='2030-01-01', help='最初の日付(YYYY-MM-DD)')
    ap.add_argument('--app-id', default='sample-app', help='records のとき、読み込ませるアプリの id')
    ap.add_argument('--out', help='保存先。省くと画面に出す')
    a = ap.parse_args()
    if not 1 <= a.count <= 5000:
        sys.exit('--count は 1〜5000')
    try:
        start = date.fromisoformat(a.start)
    except ValueError:
        sys.exit('--start は YYYY-MM-DD の形')
    rnd = random.Random(a.seed)
    fmt = a.format or ('json' if a.kind == 'records' else 'csv')

    if a.kind == 'records':
        if fmt != 'json':
            sys.exit('records は json だけ')
        text = json.dumps(gen_records(rnd, a.count, start, a.app_id), ensure_ascii=False, indent=2) + '\n'
    else:
        rows = gen_kakeibo(rnd, a.count, start) if a.kind == 'kakeibo' else gen_yotei(rnd, a.count, start)
        if fmt == 'json':
            text = json.dumps({'_note': NOTE, 'kind': a.kind, 'rows': rows}, ensure_ascii=False, indent=2) + '\n'
        else:
            buf = io.StringIO()
            buf.write('# ' + NOTE + '\n')
            w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), lineterminator='\n')
            w.writeheader(); w.writerows(rows)
            text = buf.getvalue()
    if a.out:
        with open(a.out, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'作成: {a.out}({a.kind}・{a.count}件・seed {a.seed})', file=sys.stderr)
    else:
        sys.stdout.write(text)

if __name__ == '__main__':
    main()

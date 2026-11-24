---
name: fake-data-gen
description: This skill should be used when the user asks to "架空データを作って", "テスト用のデータがほしい", "ダミーの家計データをCSVで", "予定の見本データをJSONで", "サンプルデータを入れて動きを確かめたい", or needs sample data for a household-ledger app, a schedule app, or an app made from this plugin's PWA template. It generates clearly fictional test data (CSV / JSON) with a script and checks the result for anything that looks real. Do not use it to anonymize or mask real data, to produce realistic personal names, company names, or account-like numbers, or for load tests that need 5,000+ rows.
---

# 試験用の架空データを作る

アプリの試験や見本の画面に使う架空データを、スクリプトで作る。実データは読まない・加工しない(実データを「ぼかす」用途には使わない。ぼかしても元の人に結びつくおそれが残る)。

## 決まり

1. **名前は、ひと目で作り物と分かる形だけ。** 「利用者A」「架空商店01」「架空会議室1」。実在しそうな氏名・社名を作らない。
2. **口座・カード・電話・郵便番号に見える数字の並びを作らない。** 7桁以上の数字を出さない。
3. **先頭に「架空」と入れる。** CSV は1行目が注記(`# 架空データ…`)、JSON は最初の項目 `_note`。ファイル名も `架空_` で始める。
4. 作ったら、必ず検査(下の手順3)にかけ、0件を確かめてから使う。
5. 手で書き足すとき(スクリプトにない種類のデータが要るとき)も、1〜4を守る。

## 手順

`SKILL_DIR` は環境変数ではない。コマンドを動かす前に、この SKILL.md のあるフォルダの絶対の場所(スキルが読み込まれたときに示される、このスキルの基準フォルダ)に置き換える。

### 1. 種類を選ぶ

| `--kind` | 中身 | 形式 |
|---|---|---|
| `kakeibo` | 家計(番号・日付・区分・費目・金額・支払方法・店・メモ) | csv / json |
| `yotei` | 予定(番号・日付・開始・終了・題名・場所・相手) | csv / json |
| `records` | 同じ箱の PWA 雛形(`pwa-scaffold`)に読み込める記録。`--app-id` にそのアプリの id を渡す | json |

### 2. 作る

```bash
python3 "$SKILL_DIR/scripts/gen-fake.py" --kind kakeibo --count 30 --format csv --out 架空_家計.csv
python3 "$SKILL_DIR/scripts/gen-fake.py" --kind yotei --count 20 --format json --out 架空_予定.json
python3 "$SKILL_DIR/scripts/gen-fake.py" --kind records --app-id my-app --count 15 --out 架空_記録.json
```

- `--seed`(初期値1): 同じ数なら同じ結果になる。試験を繰り返すときは固定する。
- `--start`(初期値 2030-01-01): 最初の日付。今日の日付に合わせたいときは指定する。
- `--count`: 1〜5000。
- CSV の1行目は注記なので、読む側は `#` で始まる行を飛ばす。飛ばせない道具に渡すときは JSON を使う。

置き場所は、試験用のフォルダにする。配るフォルダ(公開する場所)に置かない。

### 3. 検査する

```bash
python3 "$SKILL_DIR/scripts/check-fake.py" 架空_家計.csv 架空_予定.json
```

メール・URL・電話や郵便番号の形・7桁以上の数字の並び・利用者のフォルダを含む絶対パス・会社や銀行を表す語・よくある名字・「架空」の目印の有無を調べ、「ファイル・行・種類・見つかったもの」の表を出す。**1件でもあれば終了コード1。そのデータは使わず、作り直すか該当の行を直す。** 例外の許可は作らない。

これは形の検査で、本物の情報かどうかを判定するものではない。鍵やトークンなどの秘密情報の検索は含まない。外に公開するものに入れる前には、公開前の検索の道具(別のスキルやスクリプト)にもかける。

### 4. 使う

- PWA 雛形のアプリには、「設定 → 読み込み」で `records` の JSON を選ぶ。いまのデータは置き換わるので、試験用の環境で行う。
- 試験が済んだら、架空データを入れたままのアプリを公開しない(見本として見せる場合は、画面に「架空」と分かる表示が残っていることを確かめる)。

## 報告に書くこと

作ったファイル・種類・件数・seed、検査の結果(0件か、何件か)。検査していないファイルは「未検査」と書く。

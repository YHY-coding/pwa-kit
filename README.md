# pwa-kit(小さなPWAを作る・試す・幅を確かめる)

Claude Code 用のプラグインです。名前は仮です。

端末の中だけで動く小さなPWA(ホーム画面に追加でき、通信なしでも開くウェブアプリ)を、雛形から作り、架空データで試し、iPhone の幅で確かめるための、スキル3つとスクリプトが入っています。

## 何をするか

| スキル | すること | 付いているもの |
|---|---|---|
| `pwa-scaffold` | 雛形から新しいPWAのフォルダを作る。作ったあと、通信なしで開くか、`sw.js` の番号(CACHE)の上げ忘れがないかを確かめる | 雛形一式、`new-app.py`、`cache-check.py`、`offline-check.mjs`、`make-icons.py` |
| `fake-data-gen` | 試験用の架空データ(家計・予定・雛形に読み込める記録)を CSV / JSON で作り、本物に見えるものが混ざっていないかを調べる | `gen-fake.py`、`check-fake.py` |
| `iphone-width-check` | 画面を幅375px・明るい画面と暗い画面で測り、結果を表1枚にする。数値が先、画像は最後に1枚まで | `measure.js`、`width-check.mjs` |

### 雛形に入っているもの

- 待機画面(起動時の演出)。読み込みが終わるまで本体を見せない。押すと飛ばせる。動きを減らす設定のときは動かない
- 一覧と入力(入力は画面の下)。本文18px、押す所は44px以上、差し色は1色
- 明るい画面と暗い画面
- 書き出し(JSON)・読み込み・全削除(確かめの印を付けてから押す)
- サービスワーカー(配るファイルを端末にしまう。新しい版があると「更新する」の帯を出す)
- アイコン3枚(罫線3本の絵。追加の部品なしで作り直せる)
- 画面(`js/app.js`)と保存(`js/store.js`)を分けた作り。保存先は端末のブラウザの中で、外へは送らない

### CACHE の上げ忘れを防ぐ仕組み

配るファイル全部のハッシュを控え(`.cache-stamp.json`)に残します。中身が変わったのに `sw.js` の `CACHE` の名前が控えと同じなら、`cache-check.py` が「上げ忘れ」と出して終了コード1で終わります。`sw.js` の一覧(ASSETS)とフォルダの中身の食い違いも調べます。`--bump` を付けると、変わっているときだけ番号を1つ上げます。

## 入れ方

手元のフォルダから試すとき:

```
claude --plugin-dir ./pwa-kit
```

マーケットプレイスからの入れ方は、置き場所が決まってから書きます(未定)。

## 使い方

Claude に、たとえば次のように頼みます。

- 「読書の記録をつけるPWAを作って。名前は『読んだ本』」→ `pwa-scaffold`
- 「テスト用の架空の家計データを30件、CSVで」→ `fake-data-gen`
- 「iPhone の幅で崩れていないか確かめて」→ `iphone-width-check`

スクリプトは、Claude を通さずに直接動かせます。`.mjs` の2本は箱の直下の `lib/cdp.mjs` を読み込むので、スキルのフォルダだけを別の場所に写すと動きません(箱ごと置いてください)。

```
python3 skills/pwa-scaffold/scripts/new-app.py ./my-app --name 'アプリの名前' --id my-app
python3 skills/pwa-scaffold/scripts/cache-check.py ./my-app
node    skills/pwa-scaffold/scripts/offline-check.mjs ./my-app
python3 skills/fake-data-gen/scripts/gen-fake.py --kind kakeibo --count 30 --out 架空_家計.csv
python3 skills/fake-data-gen/scripts/check-fake.py 架空_家計.csv
node    skills/iphone-width-check/scripts/width-check.mjs http://localhost:8000/
```

### 要るもの

| もの | どれに要るか |
|---|---|
| Python 3(標準の機能だけ) | `new-app.py`・`cache-check.py`・`make-icons.py`・`gen-fake.py`・`check-fake.py` |
| Node.js 22 以上と、Chrome か Chromium | `offline-check.mjs`・`width-check.mjs`(追加の部品は入れない。Chrome の場所は自動で探し、見つからなければ `--chrome` か `CHROME_PATH` で指定) |

## やらないこと

- **外への公開をしません。** GitHub Pages などに置く手順は入っていません。公開の前の検索(鍵・個人情報など)も、このプラグインの範囲外です。
- **サーバー・ログイン・データの共有を作りません。** 雛形は、端末の中だけで動くアプリ用です。
- **実データを扱いません。** `fake-data-gen` は実データを読まず、ぼかす用途にも使いません。
- **実機の iPhone を動かしません。** 幅の確かめは Chrome(か、Claude のブラウザの道具)で行います。
- フック・MCPサーバーは入っていません。スクリプトは手元だけで動き、外へ通信しません(`offline-check.mjs` と `width-check.mjs` は、手元のサーバーと手元の Chrome の間だけで通信します。`width-check.mjs` に外の URL を渡したときは、その URL を開きます)。

## 確かめたこと・未確認のこと

作者が、架空の見本アプリ(「ひとこと帳」)と架空データで確かめた範囲です(2026-11-23、macOS、Chromium)。

| 確かめたこと | 結果 |
|---|---|
| 雛形から見本アプリを作る | できた。印(`__APP_NAME__` など)の残りなし |
| サービスワーカー登録のあと、サーバーを止めて開き直す | 開いた(サーバーへの問い合わせ0回) |
| 幅375px・明るい画面と暗い画面・横向き | 横のはみ出し0px |
| わざと崩したページ(幅480pxの箱) | はみ出し105pxと、その要素が出た |
| 中身だけ変えて番号を上げない | 「上げ忘れ」・終了コード1。`--bump` で番号が上がり、開き直すと「更新する」の帯が出て、押すと新しい版に替わった |
| 待機画面 | 読み込み中は本体が隠れている。押すとすぐ開く。動きを減らす設定では動かない |
| 架空データ5ファイル(家計・予定・記録)を検査 | 0件 |
| 本物に見える語を仕込んだファイルを検査 | 仕込んだ種類が全部、表に出た |

**未確認:**

- **実機の iPhone(Safari・ホーム画面への追加・アイコンの見え方・書き出したファイルの保存)。** 一度も確かめていません。`references/ios-notes.md` の内容も、実機で確かめたものではありません。
- Windows・Linux での動き。Chrome 以外のブラウザ。Node.js 22 より前。
- スキルが、当てはまる場面でどのくらいの割合で読まれるか。スキルは、Claude が「当てはまる」と判断したときに読まれる説明書きで、読まれないこともあります。
- 44px・12px・濃さの比4.5 などの数値は目安で、この雛形で使いやすさを測ったわけではありません。
- localStorage の容量の上限、長く開かなかったときにデータが消える条件。

日本語のみ。無保証です。サポートの約束はありません。

## ライセンス

MIT License(`LICENSE`)。誰でも使えますが、無保証です。

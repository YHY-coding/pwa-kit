---
name: pwa-scaffold
description: This skill should be used when the user asks to "PWAを作って", "ホーム画面に追加できるアプリを作りたい", "オフラインで開くウェブアプリの雛形がほしい", "端末の中だけに保存する小さなアプリを作る", "sw.js の CACHE を上げ忘れていないか確かめて", or starts a new small web app that keeps its data on the device. It scaffolds a device-local PWA from a bundled template (manifest, service worker, splash screen, export / import / delete-all) and checks for a forgotten cache-version bump. Do not use it for apps that need a server, a login, or a framework build (React, Next.js など), or for editing an existing app that was not made from this template.
---

# PWA の雛形から新しいアプリを作る

端末の中だけで動く小さなPWA(ホーム画面に追加でき、通信なしでも開くウェブアプリ)を、同梱の雛形から作る。作ったあと、通信なしで開くことと、`sw.js` の番号の上げ忘れがないことを、スクリプトで確かめる。

雛形に入っているもの: 待機画面(起動時の演出)、一覧と入力、書き出し(JSON)、読み込み、全削除、明るい画面と暗い画面、サービスワーカー、アイコン3枚。保存先は端末のブラウザの中(localStorage)で、外へは送らない。

## 使う前に確かめること

- サーバー・ログイン・複数人での共有が要るなら、この雛形の範囲外。その旨を伝え、バックエンドを別に設計する(費用と、保存する個人情報の有無を、作る前に利用者に出す)。
- 見本や試験のデータは架空のものだけを使う(同じ箱の `fake-data-gen`)。実データを雛形や見本に入れない。
- 公開(GitHub Pages など外に置くこと)は、このスキルではしない。利用者の承認を取ってから、別の手順で行う。

## 手順

以下のコマンドの `SKILL_DIR` は環境変数ではない。コマンドを動かす前に、この SKILL.md のあるフォルダの絶対の場所(スキルが読み込まれたときに示される、このスキルの基準フォルダ)に置き換える。

### 1. 名前と id を決める

| 決めるもの | 決まり |
|---|---|
| 名前(`--name`) | 画面とホーム画面に出る。`< > & " ' \` は使えない |
| 短い名前(`--short`) | ホーム画面のアイコンの下に出る。省くと名前と同じ。全角6文字くらいまでが切れにくい(目安) |
| id(`--id`) | 半角の小文字で始め、小文字・数字・ハイフンで2〜31文字。保存の鍵とキャッシュの名前になる。**あとから変えると、保存したデータが見えなくなる** |
| 差し色(`--color`) | `#rrggbb`。1色だけ。省くと深い緑 |

### 2. 作る

```bash
python3 "$SKILL_DIR/scripts/new-app.py" <作る先のフォルダ> --name 'アプリの名前' --id app-id
```

作る先が空でないときは、スクリプトは何もしない(上書きしない)。

### 3. 中身をそのアプリに合わせて書き換える

- 画面は `index.html`・`style.css`・`js/app.js`、保存は `js/store.js`。**画面から保存に触るのは `store.js` の関数だけ**にする。保存先をサーバーに替えるときに、画面側を書き換えずに済む。
- 項目を増やすときは、`store.js` の `isItem`(形の検査)・`add`・`importAll` を一緒に直す。書き出しと読み込みで形がずれると、読み込めなくなる。
- 見た目の決まりと、待機画面を作り替えるときの条件は `references/design-notes.md` を読む。
- 利用者の入力を画面に出すときは `textContent` を使う(`innerHTML` に入れない)。
- ファイルを足したら、`sw.js` の `ASSETS` に足す。1つでも欠けると、しまう処理が丸ごと失敗し、通信なしで開けなくなる。

### 4. 手元で開いて確かめる

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory <アプリのフォルダ>
```

`http://localhost:8000/` を開く(サービスワーカーは `localhost` か https でしか動かない。ファイルを直接開いても動かない)。

通信なしで開くかは、スクリプトで確かめる(Node.js 22 以上と Chrome が要る)。

```bash
node "$SKILL_DIR/scripts/offline-check.mjs" <アプリのフォルダ>
```

Chrome は自動で探す(見つからなければ `--chrome <場所>` か、環境変数 `CHROME_PATH`)。フォルダを配る → 幅375pxで開く → サービスワーカーの登録を待つ → サーバーを止める → 開き直す、までを行い、結果を表で出す。NG があれば終了コード1。Chrome が見つからないときは「未実施」と出るので、**確かめていないことをそのまま報告する**(通ったことにしない)。

幅・明るい画面と暗い画面の確かめは、同じ箱の `iphone-width-check` を使う。

### 5. ファイルを変えるたびに: CACHE の番号

配るファイルを1つでも変えたら、`sw.js` の `CACHE` の番号を上げる。上げないと、すでに開いたことのある端末に古い画面が残る。

```bash
python3 "$SKILL_DIR/scripts/cache-check.py" <アプリのフォルダ>          # 調べる(読むだけ)
python3 "$SKILL_DIR/scripts/cache-check.py" <アプリのフォルダ> --bump   # 変わっていれば番号を上げる
```

| 出た結果 | すること |
|---|---|
| `OK 上げ忘れなし・書きもれなし` | そのまま進む |
| `上げ忘れ` | `--bump` |
| `ASSETS にない` / `ファイルがない` | `sw.js` の `ASSETS` を直す。配らないファイルなら `--ignore <名前>` |
| `番号は上がっているが、控えが古い` | 番号を手で上げたあと。`--stamp` で控える |
| `控えがない` | 公開済みと同じ状態なら `--stamp`、変えたあとなら `--bump` |

**外に置く前には、必ず調べて OK を確かめる。** 控え(`.cache-stamp.json`)は、アプリのフォルダと一緒に残す(消すと、上げ忘れを見つけられない)。

## 報告に書くこと

- 作ったフォルダ、名前、id
- `cache-check.py` と `offline-check.mjs` の結果(表をそのまま)
- 確かめていないこと。**実機の iPhone(Safari・ホーム画面に追加)での動きは、このスキルでは確かめられない**ので、未確認と書く

## 参考資料

- `references/design-notes.md` — 見た目の決まり、待機画面の条件、避ける見た目
- `references/ios-notes.md` — iPhone で起きやすいこと(アイコンの入れ直し、保存が消える場合、書き出しの動き)と、未確認の点
- `assets/template/` — 雛形の本体(`__APP_NAME__` などの印は `new-app.py` が置き換える)
- `scripts/make-icons.py` — アイコン3枚を作り直す(`--color`)

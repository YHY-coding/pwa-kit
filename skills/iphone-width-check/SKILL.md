---
name: iphone-width-check
description: This skill should be used when the user asks to "iPhoneの幅で確認して", "スマホで崩れていないか見て", "375pxではみ出していないか確かめて", "ダークモードでも確認して", "実機確認の代わりに見ておいて", or after a web app's screen has been changed and needs a phone-width check. It checks a page at 375px wide in light and dark schemes using numbers first (overflow, font size, tap-target size, contrast) and at most one screenshot at the end, and reports the result in one table. Do not use it for desktop layouts, full accessibility audits, or as proof that the page works on a real iPhone (it cannot test real Safari, home-screen install, or touch behaviour).
---

# iPhone の幅で画面を確かめる

ウェブアプリの画面を、幅375px(iPhone の幅)・明るい画面と暗い画面で確かめ、結果を表1枚にする。

**画像を何枚も読まない。** 画像は読むたびに多くの使用量がかかり、はみ出しの量や文字の大きさは画像より数値のほうが正確に分かる。順番は、①数値 → ②ページの文字 → ③最後に画像1枚。

## 手順

`SKILL_DIR` は環境変数ではない。コマンドを動かす前に、この SKILL.md のあるフォルダの絶対の場所(スキルが読み込まれたときに示される、このスキルの基準フォルダ)に置き換える。確かめる相手は、手元のサーバー(`http://localhost:…`)か、利用者が見てよいと言った URL。

### A. ブラウザを操作する道具がある場合

道具の名前は環境によって違う。要るのは「表示の大きさを変える」「明暗を切り替える」「ページの中で JavaScript を動かす」「ページの文字や構造を読む」「画面を撮る」の5つ。

1. 表示を **375×812・明るい画面** にして、ページを開く(待機画面があるなら、終わるまで数秒待つ)。
2. `scripts/measure.js` の中身を、そのまま「ページの中で JavaScript を動かす」機能に渡す。返ってきた数値を控える。
3. ページの文字・構造を読む道具で、見出し・ボタン・入力欄が出ているか、言葉が切れていないかを確かめる(画像は使わない)。
4. 表示を **375×812・暗い画面** にして開き直し、2 をもう一度行う。`scheme` が `dark` になっていること、地の色が明るい画面のときと違うことを確かめる(同じなら、暗い画面に対応していないか、切り替えが効いていない)。
5. 利用者が横向きも求めたときだけ、812×375 で 2 を行う。
6. **最後に画像を1枚だけ撮る**(数値で問題のあった画面。なければ暗い画面)。縮小できる道具なら縮小して読む。数値では分からない点(重なり、意図しない帯、切れた絵)だけを見る。
7. 表示の大きさと明暗を、元に戻す。

### B. 道具がない場合(Node.js 22 以上と Chrome がある)

```bash
node "$SKILL_DIR/scripts/width-check.mjs" http://localhost:8000/ [--landscape] [--shot 画面.png]
```

明るい画面と暗い画面を順に測り、表を出す。終了コードは、0=全部OK/1=NGあり(横のはみ出しがある、または幅・明暗が指定どおりに効いていない)/2=確かめを実施できなかった(Chrome が見つからない・起動できない)。Chrome は自動で探す(見つからなければ `--chrome <場所>` か、環境変数 `CHROME_PATH`)。`--shot` を付けたときだけ、最後に1枚(暗い画面)を保存する。待機画面が長いアプリは `--wait <ミリ秒>` を延ばす(初期値3500)。

### C. どちらもない場合

確かめは「未実施」と報告する。通ったことにしない。利用者に、実機での見るべき点(横に動かないか・文字が小さくないか・暗い画面で読めるか)を伝える。

## 数値の読み方

| 項目(`measure.js` の名前) | 見方 |
|---|---|
| `overflowPx` | 横のはみ出し。**0 でなければ NG** |
| `overflowTop` | はみ出している要素と、その左右の位置。直す場所の手がかり |
| `layoutWidth` | 375 より大きければ、ブラウザが全体を縮めて見せている(中身が幅を超えている) |
| `minFontPx`・`smallFontCount` | いちばん小さい文字と、12px 未満の数。入力欄は16px 未満だと iPhone で拡大が起きる |
| `smallTapCount`・`smallTapTop` | 44px に満たない、押す所。目安なので、文中のリンクなどは判断して外す |
| `bodyContrast` | 本文の文字と地の色の濃さの比。4.5 以上が目安。本文だけを見ており、薄い色の補助の文字は見ていない |
| `scheme` | いま効いている明暗 |

判定(OK / NG)は「横のはみ出しが0で、幅と明暗が指定どおりに効いているか」で付ける。ほかの項目は目安として表に載せ、直すかどうかは理由を添えて利用者に出す。

## 報告

`references/report-template.md` の表1枚にまとめる。必ず書くこと:

- 何で確かめたか(ブラウザの道具か、`width-check.mjs` か)と、その URL
- **実機の iPhone では確かめていないこと**(Safari の表示、ホーム画面への追加、指での操作)
- 読んだ画像の枚数(1枚まで)

## 参考資料

- `references/report-template.md` — 報告の表のひな形と、書き方の例
- `scripts/measure.js` — ページの中で動かす測定の式(ページを書き換えない)
- `scripts/width-check.mjs` — 画面なしの Chrome で測るスクリプト

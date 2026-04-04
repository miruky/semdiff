# semdiff

[![CI](https://github.com/miruky/semdiff/actions/workflows/ci.yml/badge.svg)](https://github.com/miruky/semdiff/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Test](https://img.shields.io/badge/Test-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**JSONをテキストの行ではなく値の構造として比較する意味的diffビューアです。キーの並び替えと整形の違いは差分にしません。**

## 概要

2つのJSONを貼ると、構造を再帰的に突き合わせて追加・削除・変更をパスつきで一覧します。行ベースのdiffと違い、キーの順序が入れ替わっても、インデントや改行が変わっても差分になりません。配列はLCS(最長共通部分列)で要素を対応付けるため、配列の途中に1件挿入しただけで後続すべてが「変更」と誤検出される行diffの典型的な問題が起きません。

動かす: https://miruky.github.io/semdiff/

### なぜ作ったのか

設定ファイルやAPIレスポンスの比較で行diffを使うと、フォーマッタの並び替えやインデント変更が大量の偽差分になり、本当の変更が埋もれます。「意味として何が変わったのか」だけを知りたい場面のための専用ビューアです。`package.json` のバージョン比較、IaCの状態ファイルの確認、APIの新旧レスポンスの突き合わせを想定しています。

## 使い方

1. 変更前・変更後のJSONをそれぞれ貼る(「サンプルを読み込む」で動作を試せる)
2. 構造diffに追加(緑)・削除(赤)・変更(黄)がパスつきで表示される
3. 「変更のない項目を畳む」で差分だけに絞り、件数バッジで規模を把握する

### 差分の出かたの例

| 変更                        | 表示                                                        |
| :-------------------------- | :---------------------------------------------------------- |
| `version` の値変更          | `変更 version "1.4.0" → "2.0.0"`                            |
| `dependencies` にキー追加   | `追加 dependencies.zod "^3.23.0"`                           |
| 配列 `tags` の途中に挿入    | 挿入された要素だけが `追加 tags[1]`(後続は変更扱いされない) |
| 型の変化(配列→オブジェクト) | 中身を展開せず1件の変更として表示                           |

JSON以外(YAML・TOML・コード)は対象外です。コメント付きJSON(JSONC)も標準の `JSON.parse` で読めないため受け付けません。

## アーキテクチャ

![semdiffのアーキテクチャ](docs/architecture.svg)

比較ロジック(`lib/diff`)はDOMに依存しない純粋なモジュールで、深い等価判定、オブジェクトのキー集合の突き合わせ、配列のLCS対応付け、葉の変更だけを数える集計からなります。UIはDiffNode木を折りたたみ表示に写すだけの薄い層です。LCSは動的計画法のテーブルを `Uint32Array` 1本で持ち、要素の等価判定には深い比較を使っています。

## 技術スタック

| カテゴリ     | 技術                     |
| :----------- | :----------------------- |
| 言語         | TypeScript 5(strict)     |
| 比較ロジック | 自前実装(実行時依存なし) |
| ビルド       | Vite                     |
| テスト       | Vitest(11テスト)         |
| リンタ       | ESLint + Prettier        |
| CI / CD      | GitHub Actions           |
| 配信         | GitHub Pages             |

## プロジェクト構成

- `src/lib/diff.ts` — 深い等価判定、構造diff、配列のLCS対応付け、差分集計
- `src/app.ts` — 入力の解析と折りたたみ木の表示
- `docs` — アーキテクチャ図
- `.github/workflows` — CIとGitHub Pagesデプロイ

## はじめ方

### 前提条件

- Node.js 20以上

### セットアップ

```bash
git clone https://github.com/miruky/semdiff.git
cd semdiff
npm install
npm run dev
```

### テストの実行

```bash
npm test
```

### Lintの実行

```bash
npm run lint
```

### デプロイ

`main` ブランチへのプッシュでGitHub Actionsがビルドし、GitHub Pagesへ自動デプロイします。

## 設計方針

- **値として比較する** — パースしてから比べる。表記の揺れ(キー順序・空白・インデント)は差分にしない
- **配列はLCSで対応付ける** — 途中への挿入・削除をそのものとして検出し、偽の変更連鎖を作らない
- **型が変わったら展開しない** — 配列がオブジェクトになったような変化は、中身の細かい差分より「型が変わった」事実の方が重要
- **送信ゼロ** — 比較はすべてブラウザ内。貼られたデータをネットワークに流さない

## ライセンス

[MIT](LICENSE)

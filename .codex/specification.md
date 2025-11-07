# NAZOMATIC 仕様書（2025-09-22）

## 1. サイト概要

- 目的: 謎解きやパズルの解答を支援するツール群を一箇所にまとめる。
- 対象ユーザー: 日本語話者の謎解きイベント参加者・制作者。
- 提供機能: しりとり最長連鎖、サイコロ展開図、アルファベット ⇔ 数字変換、都道府県検索、方眼紙メモ、アナグラム/クロスワード検索、イベント用シークレットコンテンツ。
- UI: Next.js App Router 上のダークテーマ（灰色グラデーション背景）、レスポンシブ構成。

## 2. 技術スタック

- Next.js 14 / React 18 / TypeScript。
- Tailwind CSS + shadcn/ui（Radix UI ラッパー）によるコンポーネント設計。
- framer-motion によるアニメーション、lucide-react によるアイコン。
- 3D 表現は react-three/fiber + @react-three/drei + three.js を利用。
- Radix UI の Dialog / Select / Tooltip / Accordion 等を採用。
- html2canvas によるキャンバス書き出し（EndCard コンポーネント）。
- schema-dts と Next.js Route Handlers（sitemap.ts, robots.ts）で SEO を管理。
- Google AdSense（baseURL が localhost の場合は無効化）。

## 3. 環境・ビルド設定

- npm scripts: dev / build / start / lint。
- `.env.local` の `NEXT_PUBLIC_BASE_URL` を `src/app/config.ts` が参照し、メタデータや JSON-LD に利用。未指定時は https://nazomatic.vercel.app を既定値にする。
- Tailwind 設定 (`tailwind.config.ts`): ダークモード class、2xl=1400px コンテナ、accordion アニメーションの拡張。
- `globals.css` は Tailwind のベースのみ適用。レイアウトは各コンポーネント内で完結。
- `components.json` / `src/components/ui/*` は shadcn CLI で生成された UI プリミティブ群。
- **内部 API / GitHub Actions 用シークレット**
  - Next.js （Vercel）実行環境に `REALTIME_INTERNAL_API_TOKEN` を設定。`/api/internal/realtime/register` と `/api/internal/realtime/prune` は `Authorization: Bearer <token>` が一致しない場合 401 を返す。
  - GitHub Actions 側では以下の Secrets を定義する。
    - `REALTIME_API_BASE_URL`: デプロイ済みアプリのベース URL（例 `https://nazomatic.vercel.app`）。
    - `REALTIME_API_TOKEN`: `REALTIME_INTERNAL_API_TOKEN` と同値のトークン。ワークフローから内部 API を叩く際に使用。
  - 追加のクエリやレート調整が必要な場合はワークフロー側の JSON ペイロードを更新することで対応する。
- 公開辞書ファイルは `public/dic/*.dic` に配置。Next.js の静的アセットとして fetch される。
- `robots.ts` で `/secret/` 配下をクロール禁止に設定。

## 4. ルーティングとエントリポイント

| パス           | 役割                                               | 主なコンポーネント / データ                                                                                       |
| -------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`            | ランディング。各ツールの導線提示と暗号ヒント表示。 | `HeaderComponent`, `features.json`, `framer-motion`, `lucide-react`                                               |
| `/shiritori`   | しりとり最長連鎖生成。                             | `StylishAutoResizeTextareaComponent`, `WordList`, `ShiritoriResultComponent`, `hiragana.json`, `ShiritoriManager` |
| `/dice`        | サイコロ展開図 + 3D モデルのカスタマイズ。         | `DiceNets`, `DiceComponent`, `react-three/fiber`                                                                  |
| `/alphabet`    | アルファベット ⇔ 数字変換。                        | `AlphabetConverter`                                                                                               |
| `/prefectures` | 都道府県・県庁所在地検索。                         | `PrefectureSearchTableComponent`                                                                                  |
| `/graphpaper`  | クロスワード向け方眼紙エディタ。                   | `GraphPaperComponent`                                                                                             |
| `/anagram`     | アナグラム / クロスワード検索。                    | `AnagramSearch`, `SearchManager`, `public/dic/*.dic`                                                              |
| `/(secret)`    | イベント用特設コンテンツ（詳細は限定公開）。       | `src/app/(secret)/secret/*`, `public/data/quiz-data.json` 等                                                      |

`src/app/(main)/layout.tsx` が共通レイアウトを担当し、Inter フォント読み込み・メタデータ設定・`AdComponent` の挿入を行う。

## 5. 共通 UI / SEO

- **ヘッダー**: 画面幅に応じて `HeaderComponent`（デスクトップ）と `ArticleHeaderComponent`（モバイル / スティッキーヘッダー）を切り替え。`features.json` を単一ソースとしてアイコンやリンクを生成。
- **フッター**: `FooterComponent` がコピーライトを表示。
- **JSON-LD**: `Article` コンポーネントが `features.json` のインデックスを受け取り、`generateJsonLdArticle` 経由で Article スキーマを `<script type="application/ld+json">` として挿入。
- **トップページ JSON-LD**: `page.tsx` で WebSite スキーマを埋め込み。
- **サイトマップ / robots**: `sitemap.ts` が `features.json` からリンクを生成（追加ページは JSON 追加で自動反映）。`robots.ts` は `/secret/` を除外しつつ sitemap URL を配信。
- **広告**: `google-ad-component.tsx` がクライアント側で AdSense スクリプトを読み込み。`baseURL` に `localhost` が含まれる場合は描画をスキップ。

## 6. 機能別仕様

### 6.1 トップページ（`/`）

- `features.json` をグリッド表示。クリックで `router.push`。
- `framer-motion` でフェードインやホバーエフェクトを制御。
- 暗号ヒントセクションは `useState` で表示切替。番号 → アルファベット変換を促す問題文。
- JSON-LD Script を `next/script` で注入。

### 6.2 しりとり最長連鎖ツール（`/shiritori`）

- **入力**: `StylishAutoResizeTextareaComponent` がテキストエリアの自動伸縮・フォーカス演出・最大 2000 文字の字数カウントを提供。
- **文字パレット**: `WordList` + `WordData` が `hiragana.json`（value/paterns/number）をもとにひらがな一覧を表示。クリックで入力に追記。`countHiragana` が正規表現パターン群で出現回数をカウントしバッジに反映。
- **結果生成**: `ShiritoriManager` が
  1. 入力テキストを行単位に分割（空行除外）。
  2. 各単語を始点に再帰探索し最長連鎖を更新。
  3. `normalizeKana` でひらがな・カタカナを統一。
  4. 連鎖に使われなかった単語を `unusedWords` として保持。
- **表示**: Radix Dialog 内で `ShiritoriResultComponent` が 200ms 間隔でバッジを順次フェードインし、末尾には未使用単語を表示。`Badge` は shadcn/ui を利用。

### 6.3 サイコロカスタマイザー（`/dice`）

- **状態管理**: `faceData` を `Record<number, {text, rotation}>` として保持、`handleFaceDataChange` で面ごとに更新。
- **展開図**: `DiceNets` が 11 種類の展開図パターン (`face id` と平面座標) を提供。ウィンドウ幅を監視して SVG を縮尺調整。各マスでテキスト入力と 90° 回転ボタンを備え、`onFaceDataChange` を介して親へ反映。
- **3D 表示**: `DiceComponent` が `Canvas` 上に透明感のあるキューブを生成し、各面に `Text` で文字を貼り付け。自動回転は `useFrame` で制御し、ポーズボタン（Play/Pause アイコン）で停止可能。ドラッグ時は回転を一時停止し、`OrbitControls` で視点移動を提供。
- **カラーテーマ**: `DICE_COLORS` 配列で各面色を定義。展開図と 3D モデルで統一。

### 6.4 アルファベット変換（`/alphabet`）

- 入力テキストは全角英数字を半角に変換し大文字へ統一。ハイフン（各種ダッシュやスペース）区切りを許容。
- 数字 → アルファベット、アルファベット → 対応番号を双方向表示。不明文字は `?`。
- アルファベット一覧をカード内に表示し、クリックで入力へ追加／削除。`Tooltip` で番号を表示し、選択中の文字をハイライト。
- `selectedLetters` を `useEffect` で追跡し UI と入力値を同期。

### 6.5 都道府県検索（`/prefectures`）

- `PREFECTURES` 定数が 47 都道府県と地方、県庁所在地、ひらがなを網羅。
- 2 つの検索フィールド（都道府県／県庁所在地ひらがな）。`matchSearch` が
  - 全角の `＊` `？` を半角 `*` `?` に変換。
  - 正規表現へ展開し大文字小文字を無視した完全一致判定。
- `useEffect` でリアルタイムにフィルタリング。検索が空の場合は全件表示。
- テーブルは shadcn Table を使用し、モバイルでは非表示列（地方・ひらがな）を減らしてレスポンシブ対応。

### 6.6 方眼紙メモ（`/graphpaper`）

- **グリッド構造**: `grid`（確定文字）、`tmpGrid`（変換中入力）、`gridPattern`（色パターン index）を保持。行・列数は 1〜20 で制限。
- **操作性**:
  - フォーカスセルを `currentCell` に保持し、矢印キーで移動。`Shift + 矢印` で色パターンを切り替え。
  - `Enter` で右隣へ、`Ctrl + Enter` で次行へ移動。
  - `Backspace` はセルをクリアし空セルでは左隣へ移動。
  - IME 入力中は `isComposing` フラグで確定を待ち、確定時に最後の文字だけ保持。
  - `autoFill` チェックで空セルを一括 `#` 埋め。
- **色塗りモード**: `isColorMode` 有効時はモバイル向けタッチ操作で塗りつぶし。`disableScroll` でスクロール抑制し、タッチトラッキング（start/move/end）で複数セル塗り。
- **UI**: 基本設定バーにヘルプアイコン、行列入力、モバイル限定の色モード切り替えを配置。

### 6.7 辞書検索ツール（`/anagram`）

- **モード切替**: `tabs` 配列で「アナグラム」「クロスワード」を定義。説明と使用例を Tooltip 内に用意。
- **入力補助**:
  - `Ctrl + /` ショートカットで辞書を順番に切り替え。
  - クロスワードモードかつ日本語辞書では `゛` と `゜` ボタンで特殊記号を挿入。
  - `Enter` で検索実行。検索中はローディング表示。
- **辞書管理** (`SearchManager`):
  - `DICTIONARIES` で利用可能辞書を宣言（豚辞書、CEFR-J）。`type` に応じて UI や濁点処理を分岐。
  - `loadDictionary` が `public/dic` からテキストファイルを fetch → 正規化 → キャッシュ。
  - `preprocessDictionary` は
    - 並べ替えキーごとの Map（アナグラム用）
    - 単語長 → 単語リスト Map（パターン検索用）を生成。
  - `findAnagramsAsync` は `?` ワイルドカード対応（可変長計算、最大 200 件）。
  - `findPatternwordAsync` は 0〜9 を同一文字グループ、濁点・半濁点をプレースホルダーに置換しマッチング。
  - `normalizeWord` で `normalizeKana` を使い小さい仮名・カタカナをひらがなに統一。全角数字は `fullWidthToHalfWidth` で半角へ。
- **UI 表示**: 最大件数に達した場合は注意文を表示。結果が無ければメッセージ。

### 6.8 補助コンポーネント

- `HeaderComponent` / `ArticleHeaderComponent`: 画面幅を検出しナビゲーション表示を切り替え。`Menu` ボタンからモバイルドロワーを制御。
- `FooterComponent`: コピーライトのみ表示。
- `json-ld-component.tsx`: ページ毎の Article スキーマを生成。
- `google-ad-component.tsx`: Adsbygoogle 初期化と `<ins>` 埋め込み。
- `EndCard`（現在ページ未割当）: 入力した名前を既定画像に重ね、`html2canvas` でキャプチャデータを取得するデモ。
- shadcn/ui 各種コンポーネント (`Button`, `Card`, `Select`, `Dialog`, `Badge`, `Table`, `Tooltip`, `Accordion`, `Textarea` 等) は `src/components/ui` に集約。

## 7. データ / アセット

- `src/lib/json/features.json`: ナビゲーション、トップページ、JSON-LD、サイトマップの単一ソース。配列順は `Article` インデックスや `/feature` ページに依存するため、追加時はインデックスを合わせる。
- `src/lib/json/hiragana.json`: ひらがな・カタカナ・記号のマッチングパターンと表示順番号。
- `public/dic/buta.dic`, `public/dic/CEFR-J.dic`: アナグラム/クロスワード検索で利用する辞書。UTF-8 テキスト（1 行 1 単語）。
- `public/data/quiz-data.json` と `public/img/secret/ponpoppo/*`: シークレットコンテンツ用クイズと画像。
- `public/og-image.png`, `public/favicons/*`: メタ画像とアイコン。
- `ads.txt` 等の周辺ファイルも Next.js の静的配信領域に置かれている。

## 8. シークレット領域（`src/app/(secret)`）

- クリスマス企画や「ponpoppo」企画などイベント時限定のページ群。`layout.tsx` でメインレイアウトと切り替え。
- 仕様の詳細は不定期更新のため簡略化。`public/data/quiz-data.json` と `src/components/ponpoppo/*` でクイズ、演出、カード UI を構成。
- 公開サイトでは `robots.ts` によりクロールを抑止。必要な場合のみ機密仕様を別途共有。

## 9. 開発・運用メモ

- **ビルド / 配信**: Next.js 標準の `next build` → `next start`。`SearchManager` の fetch はクライアント側実行を前提にしているため、辞書ファイルはビルド成果物に含める。
- **Lint / 型**: `next lint` と TypeScript 5 系。`tsconfig.json` で `paths` alias (`@/*`) を定義。
- **新機能追加時の注意**:
  1. `features.json` にエントリを追加し順序を合わせる（`Article` コンポーネントの index と `sitemap` で利用）。
  2. 必要なら `app/(main)` に新ディレクトリと `page.tsx` を追加。
  3. SEO が必要な場合は `Article` index を振り分けるか専用 JSON-LD を作成。
- **広告運用**: `AdComponent` は baseURL に `localhost` を含む場合に空描画。ローカル開発ではエラーを避けつつ、本番ではページ最下部にスロットを追加。
- **辞書拡張**: `DICTIONARIES` にエントリを加え、対応する .dic ファイルを `public/dic` に配置。`type` によって濁点処理や入力補助が変化する点に留意。

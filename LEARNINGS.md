# Project Learnings

<!--
記法ルール:
- 1項目1洞察。複数の学びを1行に詰めない
- 各項目の先頭に日付を必ず入れる（例: - 2026-08-24: ...）
- 上4セクションは「生の観察」の置き場。Consolidated Principles には
  統合パスで抽出した原則だけを置く。両者を混ぜない
-->

## Patterns That Work

（効いたやり方・型）

- 2026-10-24: 成功したPR用workflowでもAPIの `pull_requests` が空の場合がある。依存PRの自動マージではopen PRを列挙し、現在のhead SHA・workflowファイル・eventを照合する（運用は `docs/system-design/operations/jobs-and-generated-assets.md`）。

- 2026-10-24: Tailwindのメジャー移行では移行前の画像とDOM寸法を保存して比較すると、廃止クラスだけでなく従来未生成だったクラスの新規適用や行高継承の変化も特定できる。今回の確認項目は `docs/maintenance/tailwind4-verification-2026-10.md` を参照。

- 2026-10-23: ローカル自動化の撤去では、専用プロファイルを指定する実行中ブラウザを停止してから状態・Cookie・生成物を削除する。コード削除だけでは稼働中プロセスや Git 管理外のデータは消えない。

- 2026-08-24: `~/.claude/projects/<slug>/*.jsonl` からユーザーの実発話だけを抜くには、`type=="last-prompt"` と `type=="queue-operation"`(operation=="enqueue") を併用して重複排除する。`type=="user"` だけだと task-notification やスキル本文が大量に混ざり、`last-prompt` だけだと取りこぼす。
- 2026-08-28: npm脆弱性の棚卸しは `npm audit --omit=dev --json` で severity と `fixAvailable` を機械的に一覧化し、`npm ls <pkg>` で実際の依存ツリーを辿ってから対応方針（そのまま更新／メジャー移行が必要／孫依存で単独修正不可）を切り分けると早い。
- 2026-10-24: codex:rescue（codex-companion）が「Codex CLI is not installed」で失敗しても、~/.local/bin/codex があれば `codex review --uncommitted` を直接実行して未コミット diff のレビューを取れる
- 2026-10-24: Claude Browser の computer key で cmd+v を送っても input の paste イベントは発火しない。貼り付け処理の検証は DataTransfer に setData して ClipboardEvent('paste') を input へ dispatch すると確認できる
- 2026-10-25: データを書き換えるトグル（例: 空白を＃埋め）の状態を useState で別に持つと、元に戻す・やり直しとずれる。トグルの状態は履歴に載るデータ（グリッド）から導けば、undo/redo に自動で追従する
- 2026-10-25: Radix Dialog の DialogClose ボタンは、javascript_tool で .click() しても閉じなかった。computer の left_click（ref 指定）で押すと閉じ、onCloseAutoFocus で指定したボタンにフォーカスが戻ることまで確認できた
- 2026-10-25: .claude/worktrees 配下のワークツリーで `npm run lint` が親リポジトリの .eslintrc.json と plugin "@next/next" の衝突で落ちるときは、`npx eslint --no-eslintrc -c .eslintrc.json src/` で親設定を読まずに同じ規則で検査できる
- 2026-10-29: デプロイ失敗の調査では gh api の deployments/{id}/statuses と commits/{sha}/pulls を使い、どの Preview/Production が落ちたかと対応 PR を特定してから gh run view --log-failed で原因を読む
- 2026-10-29: Vercel のプレビュー URL はログイン画面に飛ばされ確認できないため、worktree でビルドし .claude/launch.json に一時設定 `npm --prefix <worktree> run start -- -p 3105` を足して preview_start でローカル確認し、終わったら launch.json を git checkout で戻す
- 2026-10-29: @next/codemod（next-lint-to-eslint-cli・middleware-to-proxy）は git の作業ツリーに未コミットの変更があると止まる。--force を付けると実行でき、そのあと生成物を手で整える
- 2026-10-29: eslint-config-next 16 の react-hooks/purity は render 中の Math.random() を検出する。固定シードの擬似乱数でモジュールスコープに配置を作るか、クリック時のハンドラで乱数配置を作って state に入れると、ルールを満たし、再描画での位置ずれや SSR 不一致も防げる
- 2026-10-29: 設定で warn に下げているルールの違反を一覧にするときは、設定ファイルを変えずに npx eslint src --rule '{"<rule>":"error"}' -f json を node で整形し、ルール名とファイル:行だけを出す
- 2026-10-29: Next.js 16 の src/proxy.ts は node:test で検証できる。ts.transpileModule で CJS に変換して vm で実行し、require は next/server だけ createRequire の実物に、それ以外はスタブに割り当てる。通過したかは応答ヘッダー x-middleware-next が '1' かで判定する
- 2026-10-30: Dependabot PR の CI（Security checks）は test:security → lint → build の順に実行され、最初に失敗した段で止まる。後ろの段の破損は見えないので、PR を worktree に checkout して npm ci し、lint や build も手元で個別に実行して失敗を全部洗い出す

## Mistakes to Avoid

（失敗と再発防止策）

- 2026-10-24: Dependabotのバージョン更新PRが作られていても、脆弱性アラートが有効とは限らない。両者を別に確認し、連携権限で有効化できない場合もCIの依存監査を維持する。

- 2026-10-21: Next.jsのメジャー更新はbuild成功だけで互換と判断しない。App Routerの同梱ReactとReact用カスタムrendererの内部API依存が異なる場合があるため、依存peer整合とCanvas等の実ブラウザ描画も確認する。

- 2026-09-19: 生の観察から恒久文書へ制約を転記するときは、「不可」を「前提にしない」へ弱めたり、唯一の代替策などの付随条件を落としたりしない。元項目の各節を転記先と機械的に照合すると、要件の意味を保ったまま卒業できる。
- 2026-08-28: macOS（BSD date）は `date +%s%3N` の `%3N` を解釈せず `1787…N` のような不正値を返す。epoch ミリ秒が要るときは `node -e 'console.log(Date.now())'` を使う（automation.toml の created_at 等に不正値が入ると読み込みが壊れる）。
- 2026-10-20: cleanup 前に `future` を push しても、`origin/main` がその commit を含まない間は ancestry guard が働くため、手動 merge で回避せず cleanup を停止して報告する。
- 2026-10-24: zsh の Bash ツールで区切り線として echo ===== を書くと、= で始まる単語がコマンドのパスに展開されて「===== not found」で失敗する。区切りは '-----' のように引用符で囲む
- 2026-10-24: コマンド文字列を正規表現で検査する PreToolUse(Bash) hook は、テストケースを Bash にインラインで書くとその文字列自体に反応してブロックされる。テスト用のコマンドはスクリプトファイルに書き出し、bash でそのファイルを実行する
- 2026-10-24: サブエージェント定義の本文で git diff などのコマンド実行を指示しているのに、tools に Bash が無いと実行できない。本文の指示と frontmatter の tools が噛み合っているかを確認し、Bash を足すなら用途を読み取り専用の git に限ると本文に明記する
- 2026-10-25: グリッドの行数などを決める type=number 入力で onChange ごとに確定すると、打ち直しの途中値（空欄→1→12）で一度縮んでデータが消える。入力値は draft として手元に持ち、blur と Enter で確定、Esc で取り消すと防げる
- 2026-10-25: zsh では一致しないグロブ（例: ls .github/PULL_REQUEST_TEMPLATE*）があると「no matches found」でコマンド全体が終了コード1になり、&& で繋いだ前段の出力も失敗扱いになる。存在確認のグロブは引用するか find/test -e を使い、独立したコマンドに分ける
- 2026-10-29: vm.runInNewContext で読み込んだモジュールの配列を assert.deepEqual で比べると、別 realm でプロトタイプが違うため構造が同じでも失敗する。[...arr] のようにスプレッドで現 realm の配列にしてから比べる
- 2026-10-30: TypeScript 6 以降は tsconfig の types の既定値が [] になり、@types/webspeechapi のようなグローバル型が自動では読み込まれない。next build の型チェックが通らなくなるので、tsconfig の compilerOptions.types に node と必要な @types を明示する

## Domain Knowledge

（業務・仕様に関する事実）

- 2026-10-20: Vercel の Node.js 版はリポジトリに指定がないと Project Settings に従う。`package.json` の `engines.node`（例: `24.x`）を書けばダッシュボードを変えずに上書きできるので、Node 廃止エラーはコード側で直して PR に含める。

- 2026-08-28: Codex画像生成をスクリプトから使う契約は `codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C <dir> -- "Use the imagegen skill..."`。現行 Codex CLI は `--full-auto` を受け付けない。`SAVED: <絶対パス>` 行は instruction 側で明示要求し、パース後に workDir 配下 realpath・生成時刻・PNG/JPEGマジックバイトを検証してから使う。

- 2026-10-25: Tailwind CSS 4.3 には pointer-fine/pointer-coarse/any-pointer-* のバリアントがあり、not-any-pointer-coarse:hidden で「タッチがない端末だけ隠す」と書ける。md:hidden のような幅判定の代わりにタブレット対応で使える

- 2026-10-29: Next 16 では `next lint` が廃止され、`npm run lint` が `next lint` を呼ぶと「lint」をディレクトリ名と解釈して失敗する。Next 16 へ上げるときは ESLint CLI への移行が必要

- 2026-10-29: framer-motion 14 では Variants の transition.ease が厳密な型になり、`ease: "..."` が string と推論されて next build の型検査で落ちる（as const か Variants 型注釈が必要）

- 2026-10-29: eslint-config-next 16 では React Compiler 系ルール（react-hooks/set-state-in-effect・purity・immutability）がエラーになり、既存コードで37件出た。移行と同時に直さない場合は flat config で warn に下げ、既知の課題として記録する

- 2026-10-29: Next.js 15 は Maintenance LTS で、セキュリティ修正の提供は 2027-01-31 まで（当初の 2026-10-21 から延長）。16 は Active LTS。サポート状況は nextjs.org/support-policy で確認できる

## Open Questions

（未解決・要調査）

- なし。

## Consolidated Principles

（統合パス専用。ここに直接追記しない）

- 自動化の `memory.md` を更新するときは、ログや台帳を正本として `Current State` / `Active Issues` / `Recent Runs` / `References` に再要約し、保存プロンプトで保持件数と容量上限を定めよ。
- 外部由来のテキストを公開物へ流すときは、入力種別に応じた境界を設けよ。無監修辞書は全候補で一意性を判定してから answer / display に denylist を適用する。
- 状態や差分の異常を調べるときは、時系列の履歴から発生日を絞り、該当期間の `git log` / `git show` で原因や取り込み先を確認せよ。

<!--
転記済み（2026-09-19 の統合パス）:
- 指示ファイル編集前の再読・docs照合 → AGENTS.md「作業スタイル」
- 結論の機械的検証 → AGENTS.md「作業スタイル」
- 外部スキルの参照・API適合確認 → AGENTS.md「共有 Agent Skill」
- design-sync README の生成境界と auxSha → .design-sync/NOTES.md
-->

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

- 2026-08-24: 共有 Agent Skill は `npm run skills:check` で frontmatter・ディレクトリ名・Claude Code 用参照スタブの一致を一括検証でき、PyYAML がない環境でも検証できる。
- 2026-08-24: `~/.claude/projects/<slug>/*.jsonl` からユーザーの実発話だけを抜くには、`type=="last-prompt"` と `type=="queue-operation"`(operation=="enqueue") を併用して重複排除する。`type=="user"` だけだと task-notification やスキル本文が大量に混ざり、`last-prompt` だけだと取りこぼす。
- 2026-08-24: アシスタント発話に「かな（U+3040–U+30FF）が1文字も含まれない」件数を数えると、日本語プロジェクトでの英語応答率を定量化できる。体感の指摘より説得力があり、ルール追加の根拠にできる。
- 2026-08-27: cleanup dry-run は fetch 後に `origin/future` が進んでも、`future` と `origin/main` の ancestry blocker が残る場合は execute を行わず、remote-tracking ref の更新だけで終了する。
- 2026-08-28: npm脆弱性の棚卸しは `npm audit --omit=dev --json` で severity と `fixAvailable` を機械的に一覧化し、`npm ls <pkg>` で実際の依存ツリー（直接依存かどうか、どのメジャー版に紐づくか）を辿ってから対応方針（そのまま更新／メジャー移行が必要／孫依存で単独修正不可）を切り分けると早い。
- 2026-08-28: AGENTS.md のような常時ロードされる指示ファイルを編集する前に、各節の内容が `docs/development-guide.md` 等の詳細ドキュメントと重複していないか grep で確認すると良い。重複していた節（理由説明・検証コマンドなど）は箇条書きのルールだけに削ぎ、詳細は docs 側へのポインタに一本化することで、常時課金される分量を増やさずに済む。
- 2026-08-28: nazomatic では「コーディングの実装ルール（クラス名・パターン）」は `docs/ai-coding-rules.md`、「アーキテクチャ上の不変条件（正本データ・API境界・認証方式）」は `docs/system-design/README.md` の「設計上の不変条件」に分かれて既に定義済み。AGENTS.md からルールを移設する際は移設先を早合点せず、両ファイルを grep して既存の置き場所（性質の近い方）に寄せると新たな重複を作らずに済む。
- 2026-08-28: cleanup dry-run は local `future` (`a60ea9dcd336f04f6e45b5a0d6b56228069f28e2`) が `origin/main` (`06fff14c4816eeced54009671b35e727d924f53c`) の ancestor ではない場合、fetch 後も exit 1 で execute と cleanup を安全に見送る。

- 2026-08-28: トレンド投稿の挙動異常を調べるときは、まず `local/x-browser-posting/trend-joke-history.json` の archetype 列を新しい順に眺めると異変の開始日が即座に特定でき、その日付で `git log --all --since` を絞ると原因コミット（自動実験PR）まで一直線に辿れる。

- 2026-08-28: X運用の実態把握は `post-ledger.json` を node ワンライナーで postType×archetype 別に成熟 metrics 集計（中央値・エンゲージ合計・週別推移）すると、ドキュメントだけでは見えない実像（301件中エンゲージあり17件、表示中央値約20で横ばい）が数分で定量化できる。
- 2026-08-28: 曜日で状態が切り替わるX投稿は、pendingを先に判定し、未成熟ならskip・期限切れなら破棄・新規出題は日曜だけに限定すると、日曜の失敗後に月曜の新規出題で状態が反転する事故を防げる。
- 2026-08-28: 実装計画（docs/ideas のプランmd）も diff と同様に Codex レビューへかける価値が高い。計画内コード断片の CLI フラグ実在確認（`--full-auto` 廃止）、コピー元 session の export 有無、文案の重み付け文字数超過、無監修辞書の不適切語まで、実装前に19件の妥当な指摘が得られた。指摘は鵜呑みにせず主要なもの（CLIフラグ等）を自分で再現確認してから反映する。
- 2026-08-28: Codex automation の `memory.md` は実行ごとの全文追記でログの複製になりやすい。変更前を退避し、`Current State` / `Active Issues` / `Recent Runs` / `References` へ再構成したうえで、保存プロンプト側に保持件数・KiB上限・正本を明記すると、現状と未解決事項を保ったまま継続的に抑制できる（今回は7件合計324,378 bytesを7,225 bytesへ圧縮）。

## Mistakes to Avoid
（失敗と再発防止策）

- 2026-08-24: auto mode では `cat > file <<'EOF'` によるファイル全体の書き換えが classifier にブロックされる。既存ファイルの構造変更は最初から Edit ツールの部分置換で組み立てる方が速い。
- 2026-08-28: macOS（BSD date）は `date +%s%3N` の `%3N` を解釈せず `1787…N` のような不正値を返す。epoch ミリ秒が要るときは `node -e 'console.log(Date.now())'` を使う（automation.toml の created_at 等に不正値が入ると読み込みが壊れる）。
- 2026-08-28: 共有 checkout の投稿 state を別アカウントで読むときは、pending の内容検証より先に accountHandle の所有確認を行う。別アカウントの壊れた state を検証してしまうと、現アカウントの投稿まで不必要に停止する。

## Domain Knowledge
（業務・仕様に関する事実）

- 2026-08-28: Autofix pull requests の ci-monitor-event で届く「新規レビューコメント」には `vercel[bot]` のデプロイ状況通知のような、対応不要な純粋なステータス投稿が混じる。inline thread が無く comment_id も無い場合は何も変更せず、返信・resolveもスキップしてよい。
- 2026-08-24: スキルは3スコープに分かれる。共有＝`.agents/skills/`（`skills-lock.json` と `skills:check` で管理）、ユーザー＝`~/.claude/skills/`（lock ファイルなし、アンインストールはディレクトリ削除のみ）、プラグイン＝`~/.claude/plugins/cache/`。どこにあるかで撤去手順が変わるので先に特定する。
- 2026-08-28: `firebase-admin` 13.6.0→14.3.0 のメジャー更新で fast-xml-parser/websocket-driver/protobufjs の critical 3件を含む脆弱性を一括解消できた（src/server/firebase/admin.ts のAPI利用はcert/getApp/getApps/initializeApp/getFirestoreのみで破壊的変更の影響なし）。ただし配下の `@google-cloud/storage@7.22.0` は独自にgaxios@6.7.1/uuid@9.0.1系を抱えており、firebase-admin側が追従するまで moderate 脆弱性が残る（overridesでの強制上書きはstorage動作互換のリスクがあるため見送り）。
- 2026-08-28: picomatch の high脆弱性（ReDoS）は `tailwindcss@3.4.19`（→chokidar→micromatch）と `eslint-config-next@14.2.35`（→tinyglobby）の孫依存で、両者とも現行メジャー内では最新版のため単独では直せない。Next.js 14→15/16のメジャー移行と合わせてでないと解消しない。

- 2026-08-28: x-growth 自動改善ループは PR を CI 後に自動マージし、評価で `x-growth:keep` が付くと変更が恒久化する。メトリクス最適化がオーナーの意図（投稿の多様性・面白さ）と衝突した場合、単なる revert では再提案で再発しうるため、`experimentAllowlist.mjs` の PROTECTED_TS_FUNCTIONS / PROTECTED_TS_CALLS への追加と allowlist note への禁止明記をセットで行う（今回 `pickArchetype` で archetype ローテーションを保護）。
- 2026-08-28: nazomatic の X 計測には「成熟」を名乗る窓が2つある。テレメトリ回収窓は `growthTelemetry.mjs` の `METRIC_MATURITY_MIN_MS`（20時間〜8日）、改善提案ゲートは proposal schema の `maturityHours=24`。ドキュメント同期時に混同しやすく、実際に development-guide が回収窓を「約24時間」と誤記していた。

- 2026-08-28: X改善実験 PR #73 は trend-joke-post.ts の archetype を `"poll"` にハードコードし、5型ローテーションを完全停止させたまま「72時間問題なし」で自動 keep された。現行の自動 keep は指標改善ではなく無事故のみを条件にするため、表示数中央値の微差（21 vs 17）を根拠にした多様性破壊が恒久化しうる。多様性・ローテーション不変条件は allowlist 側で保護するか、実験に自動失効を設ける必要がある。
- 2026-08-28: X運用のオーナー制約（戦略見直し時に確認済み）: ①週次の人間関与はほぼゼロ（ミニ謎の自作・監修も不可）、②X API有料プランは検討しない（ブラウザ投稿を継続）、③Automatedラベルは運用者アカウント紐付けが必須のため実質不可（bioでのAI公言が唯一の開示）、④謎チケ引用投稿の第一目的は売り手支援ではなくフォロワー獲得（削減可）。X関連の施策提案はこの4制約を前提にする。
- 2026-08-28: X の公開ランキングコード解説によると、ブラウザ経由の非API自動投稿は規約上アカウント永久凍結対象で、自動化アカウントには Automated ラベル＋運用者アカウント紐付けの義務がある。nazomatic のブラウザ投稿は常時この存続リスクを抱える（2026-08-28 時点の調査、出典: help.x.com の automation / automated-account-labels）。

- 2026-08-28: Codex画像生成をスクリプトから使う契約は `codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C <dir> -- "Use the imagegen skill..."`。**現行 Codex CLI は `--full-auto` を受け付けない**（`unexpected argument` で失敗。codex-image プラグイン 0.2.0 はまだ旧フラグに依存しており、そのままコピーすると動かない）。`SAVED: <絶対パス>` 行は skill 出力任せにせず instruction 側で明示要求し、パース後に workDir 配下 realpath・生成時刻・PNG/JPEGマジックバイトを検証してから使う。
- 2026-08-28: `~/.codex/automations/<id>/automation.toml` は id/name/prompt/status/rrule/model/execution_environment/target/cwds 等を持ち、status は `ACTIVE` / `PAUSED` を確認済み。設定変更は直接編集ではなく Codex app の automation update 経由で全フィールドを保持して更新すると、`updated_at` とアプリ側状態も同期される。
- 2026-08-28: `public/dic/buta.dic`（豚辞書・約20万語）は無監修で、「しにたい」「せいこうい」「ろりこん」等が文字数・かなフィルタを素通りする。辞書語を自動投稿に使う機能は denylist（部分一致、出力の answer/display 両方に適用）と、実行報告への語の必須表示をセットで入れる。
- 2026-08-28: X ブラウザ投稿 CLI の state 堅牢性は雛形によって差がある。週末サマリ CLI は fail-open（JSON 破損→`{}` 扱い・直接 writeFile）、トレンド CLI は fail-closed（execute 時に破損停止）+ 一時ファイル→rename の atomic 書き込み。新 CLI を雛形コピーで作るときは state まわりだけトレンド CLI 側のパターンを移植する。

## Open Questions
（未解決・要調査）

- 2026-08-24: AGENTS.md に追加した Response Language 節だけで日本語応答が維持されるか未検証。守られないようなら Stop フックでの機械的な担保に切り替える（`.claude/settings.json` に Shift Search 同期チェックの PostToolUse フック実績あり）。
- 2026-08-28: 同一セッション内で AGENTS.md を Write した直後、別ターンで再読したら「応答言語」節が消え `docs/ideas/` が実在しない `docs/superpowers/` に書き換わっていた。原因未特定（他セッション／フック／同期処理の可能性）。常時ロードされる指示ファイルを連続編集する際は、直前の自分の書き込み内容を過信せず、編集前に現在のディスク内容を再確認すると事故を防げる。

## Consolidated Principles
（統合パス専用。ここに直接追記しない）

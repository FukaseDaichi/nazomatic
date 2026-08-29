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

- 2026-08-24: `~/.claude/projects/<slug>/*.jsonl` からユーザーの実発話だけを抜くには、`type=="last-prompt"` と `type=="queue-operation"`(operation=="enqueue") を併用して重複排除する。`type=="user"` だけだと task-notification やスキル本文が大量に混ざり、`last-prompt` だけだと取りこぼす。
- 2026-08-24: アシスタント発話に「かな（U+3040–U+30FF）が1文字も含まれない」件数を数えると、日本語プロジェクトでの英語応答率を定量化できる。2026-08-29 の再計測で AGENTS.md「応答言語」節の効果を確認（全期間 393件中65件＝16.5% → 節追加後は82件中2件＝2.4%）。フックによる機械的担保は不要と判断。
- 2026-08-27: `sync-main-and-clean-worktrees` の dry-run は、fetch 後も local `future` が `origin/main` の ancestor でなければ exit 1 で execute と cleanup を安全に見送り、remote-tracking ref の更新だけで終わる（08-27 と 08-28 の2回とも同じ挙動）。
- 2026-08-28: npm脆弱性の棚卸しは `npm audit --omit=dev --json` で severity と `fixAvailable` を機械的に一覧化し、`npm ls <pkg>` で実際の依存ツリーを辿ってから対応方針（そのまま更新／メジャー移行が必要／孫依存で単独修正不可）を切り分けると早い。
- 2026-08-28: AGENTS.md のような常時ロードされる指示ファイルは、節ごとに `docs/` と grep で重複照合し、重複部分は箇条書きのルールだけ残して詳細を docs へのポインタに一本化すると、常時課金される分量を増やさずに済む。
- 2026-08-28: Codex automation の `memory.md` は実行ごとの全文追記でログの複製になりやすい。`Current State` / `Active Issues` / `Recent Runs` / `References` へ再構成し、保存プロンプト側に保持件数・KiB上限・正本を明記すると、現状と未解決事項を保ったまま継続的に抑制できる（7件合計324,378 bytes を 7,225 bytes へ圧縮）。
- 2026-08-28: X運用の実態把握は `post-ledger.json` を node ワンライナーで postType×archetype 別に成熟 metrics 集計（中央値・エンゲージ合計・週別推移）すると、ドキュメントだけでは見えない実像（301件中エンゲージあり17件、表示中央値約20で横ばい）が数分で定量化できる。
- 2026-08-28: トレンド投稿の挙動異常を調べるときは、まず `local/x-browser-posting/trend-joke-history.json` の archetype 列を新しい順に眺めると異変の開始日が即座に特定でき、その日付で `git log --all --since` を絞ると原因コミット（自動実験PR）まで一直線に辿れる。
- 2026-08-28: 曜日で状態が切り替わるX投稿は、pendingを先に判定し、未成熟ならskip・期限切れなら破棄・新規出題は日曜だけに限定すると、日曜の失敗後に月曜の新規出題で状態が反転する事故を防げる。
- 2026-08-29: LEARNINGS.md の統合パスで陳腐化を判定するときは、項目の日付を信用せずリポジトリ実態を grep で確認する。今回は「archetype ハードコード事件」「辞書 denylist 未実装」「firebase-admin 更新」の3件が、日付上は新しいのに実際は対策済み・適用済みで、実態確認なしでは有効な観察として残していた。
- 2026-08-29: X の会話ページからリプライ候補を読むときは、元投稿より後ろの全 `article` を候補化せず、`cellInnerDiv` を順に走査して「おすすめ」「Discover more」等の境界で止め、広告も除外すると会話外投稿の混入を抑えられる（`scripts/x-browser-posting/cdpChromePage.mjs`）。

## Mistakes to Avoid

（失敗と再発防止策）

- 2026-08-24: auto mode では `cat > file <<'EOF'` によるファイル全体の書き換えが classifier にブロックされる。既存ファイルの構造変更は最初から Edit ツールの部分置換で組み立てる方が速い。
- 2026-08-28: macOS（BSD date）は `date +%s%3N` の `%3N` を解釈せず `1787…N` のような不正値を返す。epoch ミリ秒が要るときは `node -e 'console.log(Date.now())'` を使う（automation.toml の created_at 等に不正値が入ると読み込みが壊れる）。
- 2026-08-28: 共有 checkout の投稿 state を別アカウントで読むときは、pending の内容検証より先に accountHandle の所有確認を行う。別アカウントの壊れた state を検証してしまうと、現アカウントの投稿まで不必要に停止する。
- 2026-08-28: 長いセッション中に、ユーザーが別経路で作業途中をコミットすることがある。`git status` の変更ファイルが突然減っても消失とは限らないので、まず `git log --oneline` と `git show --stat` で取り込み先を確認してから騒ぐ。
- 2026-08-28: 同一セッション内で AGENTS.md を Write した直後、別ターンで再読したら「応答言語」節が消え `docs/ideas/` が実在しない `docs/superpowers/` に書き換わっていた（原因未特定。08-29 時点で両方とも正常に残っており再発なし）。常時ロードされる指示ファイルを連続編集するときは、直前の自分の書き込み内容を過信せず、編集前にディスクの現在内容を読み直す。

## Domain Knowledge

（業務・仕様に関する事実）

- 2026-08-24: スキルは3スコープに分かれる。共有＝`.agents/skills/`（`skills-lock.json` と `skills:check` で管理）、ユーザー＝`~/.claude/skills/`（lock ファイルなし、アンインストールはディレクトリ削除のみ）、プラグイン＝`~/.claude/plugins/cache/`。どこにあるかで撤去手順が変わるので先に特定する。
- 2026-08-28: 実装ルールの置き場所は2つに分かれている。クラス名・パターン等のコーディング規則は `docs/ai-coding-rules.md`、正本データ・API境界・認証方式などの不変条件は `docs/system-design/README.md` の「設計上の不変条件」。ルールを移設するときは両方を grep して性質の近い方へ寄せると新たな重複を作らずに済む。
- 2026-08-28: 残存する npm 脆弱性は picomatch の high（ReDoS）で、`tailwindcss@3`（→chokidar→micromatch）と `eslint-config-next@14`（→tinyglobby）の孫依存。両者とも現行メジャー内では最新のため、Next.js 14→15/16 のメジャー移行なしには解消しない。`firebase-admin` は 14.3.0 へ上げて critical 3件を解消済みだが、配下の `@google-cloud/storage@7` が抱える gaxios/uuid 系 moderate は firebase-admin 側の追従待ち（overrides での強制上書きは storage 互換リスクのため見送り）。
- 2026-08-28: x-growth 自動改善ループは PR を CI 後に自動マージし、評価で `x-growth:keep` が付くと変更が恒久化する。keep 条件は指標改善ではなく無事故のみのため、多様性破壊が居座りうる（PR #73 が trend-joke の archetype を `"poll"` 固定にして5型ローテーションを停止させ、表示中央値の微差 21 vs 17 のまま自動 keep された実例）。不変条件は `scripts/x-growth/experimentAllowlist.mjs` の PROTECTED_TS_FUNCTIONS / PROTECTED_TS_CALLS 登録と allowlist note への禁止明記で守る（`pickArchetype` は登録済み・ローテーション復旧済み）。
- 2026-08-28: X 計測には「成熟」を名乗る窓が2つある。テレメトリ回収窓は `scripts/x-browser-posting/growthTelemetry.mjs` の `METRIC_MATURITY_MIN_MS`（20時間〜8日）、改善提案ゲートは proposal schema の `maturityHours=24`。ドキュメント同期時に混同しやすく、実際に development-guide が回収窓を「約24時間」と誤記していた。
- 2026-08-28: X運用のオーナー制約（戦略見直し時に確認済み）: ①週次の人間関与はほぼゼロ（ミニ謎の自作・監修も不可）、②X API有料プランは検討しない（ブラウザ投稿を継続）、③Automatedラベルは運用者アカウント紐付けが必須のため実質不可（bioでのAI公言が唯一の開示）、④謎チケ引用投稿の第一目的は売り手支援ではなくフォロワー獲得（削減可）。X関連の施策提案はこの4制約を前提にする。
- 2026-08-28: X の規約上、ブラウザ経由の非API自動投稿はアカウント永久凍結対象で、自動化アカウントには Automated ラベル＋運用者アカウント紐付けの義務がある。nazomatic のブラウザ投稿は常時この存続リスクを抱える（2026-08-28 時点の調査、出典: help.x.com の automation / automated-account-labels）。
- 2026-08-28: `public/dic/buta.dic`（豚辞書・約20万語）は無監修で、「しにたい」「せいこうい」「ろりこん」等が文字数・かなフィルタを素通りする。`scripts/x-browser-posting/casualPuzzle.mjs` の `DEFAULT_PUZZLE_DENYLIST` が部分一致で answer/display 両方に効く。辞書語を使う機能を増やすときは同じ denylist を必ず通す。
- 2026-08-28: X ブラウザ投稿 CLI の state 堅牢性は雛形によって差がある。週末サマリ CLI は fail-open（JSON 破損→`{}` 扱い・直接 writeFile）、トレンド CLI は fail-closed（execute 時に破損停止）+ 一時ファイル→rename の atomic 書き込み。
- 2026-08-28: Codex画像生成をスクリプトから使う契約は `codex exec --sandbox workspace-write --skip-git-repo-check --ephemeral -C <dir> -- "Use the imagegen skill..."`。**現行 Codex CLI は `--full-auto` を受け付けない**（`unexpected argument` で失敗。codex-image プラグイン 0.2.0 は旧フラグ依存でそのままコピーすると動かない）。`SAVED: <絶対パス>` 行は skill 出力任せにせず instruction 側で明示要求し、パース後に workDir 配下 realpath・生成時刻・PNG/JPEGマジックバイトを検証してから使う。
- 2026-08-28: `~/.codex/automations/<id>/automation.toml` は id/name/prompt/status/rrule/model/execution_environment/target/cwds 等を持ち、status は `ACTIVE` / `PAUSED`。設定変更は直接編集ではなく Codex app の automation update 経由で全フィールドを保持して更新すると、`updated_at` とアプリ側状態も同期される。
- 2026-08-28: Autofix pull requests の ci-monitor-event で届く「新規レビューコメント」には `vercel[bot]` のデプロイ状況通知のような、対応不要な純粋なステータス投稿が混じる。inline thread が無く comment_id も無い場合は何も変更せず、返信・resolve もスキップしてよい。

## Open Questions

（未解決・要調査）

- なし。2026-08-29 の統合パスで既存2件（日本語応答の維持検証 / AGENTS.md の内容消失）を解決・クローズした。

## Consolidated Principles

（統合パス専用。ここに直接追記しない）

- 常時ロードされる指示ファイル（AGENTS.md / CLAUDE.md）を編集するときは、編集前にディスクの現在内容を読み直し、追記候補を `docs/` と grep で照合せよ。重複は箇条書きのルールだけ残して docs へのポインタに一本化する。
- 「差分なし」「ルールが守られている」を推測で報告するな。grep / comm / node ワンライナーで数えてから言え。英語応答率も環境変数の一致も投稿メトリクスも、これで体感から確証に変わった。
- まとまった diff だけでなく実装計画の md も Codex レビューにかけよ。指摘は鵜呑みにせず、CLI フラグの実在など主要なものは自分で再現確認してから反映する。
- 自動化 CLI を既存の雛形からコピーして作るときは、state 入出力だけは堅い方の実装（atomic write・fail-closed）を移植せよ。雛形の弱さがそのまま新機能に伝播する。
- 自動生成・自動マージされる変更が不変条件（多様性・ローテーション）を壊したときは、revert ではなく allowlist の保護登録で恒久化せよ。revert だけでは再提案で再発する。
- 外部由来のテキスト（X の第三者投稿・無監修辞書）を出力や公開物に載せるときは、denylist と最小限公開（正規化 URL と15文字以内の handle だけ）をセットで入れよ。生本文を公開 Issue に残さない。
- 状態やファイルが消えた・減ったように見えたら騒ぐ前に、履歴ファイルを新しい順に見て発生日を特定し、`git log` で取り込み先を確認せよ。
- auto mode ではファイル全体の heredoc 書き換えが通らない前提で、既存ファイルの構造変更は最初から部分置換で組め。

<!--
転記済み（2026-08-29 の統合パス）:
- 実装計画も Codex レビューへ → AGENTS.md「標準ワークフロー」レビュー行
- docs/ideas の削除可否は節単位 → AGENTS.md「ドキュメントのライフサイクル」
- 環境変数/リンクの機械的照合手順 → .agents/skills/sync-docs-from-code/SKILL.md Workflow 4
- 投稿 URL の解決順（X_BROWSER_POST_API_BASE_URL 優先）→ docs/system-design/subsystems/x-posting.md
-->


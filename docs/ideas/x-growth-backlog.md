# X 運用の未着手バックログ

この文書は現行仕様ではなく、完了済みの「X フォロワー成長ループ Phase 2〜4 実装計画」から未着手の改善案だけを分離した検討メモです。実装する場合は、着手時点の X の仕様・ポリシー、現行コード、Codex automation の登録内容を改めて確認します。

## リプライ観測

自投稿への他者リプライを読み取り、未返信候補を週次レビューへ出す案です。返信・いいね・フォローは自動化しません。

現状は `profileMetrics.mjs` が投稿単位のリプライ「件数」だけを台帳へ書き戻し、`reply_post_rate` として改善提案の metric 候補に使えます。会話ページ本文の読み取りと未返信候補の列挙は未実装です。

- 自投稿の会話ページから、相手 handle、本文抜粋、reply URL、取得時刻を読み取る。
- 読み取り結果は Git 管理外の `local/x-browser-posting` に保存する。
- 対象投稿数に小さな上限を設け、login・blocking・CAPTCHA 検出時は停止する。
- X UI selector と利用ポリシーへの依存を実装前に再評価する。

## 投稿時間帯の実験

トレンドジョークの1日3枠は維持し、1回に1枠だけ時刻をずらして時間帯別中央値を比較する案です。

計測側は実装済みで、週次レビューが「時間帯別（JST）」の中央値表を出力し、`jstHourBucket` は改善提案の filter としても使えます。未着手なのは枠の時刻をずらす操作そのものです。時刻の正本はリポジトリ外の Codex automation にあり、自動改善エージェントからは変更できません（[`../system-design/subsystems/x-growth-improve-agent.md`](../system-design/subsystems/x-growth-improve-agent.md) の安全境界を参照）。実施する場合は人間が監視付きで1枠だけ変更し、[`../system-design/operations/x-browser-post-schedules.md`](../system-design/operations/x-browser-post-schedules.md) を同じ変更で更新します。

import ArticleHeaderComponent from "@/components/common/article-header-component";
import TeamBattleRules from "@/components/blank25/team-battle-rules";

export const metadata = {
  title: "BLANK25 チーム戦ルール",
};

export default function Blank25TeamBattleRulesPage() {
  return (
    <>
      <ArticleHeaderComponent />
      <TeamBattleRules />
    </>
  );
}

import Article from "@/components/common/json-ld-component";
import GraphPaperComponent from "@/components/graphpaper/graph-paper-component";

export default function GraphPaper() {
  return (
    <>
      <Article index={3} />
      <GraphPaperComponent />
    </>
  );
}

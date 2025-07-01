import QuizFloatingCard from "@/components/ponpoppo/QuizFloatingCard";
import { baseURL } from "@/app/config";

async function getQuizData(): Promise<any> {
  const res = await fetch(`${baseURL}/data/quiz-data.json`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to fetch quiz data");
  }
  return res.json();
}

export default async function QuizPage({
  params,
}: {
  params: { productId: string };
}) {
  const data = await getQuizData();
  const quiz = data.products[params.productId];

  if (!quiz) {
    return <div>商品が見つかりません。</div>;
  }

  return <QuizFloatingCard quiz={quiz} />;
}

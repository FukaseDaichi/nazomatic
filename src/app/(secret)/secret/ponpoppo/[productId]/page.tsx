import QuizFloatingCard from "@/components/ponpoppo/QuizFloatingCard";
import quizData from "../../../../../../public/data/quiz-data.json";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const quiz = Object.hasOwn(quizData.products, productId)
    ? quizData.products[productId as keyof typeof quizData.products]
    : undefined;

  if (!quiz) {
    return <div>商品が見つかりません。</div>;
  }

  return <QuizFloatingCard quiz={quiz} />;
}

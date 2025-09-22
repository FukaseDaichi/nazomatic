import QuizFloatingCard from "@/components/ponpoppo/QuizFloatingCard";
import { headers } from "next/headers";

async function getQuizData(): Promise<any> {
  const headersList = headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "https";
  const host =
    headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "localhost:3000";
  const baseUrl = `${protocol}://${host}`;

  const res = await fetch(`${baseUrl}/data/quiz-data.json`, {
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

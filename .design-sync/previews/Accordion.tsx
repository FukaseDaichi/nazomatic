import * as React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "nazomatic";

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark bg-gradient-to-b from-gray-900 to-gray-800 text-white p-8">
      {children}
    </div>
  );
}

export const FAQ = () => (
  <Frame>
    <Accordion type="single" collapsible defaultValue="item-1" className="w-full max-w-lg">
      <AccordionItem value="item-1" className="border-gray-800">
        <AccordionTrigger>謎解きの所要時間は？</AccordionTrigger>
        <AccordionContent className="text-gray-300">
          標準的なコースで約90分です。難易度や参加人数によって前後します。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2" className="border-gray-800">
        <AccordionTrigger>途中でヒントは使えますか？</AccordionTrigger>
        <AccordionContent className="text-gray-300">
          各問題につき2回までヒントを使用できます。使用回数はスコアに影響しません。
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3" className="border-gray-800">
        <AccordionTrigger>チームの人数制限は？</AccordionTrigger>
        <AccordionContent className="text-gray-300">
          1チーム2〜6名を推奨しています。
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </Frame>
);

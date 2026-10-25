"use client";

import { useRef, useState } from "react";
import hiragana from "@/lib/json/hiragana.json";
import { ShiritoriResultComponent } from "@/components/shiritoriResult/shiritori-result";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MAX_LENGTH = 2000;

export default function ShiritoriPageClient() {
  const [text, setText] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [isResultOpen, setIsResultOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const generateRef = useRef<HTMLButtonElement>(null);
  const normalizedText = text.split(/\r\n|\r|\n/).map((word) => word.trim()).filter(Boolean).join("\n");

  function insertKana(kana: string) {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? text.length;
    const end = field?.selectionEnd ?? text.length;
    if (text.length - (end - start) + kana.length > MAX_LENGTH) return;
    setText(text.slice(0, start) + kana + text.slice(end));
    requestAnimationFrame(() => field?.setSelectionRange(start + kana.length, start + kana.length));
  }

  return (
    <main className="min-h-screen bg-linear-to-b/srgb from-gray-900 to-gray-800 px-2 py-5 text-white sm:px-6 sm:py-8">
      <h1 className="mb-5 text-center text-2xl font-bold sm:text-3xl">しりとり</h1>
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-700 bg-gray-800 p-2 py-5 sm:p-8">
        <div role="group" aria-label="五十音表。左上は番号、右下は使用数。押すと入力できます。" className="rounded-xl border border-gray-600 bg-gray-700 p-1.5 sm:p-4">
          <div className="grid grid-cols-10 grid-rows-5 gap-x-1 gap-y-2 pb-2 pr-1 sm:gap-x-2 sm:gap-y-3 sm:pr-2">
            {hiragana.list.map((kana, index) => {
              if (!kana.value) return null;
              const count = (text.match(new RegExp(kana.paterns.join(""), "g")) ?? []).length;
              return (
                <button
                  key={kana.value}
                  type="button"
                  onClick={() => insertKana(kana.value)}
                  aria-label={`${kana.value}を挿入、五十音順${kana.number}番、${count}文字使用`}
                  style={{ gridColumn: 10 - Math.floor(index / 5), gridRow: index % 5 + 1 }}
                  className={`relative min-h-12 min-w-0 rounded-lg text-xl text-white shadow-[3px_5px_2px_#000] transition-transform active:translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 sm:min-h-16 sm:rounded-xl sm:text-3xl ${count ? "bg-purple-500 hover:bg-purple-400" : "bg-gray-500 hover:bg-gray-400"}`}
                >
                  <span aria-hidden="true" className="absolute left-0 top-0 rounded-tl-lg rounded-br-md bg-gray-900/75 px-0.5 text-[8px] leading-3 text-gray-200 sm:px-1 sm:text-xs sm:leading-4">{kana.number}</span>
                  <span>{kana.value}</span>
                  <span aria-hidden="true" className="absolute bottom-0.5 right-0.5 text-[10px] font-semibold leading-3 text-gray-200 sm:right-1 sm:text-sm sm:leading-4">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        <form className="mt-6 sm:mt-8" onSubmit={(event) => {
          event.preventDefault();
          if (!normalizedText) return;
          setGeneratedText(normalizedText);
          setIsResultOpen(true);
        }}>
          <label htmlFor="shiritori-words" className="sr-only">単語は1行に1つずつ入力してください</label>
          <Textarea
            ref={textareaRef}
            id="shiritori-words"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_LENGTH}
            aria-describedby="shiritori-count"
            placeholder="単語は改行して入力してください"
            className="min-h-36 resize-y rounded-xl border-gray-600 bg-gray-700 p-4 text-base leading-7 text-white placeholder:text-gray-300 focus-visible:ring-purple-400 focus-visible:ring-offset-gray-800"
          />
          <p id="shiritori-count" className="mt-2 text-right text-xs text-gray-400">{text.length.toLocaleString()} / 2,000文字</p>
          <div className="mt-3 text-center">
            <Button ref={generateRef} type="submit" disabled={!normalizedText} className="h-12 bg-purple-600 px-8 text-base text-white hover:bg-purple-500 focus-visible:ring-purple-400 focus-visible:ring-offset-gray-800">しりとり生成</Button>
          </div>
        </form>
      </div>
      <Dialog open={isResultOpen} onOpenChange={setIsResultOpen}>
        <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); generateRef.current?.focus(); }} className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border-gray-700 bg-gray-900 text-white">
          <DialogHeader>
            <DialogTitle>しりとり結果</DialogTitle>
            <DialogDescription className="sr-only">最長のしりとりと使わなかった単語を表示します。</DialogDescription>
          </DialogHeader>
          <ShiritoriResultComponent inputText={generatedText} />
          <DialogClose asChild><Button className="mt-2 min-h-11 bg-gray-700 text-white hover:bg-gray-600 focus-visible:ring-purple-400 focus-visible:ring-offset-gray-900">閉じる</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </main>
  );
}

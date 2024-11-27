"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mic, Camera, Search } from "lucide-react";
import Head from "next/head";

const goToUrl = (url: string) => {
  window.location.href = url; // URLに遷移する
};

export default function GoogleMobileHomepage() {
  const [searchWord, setSearchWord] = useState<string>("");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );
  const [isSounded, setSounded] = useState<boolean>(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    const recognitionInstance = new SpeechRecognition();
    recognitionInstance.lang = "ja-JP"; // 言語を日本語に設定
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = false;

    recognitionInstance.onstart = () => {
      setIsListening(true);
    };

    recognitionInstance.onend = () => {
      setIsListening(false);
    };

    recognitionInstance.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchWord(transcript);
      setSounded(true);
    };

    setRecognition(recognitionInstance);
  }, []);

  const ghostClickHandler = useCallback(() => {
    if (!recognition) {
      alert("このブラウザでは音声入力がサポートされていません。");
      return;
    }
    if (!isListening) {
      recognition.start();
    }
  }, [recognition, isListening]);

  const search = useCallback(() => {
    if (searchWord) {
      goToUrl(
        `https://www.google.com/search?q=${encodeURIComponent(searchWord)}`
      );
    }
  }, [searchWord]);

  return (
    <>
      <Head>
        <title>Google</title>
      </Head>
      <body>
        <div className="min-h-screen bg-white flex flex-col">
          <header className="p-4 flex justify-end items-center">
            <Button
              variant="ghost"
              className="text-sm font-medium text-gray-500"
              onClick={() => {
                goToUrl("https://mail.google.com/mail");
              }}
            >
              Gmail
            </Button>
            <Button
              variant="ghost"
              className="text-sm font-medium text-gray-500"
              onClick={() => {
                goToUrl("https://www.google.com/imghp");
              }}
            >
              画像
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={() => {
                goToUrl("https://accounts.google.com/ServiceLogin");
              }}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-500">
                <path
                  fill="currentColor"
                  d="M6,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM6,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM12,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM16,6c0,1.1 0.9,2 2,2s2,-0.9 2,-2 -0.9,-2 -2,-2 -2,0.9 -2,2zM12,8c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,14c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2zM18,20c1.1,0 2,-0.9 2,-2s-0.9,-2 -2,-2 -2,0.9 -2,2 0.9,2 2,2z"
                ></path>
              </svg>
            </Button>
            <Button
              size="sm"
              className="ml-4 bg-blue-500 hover:bg-blue-600 text-white rounded-md px-4 py-2"
              onClick={() => {
                goToUrl("https://accounts.google.com/ServiceLogin");
              }}
            >
              ログイン
            </Button>
          </header>

          <main className="flex-grow flex flex-col items-center justify-center px-4">
            <Image
              src="/img/secret/google.png"
              alt="Google"
              width={160}
              height={56}
              className="mb-7"
            />
            <div className="w-full max-w-[90%] relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 cursor-pointer"
                onClick={search}
              />
              <Input
                type="search"
                value={searchWord}
                placeholder="Google で検索または URL を入力"
                className="text-gray-900 w-full h-12 pl-12 pr-12 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onChange={(e) => {
                  setSearchWord(e.target.value);
                  setSounded(false);
                }}
              />
              {!searchWord && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-blue-500 w-6"
                    onClick={ghostClickHandler}
                  >
                    <Mic
                      className={`h-5 w-5 ${isListening ? "text-red-500" : ""}`}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-blue-500 w-6"
                    onClick={() => {
                      goToUrl("https://www.google.com/imghp");
                    }}
                  >
                    <Camera className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-6 flex space-x-2">
              <Button
                variant="secondary"
                className="bg-gray-100 hover:bg-gray-200 text-gray-500 px-4 py-2"
                onClick={search}
              >
                Google 検索
              </Button>
            </div>
          </main>

          <footer className="mt-auto">
            <div className="bg-gray-100 py-3 px-4">
              <p className="text-sm text-gray-500">日本</p>
            </div>
            <div className="bg-gray-100 py-3 px-4 flex flex-wrap justify-center items-center border-t border-gray-300">
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://www.google.com/intl/ja_jp/ads/");
                }}
              >
                広告
              </Button>
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://www.google.com/services/");
                }}
              >
                ビジネス
              </Button>
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://google.com/search/howsearchworks/");
                }}
              >
                検索の仕組み
              </Button>
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://policies.google.com/privacy");
                }}
              >
                プライバシー
              </Button>
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://policies.google.com/terms");
                }}
              >
                規約
              </Button>
              <Button
                variant="link"
                className="text-sm text-gray-500 mx-2"
                onClick={() => {
                  goToUrl("https://accounts.google.com/ServiceLogin");
                }}
              >
                設定
              </Button>
            </div>
          </footer>
        </div>
      </body>
    </>
  );
}

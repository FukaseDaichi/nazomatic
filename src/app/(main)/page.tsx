"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HeaderComponent } from "@/components/common/header-component";
import { FooterComponent } from "@/components/common/footer-component";
import featuresData from "@/lib/json/features.json";
import { getFeatureIcon } from "@/lib/feature-icons";
import { baseURL } from "@/app/config";
import dynamic from "next/dynamic";
import Script from "next/script";
import Link from "next/link";

/**
 * three.js を待たずに描画される背景の下地。
 * three をこのページの初期チャンクに引き込まないよう、
 * three-hero-background.tsx から import せずここで定義する
 * (同モジュールを静的 import すると dynamic import の分割が無効になる)。
 */
function HeroBackdrop() {
  return (
    <>
      <div className="fixed inset-0 z-0 bg-[#0a0812]" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(120%_80%_at_50%_0%,rgba(124,77,255,.10),transparent_55%),radial-gradient(100%_60%_at_50%_120%,rgba(10,8,18,.9),transparent)]"
        aria-hidden="true"
      />
    </>
  );
}

const ThreeHeroBackground = dynamic(
  () =>
    import("@/components/common/three-hero-background").then(
      (m) => m.ThreeHeroBackground
    ),
  { ssr: false }
);

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "ナゾマティック",
  alternateName: ["NAZOMATIC"],
  url: baseURL,
  description:
    "ナゾマティック(NAZOMARICE)は、謎解きやパズルを解くためのお助けツールを詰め合わせたサイトです。",
  inLanguage: "ja",
  mainEntityOfPage: {
    "@type": "WebPage",
    "@id": baseURL,
  },
  keywords: ["謎解き", "パズル", "お助けツール", "ナゾマティック"],
};

const MotionLink = motion(Link);

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout: number }
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/**
 * three.js 背景のマウントをアイドル時間まで遅らせ、初期描画から重い初期化を外す。
 * requestIdleCallback 非対応ブラウザは setTimeout にフォールバックする。
 */
function useIdleMount() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const idleWindow = window as IdleWindow;
    const { requestIdleCallback, cancelIdleCallback } = idleWindow;

    if (typeof requestIdleCallback === "function") {
      const handle = requestIdleCallback.call(
        idleWindow,
        () => setMounted(true),
        { timeout: 2000 }
      );
      return () => cancelIdleCallback?.call(idleWindow, handle);
    }

    const timer = window.setTimeout(() => setMounted(true), 300);
    return () => window.clearTimeout(timer);
  }, []);

  return mounted;
}

export default function Home() {
  const showThreeBackground = useIdleMount();

  return (
    <>
      <Script
        id="json-ld"
        key="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HeroBackdrop />
      {showThreeBackground && <ThreeHeroBackground />}
      <div className="relative z-10">
        <HeaderComponent />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          {/*
            LCP 要素を含むヒーローは framer-motion を使わず CSS アニメーションで入場させる。
            SSR された HTML の時点でアニメーションが始まるため、ハイドレーションを待たずにペイントされる。
          */}
          <section className="flex min-h-[55svh] flex-col items-center justify-center text-center sm:min-h-[68vh]">
            <div className="mb-5 animate-fade-up text-xs font-medium tracking-[0.34em] text-[#a98bff] motion-reduce:animate-none sm:mb-6">
              謎解き・パズル お助けツール集
            </div>
            {/*
              この見出しは LCP 要素。opacity を 0 から動かすと「まだ描画されて
              いない」と扱われて LCP が遅れるため、transform だけを動かす。
            */}
            <h2 className="animate-rise-up text-[clamp(40px,8vw,92px)] font-black leading-[1.05] tracking-wide [animation-delay:0.15s] [text-shadow:0_6px_44px_rgba(124,77,255,.4)] motion-reduce:animate-none">
              謎を解き明かそう
            </h2>
            <p className="mt-5 max-w-[600px] animate-fade-up text-[clamp(15px,2vw,20px)] text-[rgba(231,227,245,.78)] [animation-delay:0.3s] motion-reduce:animate-none sm:mt-6">
              NAZOMATICで、あなたの謎解き力を極限まで高めよう。
            </p>
          </section>

          <section id="tools" className="mb-16 scroll-mt-20">
            {/*
              初期表示のビューポート内に入る見出しなので、framer-motion の
              whileInView(JS 待ち)ではなく CSS アニメーションで表示する。
              JS を待つとこの見出しが LCP 要素になり LCP が悪化する。
            */}
            <div className="mb-6 flex animate-fade-up items-baseline gap-3 motion-reduce:animate-none sm:mb-8">
              <h2 className="text-2xl font-bold sm:text-3xl">ツール一覧</h2>
              <span className="text-sm tracking-[0.1em] text-[#a98bff]">
                {featuresData.features.length} TOOLS
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {featuresData.features.map((feature, index) => {
                const IconComponent = getFeatureIcon(feature.iconName);

                return (
                  <MotionLink
                    key={feature.path}
                    href={feature.path}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: (index % 3) * 0.08 }}
                    whileHover={{ y: -6 }}
                    whileTap={{ scale: 0.98 }}
                    className="group flex flex-col gap-3 rounded-2xl border border-white/10 bg-[rgba(24,21,36,.55)] p-5 backdrop-blur-md transition-[border-color,box-shadow] duration-300 hover:border-purple-500/50 hover:shadow-[0_18px_50px_rgba(124,77,255,.18)] sm:p-6"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-purple-500/35 bg-gradient-to-br from-purple-500/30 to-purple-500/5 text-purple-300 transition-colors duration-300 group-hover:text-purple-200">
                        <IconComponent className="h-6 w-6" aria-hidden="true" />
                      </div>
                      <h3 className="text-lg font-bold sm:text-xl">
                        {feature.title}
                      </h3>
                    </div>
                    <p className="text-sm leading-relaxed text-[rgba(231,227,245,.65)] sm:text-base">
                      {feature.description}
                    </p>
                  </MotionLink>
                );
              })}
            </div>
          </section>
        </main>
        <FooterComponent />
      </div>
    </>
  );
}

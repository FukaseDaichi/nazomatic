"use client";

import { getFeatureIcon } from "@/lib/feature-icons";
import features from "@/lib/json/features.json";
import * as Tooltip from "@radix-ui/react-tooltip";
import ArticleHeaderComponent from "./article-header-component";
import Link from "next/link";

/**
 * 表示するヘッダーは CSS のメディアクエリだけで切り替える。
 * 以前は useEffect で innerWidth を見て出し分けていたが、
 * SSR 時は必ずデスクトップ用が出力されるため、モバイル幅では
 * ハイドレーション後にヘッダーが差し替わってレイアウトシフトが発生していた。
 */
export function HeaderComponent() {
  return (
    <>
      <ArticleHeaderComponent className="sm:hidden" />
      <header className="hidden sm:block py-6 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-y-2 animate-fade-down motion-reduce:animate-none">
          <h1 className="shrink-0 text-2xl lg:text-3xl font-bold tracking-tight text-gray-300">
            NAZOMATIC
          </h1>
          <nav>
            <Tooltip.Provider delayDuration={200}>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 lg:gap-x-7">
                {features.features.map((feature) => {
                  const IconComponent = getFeatureIcon(feature.iconName);

                  return (
                    <li key={feature.path}>
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                          <Link
                            href={feature.path}
                            aria-label={feature.title}
                            className="text-gray-300 hover:text-purple-400 transition-colors p-2 rounded-full"
                          >
                            <IconComponent size={20} aria-hidden="true" />
                          </Link>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                          <Tooltip.Content
                            className="bg-gray-800 text-gray-100 px-3 py-1.5 rounded-md text-sm animate-in fade-in-0 zoom-in-95"
                            sideOffset={-15}
                          >
                            {feature.title}
                            <Tooltip.Arrow className="fill-gray-800" />
                          </Tooltip.Content>
                        </Tooltip.Portal>
                      </Tooltip.Root>
                    </li>
                  );
                })}
              </ul>
            </Tooltip.Provider>
          </nav>
        </div>
      </header>
    </>
  );
}

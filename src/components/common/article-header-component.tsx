"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import features from "../../lib/json/features.json"; // features.jsonをインポート
import * as Tooltip from "@radix-ui/react-tooltip";
import { getFeatureIcon } from "@/lib/feature-icons";
import Link from "next/link";

const MOBILE_MENU_ID = "article-header-mobile-menu";

const menuItems = features.features.map((feature) => ({
  icon: getFeatureIcon(feature.iconName),
  title: feature.title,
  path: feature.path,
}));

export default function ArticleHeaderComponent({
  className = "",
}: {
  /** 表示条件を呼び出し側で制御するための追加クラス(例: `sm:hidden`) */
  className?: string;
} = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header
      className={`relative sticky top-0 z-50 bg-gradient-to-b from-gray-900 text-white shadow-lg ${className}`}
    >
      {/*
        ヘッダーは初期表示に入るため、framer-motion(JS 待ち)ではなく
        CSS アニメーションで表示する。JS を待つとロゴが LCP 要素になり
        LCP が悪化する。
      */}
      <div className="max-w-7xl mx-auto flex justify-between items-center animate-fade-down motion-reduce:animate-none">
        <nav className="container mx-auto px-4 md:px-20 py-3 z-10">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight hover:text-purple-400 transition-colors"
            >
              NAZOMATIC
            </Link>
            <div className="hidden sm:block">
              <Tooltip.Provider delayDuration={200}>
                <ul className="flex space-x-7">
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
            </div>
            <button
              type="button"
              className="md:hidden text-white focus:outline-none"
              aria-label={isOpen ? "メニューを閉じる" : "メニューを開く"}
              aria-expanded={isOpen}
              // メニューは開いている間しか DOM に存在しないため、
              // 閉じている間は参照先のない aria-controls を出力しない
              aria-controls={isOpen ? MOBILE_MENU_ID : undefined}
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              id={MOBILE_MENU_ID}
              initial={{ opacity: 0, y: -70 }}
              animate={{ opacity: 1, y: -50 }}
              exit={{ opacity: 0, y: -70 }}
              transition={{ duration: 0.2 }}
              className="absolute top-full left-0 w-full md:hidden bg-gray-900 shadow-lg pt-10"
            >
              <nav className="container mx-auto px-4 py-2">
                {menuItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`block py-2 text-sm hover:text-purple-400 transition-colors ${
                      pathname === item.path ? "text-purple-400" : ""
                    }`}
                  >
                    <item.icon className="inline-block w-4 h-4 mr-2" />
                    {item.title}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

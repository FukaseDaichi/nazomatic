"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import features from "@/lib/json/features.json";
import * as Tooltip from "@radix-ui/react-tooltip";
import ArticleHeaderComponent from "./article-header-component";
import Link from "next/link";

const BREAK_POINT: number = 640;

export function HeaderComponent() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIfMobile = () => setIsMobile(window.innerWidth < BREAK_POINT);
    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);
  return (
    <>
      {isMobile && <ArticleHeaderComponent />}
      {!isMobile && (
        <header className="py-6 px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-7xl mx-auto flex justify-between items-center"
          >
            <h1 className="text-3xl font-bold tracking-tight text-gray-300">
              NAZOMATIC
            </h1>
            <nav>
              <Tooltip.Provider delayDuration={200}>
                <ul className="flex space-x-7">
                  {features.features.map((feature) => {
                    const IconComponent = LucideIcons[
                      feature.iconName as keyof typeof LucideIcons
                    ] as LucideIcons.LucideIcon;

                    return (
                      <li key={feature.path}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <Link
                              href={feature.path}
                              className="text-gray-300 hover:text-purple-400 transition-colors p-2 rounded-full"
                            >
                              <IconComponent size={20} />
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
          </motion.div>
        </header>
      )}
    </>
  );
}

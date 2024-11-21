"use client";

import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import features from "@/lib/json/features.json";
import * as Tooltip from "@radix-ui/react-tooltip";

export function HeaderComponent() {
  return (
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
            <ul className="flex space-x-4">
              <li>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <a
                      href="/"
                      className="text-gray-300 hover:text-purple-400 transition-colors p-2 rounded-full"
                    >
                      <LucideIcons.Home size={20} />
                    </a>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      className="bg-gray-800 text-gray-100 px-3 py-1.5 rounded-md text-sm animate-in fade-in-0 zoom-in-95"
                      sideOffset={-15}
                    >
                      ホーム
                      <Tooltip.Arrow className="fill-gray-800" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </li>
              {features.features.map((feature) => {
                const IconComponent = LucideIcons[
                  feature.iconName as keyof typeof LucideIcons
                ] as LucideIcons.LucideIcon;

                return (
                  <li key={feature.path}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <a
                          href={feature.path}
                          className="text-gray-300 hover:text-purple-400 transition-colors p-2 rounded-full"
                        >
                          <IconComponent size={20} />
                        </a>
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
  );
}

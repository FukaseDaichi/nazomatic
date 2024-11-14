"use client";

import { motion } from "framer-motion";
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
          <ul className="flex space-x-4">
            <li>
              <a
                href="/"
                className="text-gray-300 hover:text-purple-400 transition-colors"
              >
                ホーム
              </a>
            </li>
            <li>
              <a
                href="/shiritori"
                className="text-gray-300 hover:text-purple-400 transition-colors"
              >
                しりとり
              </a>
            </li>
            <li>
              <a
                href="/dice"
                className="text-gray-300 hover:text-purple-400 transition-colors"
              >
                サイコロ
              </a>
            </li>
            <li>
              <a
                onClick={() => {
                  alert("まだないよ");
                }}
                className="text-gray-300 hover:text-purple-400 transition-colors cursor-pointer"
              >
                お問い合わせ
              </a>
            </li>
          </ul>
        </nav>
      </motion.div>
    </header>
  );
}

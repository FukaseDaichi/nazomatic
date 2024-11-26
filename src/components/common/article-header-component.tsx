"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import features from "../../lib/json/features.json"; // features.jsonをインポート

const menuItems = features.features.map((feature) => ({
  icon: require("lucide-react")[feature.iconName], // アイコンを動的に取得
  title: feature.title,
  path: feature.path,
}));

export default function ArticleHeaderComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header className="relative sticky top-0 z-50 bg-gradient-to-b from-gray-900 text-white shadow-lg">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto flex justify-between items-center"
      >
        <nav className="container mx-auto px-4 md:px-20 py-3 z-10">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight hover:text-purple-400 transition-colors"
            >
              NAZOMATIC
            </Link>
            <div className="hidden md:flex space-x-4">
              {menuItems.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`text-sm hover:text-purple-400 transition-colors ${
                    pathname === item.path ? "text-purple-400" : ""
                  }`}
                >
                  <item.icon className="inline-block w-4 h-4 mr-1" />
                  <span className="hidden lg:inline">{item.title}</span>
                </Link>
              ))}
            </div>
            <button
              className="md:hidden text-white focus:outline-none"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {isOpen && (
            <motion.div
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
      </motion.div>
    </header>
  );
}

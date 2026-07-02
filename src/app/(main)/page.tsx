"use client";

import { motion } from "framer-motion";
import * as LucideIcons from "lucide-react";
import { HeaderComponent } from "@/components/common/header-component";
import { FooterComponent } from "@/components/common/footer-component";
import { ThreeHeroBackground } from "@/components/common/three-hero-background";
import featuresData from "@/lib/json/features.json";
import { baseURL } from "@/app/config";
import Script from "next/script";
import Link from "next/link";

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

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function Home() {
  return (
    <>
      <Script
        id="json-ld"
        key="json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ThreeHeroBackground />
      <div className="relative z-10">
        <HeaderComponent />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <motion.section
            initial="hidden"
            animate="show"
            variants={{ show: { transition: { staggerChildren: 0.15 } } }}
            className="flex min-h-[55svh] flex-col items-center justify-center text-center sm:min-h-[68vh]"
          >
            <motion.div
              variants={fadeUp}
              className="mb-5 text-xs font-medium tracking-[0.34em] text-[#a98bff] sm:mb-6"
            >
              謎解き・パズル お助けツール集
            </motion.div>
            <motion.h2
              variants={fadeUp}
              className="text-[clamp(40px,8vw,92px)] font-black leading-[1.05] tracking-wide [text-shadow:0_6px_44px_rgba(124,77,255,.4)]"
            >
              謎を解き明かそう
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-[600px] text-[clamp(15px,2vw,20px)] text-[rgba(231,227,245,.78)] sm:mt-6"
            >
              NAZOMATICで、あなたの謎解き力を極限まで高めよう。
            </motion.p>
          </motion.section>

          <section id="tools" className="mb-16 scroll-mt-20">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-6 flex items-baseline gap-3 sm:mb-8"
            >
              <h2 className="text-2xl font-bold sm:text-3xl">ツール一覧</h2>
              <span className="text-sm tracking-[0.1em] text-[#a98bff]">
                {featuresData.features.length} TOOLS
              </span>
            </motion.div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {featuresData.features.map((feature, index) => {
                const IconComponent = LucideIcons[
                  feature.iconName as keyof typeof LucideIcons
                ] as LucideIcons.LucideIcon;

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
                        <IconComponent className="h-6 w-6" />
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

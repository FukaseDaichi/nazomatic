"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { baseURL } from "@/app/config";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdComponent = () => {
  // const pathname = usePathname();　page遷移ごとに表示するためのもの
  useEffect(() => {
    const adsbygoogle = window.adsbygoogle || [];
    try {
      adsbygoogle.push({});
    } catch (e) {
      console.error("AdSense initialization error:", e);
    }
  }, []);

  if (baseURL.includes("localhost")) {
    return <></>; // 広告を表示しない
  }

  return (
    <>
      <Script
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9744981433842030"
        crossOrigin="anonymous"
      ></Script>

      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-9744981433842030"
        data-ad-slot="7909742233"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </>
  );
};

export default AdComponent;

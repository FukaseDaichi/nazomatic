"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { baseURL } from "@/app/config";

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export const AdComponent = () => {
  const [showAds, setShowAds] = useState(false);

  useEffect(() => {
    // localhost のときは広告非表示
    if (baseURL.includes("localhost")) {
      setShowAds(false);
      return;
    }

    // PWA(standalone) で起動しているか判定
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      // PWA のときは広告を表示しない
      setShowAds(false);
      return;
    }

    // 通常ブラウザ表示のときだけ広告を出す
    setShowAds(true);

    try {
      const adsbygoogle = window.adsbygoogle || [];
      adsbygoogle.push({});
    } catch (e) {
      console.error("AdSense initialization error:", e);
    }
  }, []);

  if (!showAds) {
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

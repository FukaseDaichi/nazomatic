"use client";
import { useEffect, useSyncExternalStore } from "react";
import Script from "next/script";
import { baseURL } from "@/app/config";

declare global {
  interface Window {
    adsbygoogle?: any[];
  }
}

const X_BROWSER_SESSION_KEY = "nazomatic-hide-ads-for-x";

export const AdComponent = () => {
  // サーバー描画・ハイドレーション時は非表示とし、クライアントで判定する
  const showAds = useSyncExternalStore(
    subscribeNoop,
    shouldShowAds,
    () => false,
  );

  useEffect(() => {
    if (!showAds) {
      return;
    }

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (e) {
      console.error("AdSense initialization error:", e);
    }
  }, [showAds]);

  if (!showAds) {
    return <></>; // 広告を表示しない
  }

  return (
    <>
      <Script
        strategy="lazyOnload"
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9744981433842030"
        crossOrigin="anonymous"
      ></Script>

      <ins
        className="adsbygoogle"
        // 遅延読み込みで広告が後から挿入されるため、あらかじめ高さを確保して
        // レイアウトシフト(CLS)を防ぐ
        style={{ display: "block", minHeight: 100 }}
        data-ad-client="ca-pub-9744981433842030"
        data-ad-slot="7909742233"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </>
  );
};

export default AdComponent;

// 判定に使う値はページ表示中に変化しないため、購読は不要
function subscribeNoop() {
  return () => {};
}

function shouldShowAds() {
  // localhost のときは広告非表示
  if (baseURL.includes("localhost")) {
    return false;
  }

  // PWA(standalone) で起動しているか判定
  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    // PWA のときは広告を表示しない
    return false;
  }

  if (isXBrowserSession()) {
    return false;
  }

  // 通常ブラウザ表示のときだけ広告を出す
  return true;
}

function isXBrowserSession() {
  if (readSessionFlag(X_BROWSER_SESSION_KEY)) {
    return true;
  }

  const referrer = document.referrer;
  const referrerHost = getHostname(referrer);
  const userAgent = navigator.userAgent.toLowerCase();
  const isFromX =
    referrerHost === "x.com" ||
    referrerHost.endsWith(".x.com") ||
    referrerHost === "twitter.com" ||
    referrerHost.endsWith(".twitter.com") ||
    referrerHost === "t.co" ||
    userAgent.includes("twitter");

  if (isFromX) {
    writeSessionFlag(X_BROWSER_SESSION_KEY);
  }

  return isFromX;
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function readSessionFlag(key: string) {
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeSessionFlag(key: string) {
  try {
    sessionStorage.setItem(key, "true");
  } catch {
    // Storage can be unavailable in restricted browser modes.
  }
}

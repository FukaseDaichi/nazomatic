import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FONT_PATH = fileURLToPath(new URL("../../public/font/OhisamaFont.ttf", import.meta.url));

// 集計データだけを文字として描画する。生成画像に数字や日付を任せない。
export function observationCardLabels(pastWindow) {
  const date = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Invalid observation card date");
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error("Invalid observation card date");
    }
    return value;
  };
  const start = date(pastWindow?.startDate);
  const end = date(pastWindow?.endDate);
  if (Date.parse(end) - Date.parse(start) !== 6 * 86_400_000) {
    throw new Error("Observation card must cover seven days");
  }
  if (!Number.isSafeInteger(pastWindow.count) || pastWindow.count < 0) {
    throw new Error("Invalid observation card count");
  }
  return {
    range: `${start.replaceAll("-", ".")} — ${end.replaceAll("-", ".")}`,
    count: String(pastWindow.count),
  };
}

export async function renderObservationLogCard({
  illustrationPath,
  workDir,
  pastWindow,
  browserChannel,
  chromeExecutablePath,
}) {
  const labels = observationCardLabels(pastWindow);
  const [illustration, font] = await Promise.all([
    fs.readFile(illustrationPath),
    fs.readFile(FONT_PATH),
  ]);
  const mime = illustration[0] === 0x89 ? "image/png" : "image/jpeg";
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({
    headless: true,
    ...(chromeExecutablePath
      ? { executablePath: chromeExecutablePath }
      : browserChannel ? { channel: browserChannel } : {}),
  });
  try {
    // 投稿用のログイン済みブラウザから独立した、通信しない描画用ページ。
    const page = await browser.newPage({ viewport: { width: 1200, height: 675 }, deviceScaleFactor: 1 });
    await page.route("**/*", (route) => route.abort());
    await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
      @font-face { font-family: Ohisama; src: url(data:font/ttf;base64,${font.toString("base64")}); }
      * { box-sizing: border-box; }
      body { margin: 0; width: 1200px; height: 675px; overflow: hidden; background: #f8f4ff; color: #302143; font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; }
      .art { position: absolute; inset: 0; width: 1200px; height: 675px; object-fit: cover; }
      .wash { position: absolute; inset: 0; background: linear-gradient(90deg, #fcfaff 0%, #fcfafff5 34%, #fcfaff99 43%, transparent 55%); }
      .note { position: absolute; left: 44px; top: 44px; width: 456px; height: 587px; border: 2px solid #e3d6f2; border-radius: 28px; background: #fffffff0; padding: 32px; box-shadow: 0 12px 35px #65428a12; }
      .brand { font: 600 15px sans-serif; letter-spacing: 3px; color: #8d6ba9; }
      h1 { font: 40px/1.4 Ohisama, sans-serif; margin: 20px 0 8px; white-space: nowrap; color: #634298; }
      .range { font: 15px/1.6 sans-serif; letter-spacing: 1px; color: #816e91; }
      .rule { height: 2px; background: #ecdfF5; margin: 24px 0; }
      .label { font-size: 21px; line-height: 1.7; }
      .count { display: flex; align-items: baseline; gap: 14px; color: #7650ac; margin: 6px 0 14px; }
      .number { font: 700 ${Math.min(112, Math.floor(310 / (labels.count.length * 0.65)))}px/1.12 sans-serif; letter-spacing: -2px; }
      .unit { font-size: 26px; }
      .foot { font-size: 15px; line-height: 1.8; color: #806e8c; }
      .signature { position: absolute; bottom: 28px; left: 32px; font: 25px Ohisama, sans-serif; color: #b473a2; }
    </style></head><body>
      <img class="art" alt="" src="data:${mime};base64,${illustration.toString("base64")}">
      <div class="wash"></div>
      <main class="note">
        <div class="brand">NAZOMATIC / WEEKLY DIARY</div>
        <h1>今週の観測だより</h1>
        <div class="range">${labels.range}</div>
        <div class="rule"></div>
        <div class="label">日程がこの7日間に該当する<br>謎チケ情報</div>
        <div class="count"><span class="number">${labels.count}</span><span class="unit">件</span></div>
        <div class="foot">※ 公演数・残席数ではありません</div>
        <div class="signature">観測担当より</div>
      </main>
    </body></html>`, { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images, (img) => img.decode()));
      if (!document.fonts.check("40px Ohisama")) throw new Error("Observation card font failed to load");
    });
    const outputPath = path.join(workDir, "observation-log.png");
    await page.screenshot({ path: outputPath, type: "png" });
    return outputPath;
  } finally {
    await browser.close();
  }
}

import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

test("keeps the Persian app shell and metadata correct", async () => {
  const [layout, css, page, manifest, sw, packageJson, appFiles] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readdir(new URL("../app", import.meta.url)),
  ]);

  assert.match(layout, /lang="fa"/);
  assert.match(layout, /dir="rtl"/);
  assert.doesNotMatch(layout, /next\/font\/google|Geist|codex-preview/);
  assert.match(css, /@font-face[\s\S]+\/fonts\/estedad-arabic\.woff2/);
  assert.match(css, /@font-face[\s\S]+\/fonts\/estedad-latin\.woff2/);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic/);
  assert.doesNotMatch(css, /Vazirmatn|vazirmatn/);
  assert.match(css, /scrollbar-width:\s*none/);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /\.edit-dialog/);
  assert.match(css, /\.edit-scroll/);
  assert.match(css, /\.edit-footer/);
  assert.match(page, /dailyPrices|serviceWorker|\/api\/prices\/sync|PersianDatePicker|jalaliToIso|formatPriceInput/);
  assert.match(page, /قیمت واحد \(تومان\)/);
  assert.match(page, /کارمزد \(تومان\)/);
  assert.match(page, /ثبت قیمت روز/);
  assert.match(page, /سود\/زیان امروز/);
  assert.match(page, /جزئیات روزانه/);
  assert.match(page, /بازگردانی قیمت TGJU/);
  assert.match(page, /حالت نمایش/);
  assert.match(page, /ویرایش دارایی/);
  assert.match(page, /قیمت کل در زمان خرید/);
  assert.match(page, /قیمت کل بر اساس قیمت امروز/);
  assert.match(page, /میزان سود تا امروز/);
  assert.doesNotMatch(page, /قیمت مبنا/);
  assert.doesNotMatch(page, /سرمایه باقی‌مانده/);
  assert.doesNotMatch(page, /سود محقق‌شده/);
  assert.match(page, /AssetHistoryChart|MiniProfitChart/);
  assert.match(manifest, /سرمایه من|Ø³Ø±Ù…Ø§ÛŒÙ‡ Ù…Ù†/);
  assert.match(sw, /CACHE_NAME/);
  assert.doesNotMatch(`${layout}\n${manifest}\n${sw}`, /https?:\/\//i);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|@fontsource|lucide-react/);
  assert.ok(!appFiles.includes("_sites-preview"), "starter preview directory should be removed");
});

test("build output has no remote static resources", async () => {
  await Promise.all([
    access(new URL("../dist/client/manifest.webmanifest", import.meta.url)),
    access(new URL("../dist/client/sw.js", import.meta.url)),
    access(new URL("../dist/client/fonts/estedad-arabic.woff2", import.meta.url)),
    access(new URL("../dist/client/fonts/estedad-latin.woff2", import.meta.url)),
    access(new URL("../dist/client/onboarding-free.webp", import.meta.url)),
    access(new URL("../dist/client/onboarding-privacy.webp", import.meta.url)),
    access(new URL("../dist/client/onboarding-easy.webp", import.meta.url)),
  ]);

  const assetDir = new URL("../dist/client/assets/", import.meta.url);
  const assetFiles = await readdir(assetDir);
  const cssAssets = await Promise.all(
    assetFiles
      .filter((file) => /\.css$/.test(file))
      .map(async (file) => readFile(new URL(file, assetDir), "utf8")),
  );
  const pwaAssets = await Promise.all([
    readFile(new URL("../dist/client/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../dist/client/sw.js", import.meta.url), "utf8"),
  ]);
  const staticText = [...cssAssets, ...pwaAssets].join("\n");
  assert.match(staticText, /\/fonts\/estedad-arabic\.woff2/);
  assert.match(staticText, /\/fonts\/estedad-latin\.woff2/);
  assert.match(staticText, /\/onboarding-free\.webp/);
  assert.doesNotMatch(staticText, /Vazirmatn|vazirmatn|googletagmanager|cdn\.|fonts\.googleapis|fonts\.gstatic/i);

  const remoteReferences = [...staticText.matchAll(/(?:url\(|@import\s+)["']?(https?:[^"')\s;]+)/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(remoteReferences)], []);
});

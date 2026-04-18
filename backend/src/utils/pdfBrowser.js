import puppeteer from "puppeteer";

let browserPromise = null;

const launchBrowser = async () =>
  puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

export const getSharedPdfBrowser = async () => {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((error) => {
      browserPromise = null;
      throw error;
    });
  }

  return browserPromise;
};

export const closeSharedPdfBrowser = async () => {
  if (!browserPromise) return;

  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // no-op
  } finally {
    browserPromise = null;
  }
};

export const renderPdfBufferFromHtml = async (
  htmlContent,
  {
    waitUntil = "domcontentloaded",
    pdfOptions = {},
  } = {}
) => {
  const browser = await getSharedPdfBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(htmlContent, { waitUntil });
    const pdfRaw = await page.pdf(pdfOptions);
    return Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
  } finally {
    await page.close();
  }
};

process.once("exit", () => {
  void closeSharedPdfBrowser();
});

process.once("SIGINT", () => {
  void closeSharedPdfBrowser().finally(() => process.exit(0));
});

process.once("SIGTERM", () => {
  void closeSharedPdfBrowser().finally(() => process.exit(0));
});

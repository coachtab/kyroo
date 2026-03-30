const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) { console.log('Usage: node convert.js <file.svg>'); process.exit(1); }

const svgPath = path.resolve(input);
const pngPath = svgPath.replace('.svg', '.png');

(async () => {
  const svg = fs.readFileSync(svgPath, 'utf-8');
  const html = `<html><body style="margin:0;padding:0;background:#060606">${svg}</body></html>`;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080 });
  await page.setContent(html);
  await page.screenshot({ path: pngPath, type: 'png' });
  await browser.close();

  console.log('Saved:', pngPath);
})();

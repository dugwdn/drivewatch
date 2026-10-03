const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ });
  const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
  for (const n of [1,2,3,4,5]) { await p.goto('file://' + __dirname + '/' + n + '.html'); await p.screenshot({ path: __dirname + '/' + n + '.png' }); }
  await b.close();
})();

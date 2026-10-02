// Playwright CLI: run-code --filename=tools/verify-website-links.js
// Start: python3 -m http.server 8766 --bind 127.0.0.1
// Open http://127.0.0.1:8766/site/ before running.
// Failure modes: missing targets/anchors/assets, obsolete release claims,
// misleading onboarding/storage claims, viewport overflow, browser errors.
async page => {
  const base = new URL('/site/', page.url()).href;
  const results = [];
  const failures = [];
  const external = new Set();
  page.on('pageerror', error => failures.push(String(error)));
  page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
  await page.route('**/*', route => route.continue());
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['', 'docs/', 'docs/install.html', 'docs/commands.html', 'docs/workflow.html', 'docs/troubleshooting.html']) {
      await page.goto(new URL(path, base).href);
      const audit = await page.evaluate(async () => {
        const failures = [];
        const external = [];
        const urls = [...new Set([...document.querySelectorAll('[href], [src]')].map(el => new URL(el.getAttribute('href') || el.getAttribute('src'), location.href).href))];
        for (const url of urls) {
          const target = new URL(url);
          if (target.origin !== location.origin) { external.push(url); continue; }
          const response = await fetch(target.href);
          if (!response.ok) { failures.push(`HTTP ${response.status}: ${url}`); continue; }
          if (target.hash) {
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            if (!doc.getElementById(decodeURIComponent(target.hash.slice(1)))) failures.push(`Missing anchor: ${url}`);
          }
        }
        for (const image of document.images) {
          image.loading = 'eager';
          try { await image.decode(); } catch { failures.push(`Image failed: ${image.src}`); }
        }
        if (document.documentElement.scrollWidth > innerWidth) failures.push(`Page overflow: ${document.documentElement.scrollWidth} > ${innerWidth}`);
        return { failures, external, links: urls.length };
      });
      audit.external.forEach(url => external.add(url));
      failures.push(...audit.failures);
      if (!path) {
        const text = await page.locator('body').innerText();
        if (/Spectra\s+\d+\.\d+\.\d+/i.test(text)) failures.push('Home contains a fixed release label');
        if (text.includes('Everything Spectra owns lives under')) failures.push('Home omits required adapter paths outside .spectra');
        if (text.includes('from repo facts')) failures.push('Home onboarding omits interactive answers');
        if (await page.locator('a[href="https://github.com/yunusakin/spectra/releases/latest"]').count() !== 1) failures.push('Home must link to latest release');
        await page.screenshot({ path: `.tmp/website-links/home-${width}.png`, fullPage: true });
      }
      results.push({ path: path || 'index.html', width, links: audit.links });
    }
  }
  const report = { base, results, external: [...external].sort(), failures };
  await page.evaluate(report => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'website-links-results.json'; a.click();
  }, report);
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) throw new Error(failures.join('\n'));
}

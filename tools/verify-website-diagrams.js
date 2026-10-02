// Run with Playwright CLI: run-code --filename=tools/verify-website-diagrams.js
// Failure modes: missing explanations, misleading required steps, mismatched
// SVG/card groups, missing images/links, hidden writes, keyboard traps, overflow,
// unreadable text, or content that requires JavaScript. This is a browser E2E.
async page => {
  const base = await page.evaluate(() => `${location.origin}/site/`);
  const results = [];
  const errors = [];
  const expect = (condition, message) => { if (!condition) throw new Error(message); };
  // Routing without changing responses disables the browser HTTP cache, so
  // local CSS/SVG edits cannot be hidden by a prior verification session.
  await page.route("**/*", route => route.continue());
  page.on("pageerror", error => errors.push(String(error)));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  const sizes = [{ width: 1440, height: 1000 }, { width: 768, height: 1024 }, { width: 390, height: 844 }];
  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const name of ["commands", "workflow"]) {
      await page.goto(`${base}docs/${name}.html?verify=${Date.now()}`);
      const sections = name === "commands" ? ["setup", "daily", "maintenance"] : ["workflow"];
      if (name === "commands") {
        expect(await page.locator(".command-effects-table tbody tr").count() === 21, "Keep all 21 commands");
        expect(await page.locator(".diagram-card").count() === 13, "Missing diagram explanation cards (expected 13)");
        for (const id of ["setup", "daily", "maintenance"]) {
          const section = page.locator(`#${id}`);
          expect(await section.locator(".diagram-legend").count() === 1, `${id}: missing legend`);
          expect(await section.locator(".diagram-open").count() === 1, `${id}: missing large view`);
          const href = await section.locator(".diagram-open").getAttribute("href");
          const svgResponse = await page.request.get(new URL(href, `${base}docs/commands.html`).href);
          expect(svgResponse.ok(), `${id}: broken SVG link`);
          const svg = await svgResponse.text();
          expect(svg.includes("<title") && svg.includes("<desc"), `${id}: SVG needs title and description`);
          const svgText = await page.evaluate(source => new DOMParser().parseFromString(source, "image/svg+xml").documentElement.textContent.replace(/\s+/g, " "), svg);
          const labels = await section.locator(".diagram-card h3").allTextContents();
          for (const label of labels) expect(svgText.includes(label.trim()), `${id}: SVG/card label mismatch: ${label}`);
          const viewWidth = Number(svg.match(/viewBox="[^"]*"/)[0].split('"')[1].split(" ")[2]);
          const renderedWidth = await section.locator(".diagram-scroll img").evaluate(el => el.getBoundingClientRect().width);
          expect(18 * renderedWidth / viewWidth >= 16, `${id}: diagram labels shrink below 16px`);
        }
        const text = await page.locator("#daily").innerText();
        expect(text.includes("product-approved") && text.includes("technical-approved") && text.includes("implementation-approved"), "Missing approval stages");
        expect(text.includes("failed") && text.includes("command-mode"), "Hidden failed-run or application writes");
        const maintenance = await page.locator("#maint-doctor").innerText();
        expect(maintenance.includes("detected adapter set") && maintenance.includes("required tool"), "Doctor adapter repair must describe detection and tool prerequisites");
      } else {
        expect(await page.locator('a[href="./commands.html#daily"]').count() > 0, "Workflow must link to full explanation");
      }
      for (const id of sections) {
        const section = page.locator(`#${id}`);
        const image = section.locator(".diagram-scroll img");
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(i => i.decode());
        expect(await image.evaluate(i => i.complete && i.naturalWidth > 0), `${id}: image failed`);
        const scroll = section.locator(".diagram-scroll");
        expect(await scroll.getAttribute("tabindex") === "0", `${id}: scroll area is not keyboard accessible`);
        expect(!!await scroll.getAttribute("aria-label"), `${id}: unnamed scroll area`);
        expect(await scroll.evaluate(el => el.scrollHeight <= el.clientHeight + 1), `${id}: diagram must not require nested vertical scrolling`);
        if (size.width >= 1024) expect(await scroll.evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${id}: diagram must fit desktop width`);
        await scroll.focus();
        expect(await scroll.evaluate(el => el === document.activeElement && getComputedStyle(el).outlineStyle !== "none"), `${id}: no visible keyboard focus`);
        await scroll.evaluate(el => { el.scrollLeft = 0; });
        const before = await scroll.evaluate(el => el.scrollLeft);
        await page.keyboard.press("ArrowRight");
        await page.waitForFunction(() => [...document.querySelectorAll(".diagram-scroll")].some(el => el === document.activeElement && (el.scrollWidth <= el.clientWidth || el.scrollLeft > 0)));
        expect(await scroll.evaluate((el, previous) => el.scrollWidth <= el.clientWidth || el.scrollLeft > previous, before), `${id}: arrow key did not scroll`);
        await scroll.evaluate(el => { el.scrollLeft = 0; });
        await scroll.evaluate(el => el.scrollTo({ top: 0, left: 0, behavior: "instant" }));
        await scroll.evaluate(el => el.blur());
        await section.screenshot({ path: `output/playwright/website-diagrams/${name}-${id}-${size.width}.png`, style: ".site-header { visibility: hidden; }" });
      }
      const layout = await page.evaluate(() => {
        const overflow = [...document.querySelectorAll(".diagram-card, .diagram-card code")].filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.id || el.textContent);
        const smallText = [...document.querySelectorAll(".diagram-card p, .diagram-card dd, .diagram-card code")].filter(el => parseFloat(getComputedStyle(el).fontSize) < (el.tagName === "CODE" ? 14 : 16)).map(el => el.textContent);
        return { viewport: innerWidth, pageWidth: document.documentElement.scrollWidth, overflow, smallText, columns: document.querySelector(".diagram-cards") ? getComputedStyle(document.querySelector(".diagram-cards")).gridTemplateColumns.split(" ").length : null };
      });
      expect(layout.pageWidth <= layout.viewport, `${name}: page overflow ${JSON.stringify(layout)}`);
      expect(layout.overflow.length === 0 && layout.smallText.length === 0, `${name}: clipped or small card text`);
      if (name === "commands") expect(layout.columns === (size.width <= 720 ? 1 : 2), "Wrong responsive card layout");
      const broken = await page.evaluate(async () => {
        const failures = [];
        for (const link of document.querySelectorAll("a[href]")) {
          const url = new URL(link.href);
          if (url.origin !== location.origin) continue;
          const response = await fetch(url.pathname, { cache: "no-store" });
          if (!response.ok) failures.push(link.href);
          else if (url.hash) {
            const doc = new DOMParser().parseFromString(await response.text(), "text/html");
            if (!doc.getElementById(decodeURIComponent(url.hash.slice(1)))) failures.push(link.href);
          }
        }
        return failures;
      });
      expect(broken.length === 0, `Broken local links: ${broken.join(", ")}`);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.screenshot({ path: `output/playwright/website-diagrams/${name}-${size.width}.png`, fullPage: true });
      results.push({ page: name, ...size, ...layout, brokenLinks: broken });
    }
  }
  const context = await page.context().browser().newContext({ javaScriptEnabled: false, viewport: sizes[2] });
  try {
    const noJS = await context.newPage();
    for (const name of ["commands", "workflow"]) {
      await noJS.goto(`${base}docs/${name}.html?verify=${Date.now()}`);
      expect(await noJS.locator(".diagram-scroll").count() === (name === "commands" ? 3 : 1), `${name}: missing diagrams without JavaScript`);
      if (name === "commands") expect(await noJS.locator(".diagram-card").count() === 13, "Missing explanations without JavaScript");
      for (const image of await noJS.locator(".diagram-scroll img").all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(i => i.decode());
      }
      await noJS.screenshot({ path: `output/playwright/website-diagrams/${name}-no-js.png`, fullPage: true });
      results.push({ page: name, javaScriptEnabled: false, passed: true });
    }
  } finally { await context.close(); }
  expect(errors.length === 0, `Browser errors: ${errors.join("; ")}`);
  return { passed: true, base, results, browserErrors: errors, screenshots: "output/playwright/website-diagrams/" };
}

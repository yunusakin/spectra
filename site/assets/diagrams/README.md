# Website diagram maintenance

The website combines static SVG relationship diagrams with complete, responsive
HTML explanations on the Commands page. Workflow reuses the same workflow SVG
and links to those explanations. No browser-side renderer or JavaScript is needed.

## Content and visual contract

- `setup.mmd`: groups S1–S4, matching the `setup-*` explanation cards.
- `workflow.mmd`: groups W1–W5, matching the `work-*` explanation cards.
- `maintenance.mmd`: groups M1–M4, matching the `maint-*` explanation cards.
- Keep group titles identical in SVG and HTML. Keep command effects consistent
  with the [CLI Reference](../../../docs/cli-reference.md).
- Purple identifies commands, teal results, amber conditions, and neutral panels
  identify inputs, human/agent work or preservation boundaries. Labels carry the
  meaning independently of color. Dashed arrows have explicit optional/conditional
  labels. Invisible Mermaid links control layout only; they do not indicate steps.
- `theme.json` uses the existing site palette and system font stack. SVG text uses
  native SVG labels, so opening a file does not require HTML `foreignObject` support.
- The diagram viewport is bounded to 75vh / 800px. Native scrolling preserves
  readable labels while keeping the HTML explanations close to the graphic.
  Arrow keys work in both directions; full-size links offer an unbounded view.

## Reproduce the SVGs

Run from the repository root with Node/npm and Chrome available. Mermaid CLI is a
temporary development tool, pinned to 11.12.0; do not add it to production packages.
Use the same Chrome build for byte-for-byte exports; font metrics can vary between
platforms, so review every regenerated SVG.

Create a temporary Puppeteer JSON configuration containing your installed browser:

```json
{"executablePath":"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
```

For each name `setup`, `workflow`, and `maintenance`, run this command with the
name substituted in both filenames:

```sh
PUPPETEER_SKIP_DOWNLOAD=true npx -y @mermaid-js/mermaid-cli@11.12.0 \
  -i site/assets/diagrams/setup.mmd \
  -o site/assets/command-effects-setup.svg \
  -c site/assets/diagrams/theme.json \
  -p /tmp/spectra-mermaid-browser.json -b transparent
```

After regeneration, check the SVG `viewBox` width against the corresponding HTML
`--diagram-min-width`. With 18px source labels, the displayed width must be at least
the `viewBox` width multiplied by 16/18. Preserve all source text when wrapping it.
Update the workflow minimum width on both Commands and Workflow pages together.

## Repeat the browser E2E

The standalone E2E function is `tools/verify-website-diagrams.js`. It is run by
Playwright CLI rather than the CLI runtime test runner. Failure scenarios are
listed at its start. It verifies both pages at 1440×1000, 768×1024 and 390×844;
keyboard scrolling/focus, labels, local links, responsive text and no-JavaScript
rendering. It retains screenshots and a JSON result for review.

From the repository root, create the output directory and start a local server:

```sh
mkdir -p output/playwright/website-diagrams
python3 -m http.server 8766 --bind 127.0.0.1
```

In another terminal:

```sh
npx -y --package @playwright/cli@0.1.22 playwright-cli \
  --session spectra-website open http://127.0.0.1:8766/site/docs/commands.html
npx -y --package @playwright/cli@0.1.22 playwright-cli \
  --session spectra-website --raw run-code \
  --filename=tools/verify-website-diagrams.js \
  > output/playwright/website-diagrams/results.json
npx -y --package @playwright/cli@0.1.22 playwright-cli \
  --session spectra-website close
```

Inspect the JSON result and screenshots; a successful run has `passed: true`,
eight page/viewport or no-JavaScript results, and no browser errors. CLI errors are
printed into the result file and return a nonzero status. Artifacts are local review
evidence; do not publish them as website assets.

Also run `npm test`, `npm run check`, the version-parity check and branch policy
check. The website change must not modify CLI behavior, installed guides or versions.

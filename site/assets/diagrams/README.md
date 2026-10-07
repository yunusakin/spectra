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
  Set `htmlLabels: false` at the top level; the deprecated flowchart-only setting
  does not reliably disable HTML labels in Mermaid 11.12.0. Group and node heading
  styles target the generated `tspan` elements, whose normal font-weight attributes
  otherwise override inherited heading styles.
  White command cards have purple borders and monospace command headings; results
  use paper-teal, conditions use amber, and inputs use paper-blue. Rounded corners,
  subtle card shadows and group headings match the website documentation panels.
- Condition nodes use compact rounded rectangles with a dashed border and a
  question-style heading, so they are distinguishable without color. This avoids the
  large empty corners required by diamond shapes. Supporting (non-workflow) commands
  use a grey border.
- Diagram labels are a short heading plus a short function (commands in monospace,
  everything else in the UI font). Exact side effects live in the HTML explanation
  cards, not in the SVG. Edge labels stay at one to three words.
- `theme.json` uses Mermaid's `look: neo` with `curve: rounded`, which both work in
  the pinned 11.12.0; there is no reason to upgrade Mermaid or use ELK for these diagrams.
  Each diagram must stay within about 1,160 units of `viewBox` width so the
  16px minimum still fits the 1,036px desktop container (800px on the Workflow page).
- Diagrams use their full height in the page, without a nested vertical scrollbar.
  Desktop diagrams fit the content width. Narrow screens retain horizontal
  scrolling when needed to keep labels at least 16px; left/right arrow keys and
  full-size links remain available. HTML explanations retain all detail.

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
keyboard horizontal scrolling/focus, absence of nested vertical scrolling,
desktop fit, labels, local links, responsive text and no-JavaScript
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

Run `tools/verify-website-links.js` the same way (`--filename=tools/verify-website-links.js` after opening `http://127.0.0.1:8766/site/`) to check every internal link, anchor, image and page overflow at 1440 and 390 px. Both tools count the commands table, so update them when a public command is added.

Also run `npm test`, `npm run check`, the version-parity check and branch policy
check. The website change must not modify CLI behavior, installed guides or versions.

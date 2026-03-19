# Color Focus

Color Focus is a Manifest V3 Chrome extension that color-codes long-form English webpage text by
part of speech to reduce visual monotony while reading.

## What It Does

- Colors readable article text by grammatical role using bundled `compromise`
- Preserves links and inline formatting by wrapping text nodes instead of replacing parent HTML
- Detects light versus dark page backgrounds and switches palettes automatically
- Watches for dynamically added content while the extension is active
- Keeps activation tab-local; reloading the page or opening a new page starts inactive
- Persists only the popup theme mode setting: `auto`, `light`, or `dark`

## Current Scope

- English-only behavior when the page declares a language via `document.documentElement.lang`
- Popup-first interaction model
- No per-site memory
- No global always-on mode
- No options page

## Load In Chrome

1. Open `chrome://extensions/`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select `/Users/joo/projects/ColorFocus`

## Development

Run the syntax check pass:

```bash
npm run check
```

Reload the extension after code changes from `chrome://extensions/`, then reload the target page.

## Manual QA Checklist

- Toggle on and off on a long article page
- Verify links remain clickable after coloring
- Verify `<strong>` and `<em>` formatting survives
- Verify code blocks are skipped
- Verify nav, footer, and form UI stay untouched
- Verify the popup reports unsupported tabs cleanly
- Verify a page with `lang="es"` or another non-English value is skipped
- Verify dynamically added content is colored only while the extension is active

## Project Layout

- `manifest.json`: MV3 manifest and asset wiring
- `background.js`: popup relay and stored theme mode access
- `content.js`: tab-local state, activation lifecycle, observer, chunked processing
- `lib/textDetector.js`: readable block detection and text-node collection
- `lib/colorEngine.js`: POS tag mapping, span wrapping, unwrap logic
- `lib/themeDetector.js`: page theme detection and theme attribute management
- `popup/`: popup UI
- `styles/colorfocus.css`: injected color variables and selectors

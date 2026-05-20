# wowMD Brand Assets

This folder is the source for the current wowMD visual direction.

- Logo direction: violet reading mark plus `wowMD` wordmark.
- Display type: `Space Grotesk`.
- Fallback stack: `Inter`, system UI, sans-serif.
- Primary color: `#5B4DFF`.
- Product page background: `#1E1E1C`.

Use `logo-lockup.svg` for dark website headers, `logo-mark.svg` for icons and compact buttons, and `logo-wordmark.svg` when the icon is already present nearby.

Use the `*-light-bg.svg` files on white or light backgrounds. In those versions, `MD` uses `#2B2B29` instead of warm white so it remains visible in Chrome Web Store, README, docs, and email-style surfaces.

For release channels that must render identically everywhere, use the outlined assets:

- `logo-wordmark-outlined.svg`
- `logo-lockup-outlined.svg`
- `logo-wordmark-light-bg-outlined.svg`
- `logo-lockup-light-bg-outlined.svg`

The outlined files convert the `wowMD` text to SVG paths from Space Grotesk, so they do not depend on installed fonts.

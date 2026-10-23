# AZELVORI STUDIO — Brand Asset Implementation v1

**Date:** 2026-10-23 | **State:** original draft art integrated in source | **Release:** requires independent QA

This document describes the **actual files** added to the repository, rather than placeholders or image-generation prompts. The imagery was created as editable vector artwork and palette PNG through software. It is a **first design iteration**, not a registered logo or final trademark clearance.

## Files checked into repository

| Usage | Path | Format |
|---|---|---|
| Master AZ symbol | `apps/web/public/brand/azelvori-symbol.svg` | editable SVG |
| Horizontal studio lock-up | `apps/web/public/brand/azelvori-logo-horizontal.svg` | editable SVG |
| Browser favicon | `apps/web/public/favicon.svg` | SVG; mirrors approved-on-branch mark |
| Favicon browser fallback | `apps/web/public/favicon.png` | real indexed PNG, 48×48 |
| Apple touch icon | `apps/web/public/apple-touch-icon.png` | real indexed PNG, 180×180 |
| Company profile avatar | `apps/web/public/brand/azelvori-company-avatar.png` | real PNG, 1024×1024 |
| Profile vector variant | `apps/web/public/brand/azelvori-company-avatar.svg` | editable SVG |
| Social card | `apps/web/public/brand/azelvori-social-cover.png` | real PNG, 1200×630 |
| Social card master | `apps/web/public/brand/azelvori-social-cover.svg` | editable SVG alternative |
| Home hero desktop | `apps/web/public/brand/azelvori-home-hero.svg` | editable SVG, 1920×1080 |
| Home hero mobile | `apps/web/public/brand/azelvori-home-mobile.svg` | editable SVG, 1080×1350 |
| Company section banner | `apps/web/public/brand/azelvori-company-banner.svg` | editable SVG |
| Customer login artwork | `apps/web/public/brand/azelvori-client-portal-cover.svg` | editable SVG |
| Website development | `apps/web/public/brand/services/service-web-development.svg` | editable SVG |
| Web application | `apps/web/public/brand/services/service-web-application.svg` | editable SVG |
| Game development | `apps/web/public/brand/services/service-game-development.svg` | editable SVG |
| Game bug fixing | `apps/web/public/brand/services/service-game-debugging.svg` | editable SVG |
| UI/UX services | `apps/web/public/brand/services/service-ui-ux-design.svg` | editable SVG; for future dedicated service page |
| Optimization/maintenance | `apps/web/public/brand/services/service-optimization.svg` | editable SVG |
| New project illustration | `apps/web/public/brand/illustrations/azelvori-empty-project.svg` | editable SVG |
| Touch icon SVG master | `apps/web/public/brand/azelvori-touch-icon.svg` | editable SVG |

**Format choice:** illustrations are SVG rather than the earlier proposed WebP files to retain editable geometry, sharp rendering at all sizes, small source files, and zero external rasterization dependencies. Do not rename SVGs to `.webp` without actual conversion.

## Wired to the application
- `apps/web/src/components/Icon.tsx` logo mark now references actual vector artwork.
- `apps/web/src/pages/Home.tsx` uses separate mobile/desktop hero and 5 service illustrations. The extra UI/UX asset is retained for a future separate page.
- `apps/web/src/pages/Account.tsx` uses empty-project artwork in the Founder CRM empty state.
- `apps/web/src/styles.css` adds branded artwork to login, section band and game concept while preserving existing CTA copy and layout.
- `apps/web/index.html` references favicon SVG, PNG fallback, Apple touch PNG, social card image and OG/Twitter text.
- `scripts/verify-hosting.mjs` checks a core set of assets in the actual Vite build output.
- Private client apps/payments/chat are still **not implemented** by this art change.

## Social preview limitations
Until the real AWS domain is known, Open Graph and Twitter image tags point to a **public, absolute URL to the raw PNG in this GitHub repository's `main`**:

`https://raw.githubusercontent.com/tanawutmalirum29-ux/AZELVORI-STUDIO/main/apps/web/public/brand/azelvori-social-cover.png`

This URL will resolve only once the PNG file is merged to `main`. As soon as a production domain is approved and HTTP 200 / image/png is verified, change both social URLs to `https://your-real-domain/brand/azelvori-social-cover.png` and clear the social platform cache if necessary. Not all social apps render/pre-cache the same way.

The active Alpha `noindex,nofollow` settings are deliberately untouched; SEO publication needs a separate compliance review.

## Brand review checklist
- [ ] Owner approves actual AZ logo silhouette and wordmark, including legibility at 16px, 32px, 180px and 1024px.
- [ ] Design reviewer checks visual geometry, kerning, consistency, accessibility, retina and contrast.
- [ ] Search for existing similar marks/companies before selecting a legally protected brand identity.
- [ ] Verify the social PNG contains the correct name and looks intentional when cropped in major messaging/social clients.
- [ ] Validate no accidental letter misspellings (logo text in SVG is editable).
- [ ] Verify actual browser favicon requests return image/svg+xml and image/png; caches can still show old globe.
- [ ] Confirm all images load without 404 and footer/header do not overflow narrow screens.
- [ ] Confirm website remains a development preview; avoid inaccurate claims about registered company status or live customer systems.

## AWS Amplify QA
GitHub workflow and Amplify build run the static-hosting preflight. Actual AWS deploy still requires configured repository connection and a verified deployed URL. Approval gate: GitHub CI (unit / build / Playwright Chromium + WebKit × 5 viewport targets) and manual visual review before production.

## Future refinement
A graphic designer should review the v1 logo as a proposal, refine it as true vector shapes and package final brand guidelines (colors, safe area, min size, alternate reverse mark and contrast). Existing vector assets are deliberately editable so a final approved logo can replace them without rebuilding the website architecture.

# Stussy showcase store verification

Verified 2026-11-07, Asia/Bangkok, on Windows 10.0.26300, Node 24.21.0 and npm 11.19.0. Worktree: `.worktrees/stussy-showcase-store`; branch: `feature/stussy-showcase-store`; starting commit: `7e1fc401492d64be11554d470c3a2b89f59df186`.

## Result and boundary

The local showcase, thirteen-product demo catalog, wishlist, cart, and simulated checkout passed automated and real Chromium verification. Three observed visual defects were fixed with small CSS changes and browser regressions. No backend, real payment, email, delivery, inventory provider, deployment, or assistive-technology speech was tested or claimed.

Read before QA: authoritative design spec, Task 10 and final acceptance checklist, workflow ledger, Tasks 1–9 reports, and the installed Playwright interactive skill. The inventory was written before browser testing at the ignored workflow path `qa-inventory.md` beside the Task 10 brief.

## Clean automated checks

| Command | Exit | Actual result |
| --- | --- | --- |
| `npm.cmd ci` | 0 | 105 packages installed; 106 audited; 0 vulnerabilities; lockfile unchanged |
| `npm.cmd run assets:verify` | 0 | 18 nonempty local assets verified |
| `npm.cmd test` after clean install | 0 | 14 files, 121 tests passed; no failed or skipped tests; 12.80s, 21:14:15 local start |
| `npm.cmd run build` after clean install | 0 | TypeScript and Vite passed; 486 modules; `dist/index.html` generated |
| `npm.cmd test` after fixes | 0 | 14 files, 121 tests passed; no failed or skipped tests; 14.54s, 21:28:43 local start |
| `npm.cmd run build` after fixes | 0 | 486 modules; 603ms; `dist/index.html` 0.41 kB, CSS 18.94 kB (gzip 5.28), JS 453.88 kB (gzip 144.73) |
| Focused browser regression, development and built preview | 0 | All five widths passed white-logo, route-heading focus, retained keyboard ring, single-line Escape, and viewport-fit checks |

The focused runner is `scripts/verify-visual-regressions.mjs`. It uses an existing Playwright installation, with no added package or runtime dependency. Reproduction in this environment:

```powershell
$env:PLAYWRIGHT_MODULE='file:///C:/Users/ASUS/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs'
$env:QA_URL='http://127.0.0.1:4173'
node scripts/verify-visual-regressions.mjs
```

Omit `PLAYWRIGHT_MODULE` when `playwright` is already resolvable in the caller's environment. Start the app or preview before running.

## Browser method and coverage

Used Playwright Core 1.63.0 and real headless Chromium 153.0.8010.12. The interactive Node REPL failed twice before initialization with `windows sandbox failed: helper_unknown_error: setup refresh had errors`. The task-authorized fallback was a scoped Node CLI bridge in ignored workflow files, retaining one browser and named desktop, touch-mobile, recovery, and production contexts across interaction bursts. Shell execution required the existing escalation workaround. No installed configuration or Git global configuration was changed.

Development ran in a persistent TTY at `http://127.0.0.1:5173/` using `npm.cmd run dev -- --host 127.0.0.1 --port 5173`. Built output also ran in a persistent TTY at `http://127.0.0.1:4173/` using `npm.cmd exec vite preview -- --host 127.0.0.1 --port 4173`. Both servers and the browser were stopped at completion.

The persistent browser session recorded 127 successful explicit assertions, including repeated responsive checks, with no page errors. These are separate from the 121 Vitest tests. The critical journey used visible links, clicks, radio/checkbox controls, text entry, selects, keyboard actions, and touch input. DOM evaluation inspected layout, capabilities, storage, and styling; it staged only malformed storage and a safe summary for an independent production-origin reload check. It did not replace checkout interactions.

| Viewport | Header | Home sections | Shop/product/cart/checkout | Horizontal overflow |
| --- | --- | --- | --- | --- |
| 360×800 | 96px, mobile menu | 2 lookbook columns; motifs/about/footer stack | Drawer, stacked product/cart, one-column form | None on all 5 routes |
| 390×844 | 96px, mobile menu | Same; touch context also checked | Same | None on all 5 routes |
| 768×900 | 96px, mobile menu | 12-column asymmetric lookbook, two motifs/about columns | Filter rail, two-column product/cart | None on all 5 routes |
| 1024×900 | 96px, mobile menu | Desktop section arrangement | Rail; three catalog columns | None on all 5 routes |
| 1440×900 | 96px, full navigation | Desktop section arrangement | Full desktop commerce layout | None on all 5 routes |

For every width, captured and reviewed initial route screenshots and full-region lookbook, motif, about-copy/timeline, footer, product, cart, and checkout screenshots. Temporary originals/contact sheets remain ignored workflow artifacts. Numeric checks covered document scroll width and header bounds; the focused runner also measures actual Escape text range width and line count. The page is intentionally vertically scrollable; small-screen product actions and checkout fields remain reachable in normal document order.

## Functional journey and route checks

- Shop → search `8-ball` → Black yielded one product and query state `?q=8-ball&color=Black`.
- Opened 8-Ball Tee — Black. Missing size focused the size radio group with associated error. Keyboard selected M; quantity became 2; add and wishlist toggles succeeded. Reload restored both wishlist state and cart count 2.
- Cart quantity changed to 3, subtotal $144, demo shipping $12, total $156. Clear dialog entered on Cancel, trapped both directions, supported Cancel/Escape and trigger focus return; confirmed clearing was also exercised separately.
- Checkout empty submit focused Name. Fictional required contact/address/card fields and Express demo delivery were entered. Card `4111111111111111` was rejected with inline error and card-field focus. `4242 4242 4242 4242`, future `12/99`, and a three-digit CVC produced `DEMO-ABBE6679`, quantity 3, total $156, an empty cart, and a matching reloadable order route.
- All thirteen catalog detail routes were opened. Unavailable DSM product add was disabled. Breadcrumb navigation, related-card rendering, all four sort modes, category/color/size/availability filters, clear-all, empty search recovery, wishlist remove/clear, cart direct/step quantity edits, individual line removal, and confirmed cart clear were exercised.
- Production-bundle mobile smoke repeated Shop → product → M → add → mobile menu → cart → direct reload → checkout. Cart quantity survived reload. A safe stored summary restored the matching built order route on direct visit and reload. A further real-input built checkout placed a new simulated order and restored its confirmation after reload. All observed production resource requests stayed on `127.0.0.1:4173`.
- Home, Collection, About Us, and Contact links focused their intended hash targets; fixed navigation remained visible while scrolling. Unknown product, unknown order, unknown route, and empty checkout returned their branded recovery states.

## Visual and source observations

Compared the local home with both supplied files under `C:\Users\ASUS\AppData\Local\Temp\rea-stussy-20261107`: `target-desktop.png` and `target-mobile.png`, and consulted the recovered source bundle for source-specific ambiguities.

The same split photography, central script mark, establishment line, HIM/HER labels, title, scroll cue, coral marquee, 13-card order, Escape image/copy, motif panels, four-year timeline, footer/social/newsletter regions, and fixed grain are present. Desktop card spans inspected in order: `7,5,4,4,4,5,3,4,7,5,4,4,4`; mobile has two columns. All home image elements decoded after scrolling through lazy-loaded regions.

The provided desktop capture is 1440×7000 and stretches the hero through almost the entire image, with a partially revealed title; the mobile capture also clips navigation and title. These are useful qualitative references, not dependable pixel/section-layout baselines. Exact pixel identity and exact animation timing are therefore **limited**. Expanded shop/wishlist/cart navigation, a taller 96px header, visible demo disclosures/actions, a usable mobile menu, readable complete title, disabled source social destinations, and local-only newsletter confirmation are intentional differences. Typography uses the specified local system fallbacks rather than fetching source web fonts; image crops, type metrics, brightness, and section spacing are consequently approximate.

The original bundle explicitly pairs `3bc6dff4f_Design2.png` with LUCKY DICE and `dbc15a74d_Design1.jpg` with 8-BALL FLAME, despite the supplied artwork appearing reversed. That observed source pairing was preserved, rather than silently changing source content.

Visual review checked initial view, post-interaction cart/confirmation, full home sections, smaller viewports, and the densest catalog/form states. After the fixes below, no unintended horizontal overflow, distorted media, unreadable overlaps, clipped controls, or broken overlay layering was found. Long-page element captures can include the fixed header midway through an oversized screenshot; this is a capture artifact, not an extra header in the document. Final retained evidence uses viewport captures.

## Observed defects and focused regressions

All fixes are in the Task 10 commit `test: verify complete showcase store`.

| Observed failure | Small fix | Verified RED → GREEN |
| --- | --- | --- |
| Dark supplied logo nearly disappeared in black header and was dark over hero; target uses white | White rendering filter for header/hero/decorative watermark logos | Original computed filter `none` failed at 360; restored fix passes all widths |
| Programmatic destination-h1 focus drew a large coral rectangle around the hero/page title | Suppress outline only for noninteractive `main h1[tabindex='-1']`; retain focus semantics and interactive rings | Original `solid` outline failed at 360; final `none` passes while keyboard link outline remains `solid` |
| Desktop Escape wrapped its final E onto a separate line | Fit font scale to its content container and keep heading on one line | Original styling passed 360–1024 then failed at 1440 with 2 text lines; final has 1 line and fits at all five widths |

The browser runner was verified against temporarily restored original styles: each original defect exited 1. Restoring the fixes produced exit 0 at all widths. No catalog, persistence, checkout, dependency, or route behavior was changed.

## Accessibility, capability, failure, and privacy checks

- Keyboard: skip link was reachable and Enter moved focus to main; desktop anchor navigation, mobile menu, filter drawer, size radios, quantity controls, cart dialog, and checkout first-error focus worked. Menu/drawer focus trapping, Escape, Apply/Close, body-scroll restoration, and route-heading focus were checked. Visible interactive focus remains coral after the heading-only fix. Automated tests additionally cover error associations, announcement count, route focus, and error boundary containment.
- Normal fine pointer produced bounded hero parallax, custom cursor/ring/trails, expiring trails, marquee movement, and lookbook hover zoom. Motifs were visually inspected in rotated/floating states. Reduced motion removed cursor, stopped marquee and motif animations, and removed parallax transforms. The emulated mobile context reported coarse pointer; cursor was absent, touch did not add parallax, and menu remained usable.
- Aborted one meaningful product-image request: labelled neutral fallback retained the product title and controls. Removing interception and reloading restored the decoded image. Malformed JSON for cart, wishlist, and order keys did not break startup; empty states/order recovery remained usable. Matching order route with invalid/missing order data recovered safely. Storage-blocked writes and application render failures have automated coverage; those two conditions were not forced in the real browser.
- Newsletter invalid email produced an associated error; valid fictional email cleared and displayed `Demo signup complete — no email was sent.` No address entered storage.
- During development checkout/newsletter submission, the request listener observed **zero fetch/XHR requests**. A separate built-preview actual checkout and newsletter submission directly instrumented fetch/XHR requests and Playwright's `websocket` event: **zero fetch, XHR, or new WebSocket connections** were caused by either form. Vite's development HMR connection is tooling. Built-preview resource capture contained only local document/JS/CSS/image requests. No external origin was contacted by that smoke flow.
- After the order, localStorage had only versioned cart, wishlist, and order envelopes, and sessionStorage was empty. Checked every unique fictional contact/address/payment value and the accepted demo card: none appeared in storage. Exact order top-level allowlist: `orderId, createdAt, lines, subtotal, shipping, total, deliveryLabel`. Exact line allowlist: `productId, size, color, quantity, unitPrice`. No personal fields were present. The existing privacy tests also reject extra stored fields and cover malformed/expired card data.
- Exploratory checks included repeated additions at the ten-per-variant cap, accurate limit feedback, wishlist full cycles, cart Cancel/Escape/confirm, and browser Back/Forward while the mobile menu/filter drawer was open. No stale dialog or locked body remained. A separate 30.544-second exploratory input pass varied searches, toggled color, selected another product/size, changed quantity, added, scrolled through the complete home and back, and hovered a lookbook card; no page errors occurred.

## Retained screenshot evidence

Thirteen JPEG viewport captures total about 1.55 MB. PNG captures were visually reviewed before size-reducing JPEG compression; final JPEGs were also spot-checked. All paths below are relative to this report.

| Evidence | State |
| --- | --- |
| [desktop-home](screenshots/desktop-home.jpg) | Settled 1440×900 split hero/header |
| [mobile-home](screenshots/mobile-home.jpg), [mobile-menu](screenshots/mobile-menu.jpg) | 390×844 home and expanded touch menu |
| [desktop-lookbook](screenshots/desktop-lookbook.jpg) | Asymmetric card rows and content/actions |
| [desktop-escape](screenshots/desktop-escape.jpg) | Fixed one-line title and manifesto |
| [desktop-motifs](screenshots/desktop-motifs.jpg) | Source-preserved art/label pairing |
| [desktop-about](screenshots/desktop-about.jpg), [desktop-footer](screenshots/desktop-footer.jpg) | History/timeline and footer/newsletter |
| [commerce-cart](screenshots/commerce-cart.jpg) | Selected M/Black line at quantity 3 |
| [checkout-validation](screenshots/checkout-validation.jpg) | Wrong demo-card rejection; fictional QA details only |
| [confirmation](screenshots/confirmation.jpg) | Restored order, quantity 3, empty header cart |
| [mobile-filters](screenshots/mobile-filters.jpg) | Drawer with Black selected |
| [image-fallback](screenshots/image-fallback.jpg) | Branded missing-media recovery |

## Final acceptance checklist

| Item | Status | Evidence |
| --- | --- | --- |
| 13 source products, local images, original names/descriptions | PASS | Catalog integrity tests; all 13 detail routes; ordered home cards; decoded media |
| Every source section and motion family | PASS with fidelity limit | Composition tests, section screenshots, pointer/hover/loop/reduced-motion checks; approximate fonts/crops/timing as documented |
| Mobile navigation without overflow | PASS | Touch/menu screenshot, all five header bounds and route overflow checks |
| Shop URL state, filters/sorting, products, wishlist/cart | PASS | Real-input route/control flow and automated catalog/page tests |
| Cart/wishlist reload and corrupt-data recovery | PASS | Reloaded count/pressed state, corrupt envelopes and empty states; storage tests |
| Only documented demo card accepted | PASS | Wrong-card rejection then 4242 success; validation tests |
| Contact/address/payment never transmitted or persisted | PASS for implemented local flow | Browser storage allowlists/negative-value checks, request capture, privacy tests; no backend present |
| Newsletter local-only, no email sent wording | PASS | Invalid/success input cycle, storage/request checks, exact visible message |
| Reduced-motion/coarse/keyboard/empty/missing/not-found | PASS | Browser capability, focus, recovery and exploratory checks; automated error boundary/storage-blocking coverage |
| Assets/tests/build | PASS | Clean and post-fix commands above; no skipped tests; generated dist |
| Recorded desktop/mobile browser verification | PASS | Viewport matrix, controls/states/claims and retained screenshots in this report |

Remaining limits: Chromium only; emulated touch and reduced motion, no physical mobile device, native-window DPI, Firefox/Safari, actual screen-reader speech, or deployed-host deep-link configuration. Source screenshots do not support pixel-identical signoff. Local preview acceptance does not prove production hosting or any external service. The store remains a clearly disclosed simulation.

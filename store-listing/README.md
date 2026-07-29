# Play Store submission kit

Everything Play Console asks for, generated 29 Jul 2026. All assets meet Google's current specs.

## Contents

| File | What it's for |
|---|---|
| listing-copy.md | App name, short + full description, category, contact fields (paste into Main store listing) |
| content-rating-questionnaire.md | Answers for the IARC content rating questionnaire |
| data-safety-form.md | Answers for the Data safety form + Health apps declaration notes |
| icon-512.png | 512×512 app icon (downscaled from assets/icon.png) |
| feature-graphic-warm-minimal.png | 1024×500 feature graphic, option A (typographic) |
| feature-graphic-screenshot.png | 1024×500 feature graphic, option B (phone screenshot) — pick one |
| feature-graphic-*.html | Editable sources; re-render with headless Chrome at 1024×500 |
| screenshots/*.png | The 5 device screenshots padded from 1080×2392 to 1196×2392 — the originals exceed Google's 2:1 aspect-ratio limit and would be rejected |

Related files outside this folder:
- ../delete-account.html — account-deletion page (new). **Must be pushed to GitHub Pages before submitting**; its URL goes in Data safety → data deletion: `https://sriharsha557.github.io/kinly/delete-account.html`
- ../privacy.html — updated with a Step data (Health Connect) row and Sentry as a service provider, both required for the Health apps declaration and Data safety review.

## Re-rendering a feature graphic after edits

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --hide-scrollbars --window-size=1024,500 --screenshot="feature-graphic-warm-minimal.png" "file:///d:/MOOD/CODE/kinly/store-listing/feature-graphic-warm-minimal.html"
```

## Submission order (avoids the common rejection loops)

1. Push delete-account.html + updated privacy.html to GitHub Pages; verify both URLs load logged-out.
2. Play Console → App content: privacy policy URL, content rating questionnaire, Data safety form, **Health apps declaration** (triggered by the Health & fitness data type; approval can take days–weeks, start early).
3. Main store listing: copy, icon-512.png, one feature graphic, the 5 screenshots.
4. Start a **closed testing** track first — personal dev accounts created after Nov 2023 need 12 testers for 14 days before production access.
5. `eas build --platform android --profile production` → upload the AAB to the closed track.

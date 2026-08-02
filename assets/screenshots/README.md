Drop real app screenshots here with these exact filenames. The landing
page's hero phone cycles through all five, so no code changes are needed:

- `today.png`
- `circle.png`
- `goals.png`
- `connection.png` (the tab is labelled "Together" in the app; the filename
  follows the internal route name, which is still `Connection`)
- `profile.png`

A raw phone screenshot works fine (displayed at 9:19.5 aspect ratio, cropped to fit).

When you replace a shot, bump the `?v=` on its `<img src>` in `index.html`.
GitHub Pages serves `/assets` with a long `max-age`, so a same-named
replacement keeps showing the old image to anyone who has visited before.

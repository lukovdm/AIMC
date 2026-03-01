# Icon Placeholders

Place the following files here for a complete PWA experience:

- `icon-192.png` — 192×192 px app icon
- `icon-512.png` — 512×512 px app icon

You can generate them from `icon.svg` using any SVG-to-PNG tool, e.g.:
inkscape --export-png=icon-192.png --export-width=192 icon.svg
inkscape --export-png=icon-512.png --export-width=512 icon.svg

The app will still install without them, but some browsers may show a warning.

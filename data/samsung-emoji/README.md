# Samsung emoji assets

This directory is intentionally empty of Samsung artwork.

The Brat renderer checks this directory before using its bundled fallback emoji set. If you have Samsung emoji image assets that you are licensed or otherwise authorized to use, place them here.

Supported file types: `.png`, `.webp`, `.jpg`, `.jpeg`.

Use Unicode codepoint filenames separated by hyphens, for example:

- `1f602.png`
- `2764-fe0f.png`
- `1f44d-1f3fd.png`

Uppercase codepoint filenames are also accepted. Optional subfolders `png/`, `webp/`, `72x72/`, and `128x128/` are checked automatically.

You can override the directory at runtime with the `SAMSUNG_EMOJI_DIR` environment variable.

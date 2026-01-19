# MSK Package Format

The `.msk` file is a ZIP container used to bundle structured JSON data and binary assets.

## Layout

- `manifest.json`
- `content.json`
- `source.json`
- `assets/`
  - `images/`

## manifest.json

```json
{
  "schemaVersion": 1,
  "packageType": "msk",
  "createdBy": "math-pdf-builder",
  "createdAt": "2026-01-09T00:00:00.000Z",
  "entry": {
    "content": "content.json",
    "source": "source.json"
  },
  "assetRoot": "assets",
  "contentSchemaVersion": 1,
  "sourceSchemaVersion": 1
}
```

## content.json

This file stores the current editor state. It is the same structure used by the JSON save flow:

```json
{
  "data": {
    "meta": { "title": "", "subtitle": "", "footerText": "" },
    "blocks": [ { "id": "...", "type": "concept|example|answer|break|spacer", "content": "<html>" } ],
    "toc": { },
    "pagePlan": [ ],
    "chapterCovers": [ ],
    "headerFooter": { "header": { }, "footer": { } }
  },
  "settings": { }
}
```

## source.json

This file stores the structured input data derived from the prompt format.

```json
{
  "schemaVersion": 1,
  "meta": {
    "header": { "course": "", "unit": "" },
    "footer": ""
  },
  "blocks": [
    {
      "id": "src_...",
      "style": "기본|박스|음영",
      "label": "예제 1",
      "variant": "좌컨셉|상단컨셉|2행컨셉|null",
      "kind": "concept|example|answer|break|spacer|unknown",
      "raw": "[[기본_예제 1]] : ...",
      "bodyRaw": "..."
    }
  ]
}
```

## assets/

Binary files referenced by `content.json` use relative paths such as:

```
assets/images/filename.png
```

---

# MSK v2 (Univer-focused)

MSK v2 keeps the existing files for backward compatibility and adds Univer-native
document data as the primary source of truth.

## v2 Layout

```
manifest.json
univer.json
content.json
source.json
assets/
  images/
  previews/
  images/index.json
```

## v2 manifest.json (example)

```json
{
  "schemaVersion": 2,
  "packageType": "msk",
  "createdBy": "math-pdf-builder",
  "createdAt": "2026-01-19T00:00:00.000Z",
  "entry": {
    "univer": "univer.json",
    "content": "content.json",
    "source": "source.json"
  },
  "assetRoot": "assets",
  "imageRoot": "assets/images",
  "previewRoot": "assets/previews",
  "imageIndex": "assets/images/index.json",
  "contentSchemaVersion": 1,
  "sourceSchemaVersion": 1
}
```

## univer.json

Stores the Univer document snapshot. This is the primary data source in v2.
`content.json` and `source.json` are preserved for compatibility and migration.

## Backward compatibility

- If `manifest.json` is missing or `schemaVersion` is less than 2:
  - Load legacy `content.json` or a standalone `.json` save.
  - Convert into Univer document data on load.
- If `schemaVersion` is 2 or higher:
  - Load `univer.json` first.
  - `content.json` and `source.json` are optional and may be regenerated.

## Image storage (BinData-style)

Images are never embedded as base64 inside document data. Store all binaries under
`assets/images/` and reference them by ID from `univer.json`.

To avoid duplication, images are deduplicated by hash (SHA-256 or similar).
If the same image is inserted multiple times, only one binary is stored and the
document references the same `imageId`.

### assets/images/index.json (example)

```json
{
  "schemaVersion": 1,
  "images": {
    "img_001": {
      "hash": "sha256:...",
      "path": "assets/images/img_001.png",
      "mime": "image/png",
      "width": 1024,
      "height": 768,
      "hasAlpha": true,
      "previewPath": "assets/previews/img_001.jpg"
    }
  }
}
```

## Image optimization rules

1) Format normalization (on save)
- If the source format is not JPEG/PNG (e.g. BMP/TIFF/RAW), convert:
  - No alpha channel -> JPEG
  - Alpha channel -> PNG
- If the source is already JPEG/PNG, keep the original format.

2) Resampling by displayed size (page-relative)
- Downsample based on the *displayed size on the page*.
- Define a maximum DPI profile (default 300 for print, optional 150 for screen).
- If the source image exceeds the max pixel size derived from DPI, resize it
  while preserving aspect ratio.
- Never upscale beyond the original resolution.
- If one image is used multiple times, use the *largest displayed size* to
  compute a single optimized asset.

3) Crop data removal (optional)
- If the user crops the visible area, you may discard pixels outside the crop
  to save space.
- Default is OFF because users may want to restore the full image later.

4) Preview thumbnails
- Store a low-resolution preview under `assets/previews/`.
- Default size: long edge 1024px (optional 768px for lighter previews).
- Use it as a fast placeholder while the full image loads.

5) Default quality settings
- JPEG quality: 0.9 (optional 0.8 for lighter mode).

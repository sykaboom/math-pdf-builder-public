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

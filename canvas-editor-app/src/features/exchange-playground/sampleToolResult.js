export const SAMPLE_TOOL_RESULT = {
  payload: {
    docxDraft: {
      kind: 'docx-draft',
      version: 1,
      metadata: {
        title: 'Sample Worksheet',
        language: 'ko-KR',
        createdAt: '2026-02-07T00:00:00.000Z',
        updatedAt: '2026-02-07T00:00:00.000Z',
      },
      sections: [
        {
          id: 'section-1',
          page: {
            size: 'A4',
            orientation: 'portrait',
            marginsPt: {
              top: 72,
              right: 72,
              bottom: 72,
              left: 72,
            },
          },
          columns: {
            count: 1,
            gapPt: 18,
          },
          blocks: [
            {
              id: 'p-1',
              kind: 'paragraph',
              runs: [{ text: '수학 문항 예시입니다.' }],
            },
            {
              id: 'eq-1',
              kind: 'equation',
              latex: 'x^2+2x+1=0',
              display: true,
            },
            {
              id: 'img-1',
              kind: 'image',
              assetId: 'asset-image-1',
              widthPt: 240,
              heightPt: 160,
              altText: 'sample image',
            },
            {
              id: 'tbl-1',
              kind: 'table',
              rows: [
                [{ text: '번호' }, { text: '정답' }],
                [{ text: '1' }, { text: '2' }],
              ],
            },
          ],
        },
      ],
      assets: {
        images: [
          {
            assetId: 'asset-image-1',
            mime: 'image/png',
            width: 1200,
            height: 800,
            source: 'assets/images/sample.png',
          },
        ],
      },
      extensions: {
        edu: {
          problemSetId: 'set-001',
        },
      },
    },
  },
}


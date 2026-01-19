# Univer 마이그레이션 기능 매핑

이 문서는 레거시 기능을 Univer(문서 편집)로 옮기기 위한 1차 매핑 표입니다.

## 범례
- [BUILTIN] Univer 기본 기능으로 대응 가능
- [PARTIAL] 일부는 가능하나 추가 구현/검증 필요
- [CUSTOM] 커스텀 구현 필요
- [UNKNOWN] PoC로 확인 필요

## 매핑 표

| 기능 | 레거시 근거 | Univer 대응 | 이관 메모 | PoC 우선순위 |
| --- | --- | --- | --- | --- |
| 기본 텍스트 입력/선택/편집 | README 블록 편집 | [BUILTIN] | 기본 편집 UX는 Univer 제공 | 낮음 |
| 폰트/굵기/정렬/리스트 | README 렌더링/수식 | [BUILTIN] | 기본 서식 도구 존재 | 낮음 |
| A4 페이지네이션/여백 | 새 요구사항 | [BUILTIN] | 페이지 크기/여백 설정으로 대응 | 낮음 |
| 페이지 나눔/섹션 | README 페이지 구성 | [PARTIAL] | 페이지/섹션 분리 방식 확인 필요 | 중간 |
| 1/2단 구성, 단 나누기 | README 단 나누기 | [CUSTOM] | Univer 문서 기본은 단 구성 없음 | 높음 |
| 블록 타입(개념/예제/정답/여백/단나누기) | README 블록 편집 | [CUSTOM] | 커스텀 블록/메타데이터 설계 필요 | 높음 |
| 렌더링 모드(토큰 편집 vs 렌더) | README 렌더링 | [CUSTOM] | 토큰 기반 모드는 별도 구현 | 높음 |
| 수식 입력($...$) + MathJax | README 렌더링/수식 | [UNKNOWN] | Univer 수식 입력 방식 확인 필요 | 높음 |
| 개념빈칸/빈칸 토큰 | docs/concept-blank.md | [CUSTOM] | 인라인 커스텀 블록 설계 필요 | 높음 |
| 개념빈칸 정답 모음/동기화 | docs/concept-blank.md | [CUSTOM] | 문서 내 요약 블록 자동 갱신 | 높음 |
| 표 삽입/편집/행열 조절 | README 표 | [BUILTIN] | 편집 UX와 기능 범위 확인 | 중간 |
| 선지(Choice) 레이아웃 | README 선지 | [CUSTOM] | 표/리스트 기반 커스텀 필요 | 중간 |
| 이미지 삽입/붙여넣기/드래그 | README 이미지 | [PARTIAL] | 붙여넣기/드래그 리사이즈 확인 | 중간 |
| 머릿말/꼬릿말 기본 | README 머릿말/꼬릿말 | [PARTIAL] | 기본 헤더/푸터는 있음 | 중간 |
| 시험지/기본/프리박스/표/이미지 템플릿 | README 머릿말/꼬릿말 | [CUSTOM] | 템플릿 시스템 재구현 필요 | 높음 |
| 페이지 유형(본문/목차/대단원/빈페이지) | README 페이지 구성 | [CUSTOM] | 문서 구조 메타데이터 필요 | 높음 |
| 목차 자동 번호/L1~L3 | README 페이지 구성 | [CUSTOM] | TOC 생성 로직 필요 | 중간 |
| 대단원 표지 템플릿 | README 페이지 구성 | [CUSTOM] | 커버 템플릿 재구현 필요 | 중간 |
| 테마 색상/헤더 이미지 | README 페이지 구성 | [CUSTOM] | 문서 스타일/리소스 매핑 필요 | 중간 |
| AI 데이터 입력 파서 | README AI 데이터 입력 | [CUSTOM] | import-parser 재작성 필요 | 높음 |
| 저장/열기(.msk/.json) | docs/msk-package.md | [CUSTOM] | MSK 패키징 로직 유지 필요 | 높음 |
| 프롬프트 다운로드 | README 프롬프트 | [CUSTOM] | UI/파일 제공 로직 재구현 | 낮음 |
| 프린트 품질 체크(프리플라이트) | README 출력 | [CUSTOM] | 렌더 상태/이미지 누락 검사 필요 | 중간 |
| 인쇄 다이얼로그 호출 | README 출력 | [PARTIAL] | Univer 출력 방식 확인 필요 | 중간 |
| 히스토리/Undo-Redo | 전반 | [BUILTIN] | Univer 기본 제공 | 낮음 |
| 단축키(Alt+Enter 등) | README 블록 편집 | [CUSTOM] | 커맨드/단축키 재설정 필요 | 중간 |
| 폴더 연결(File System Access) | README 저장 | [CUSTOM] | 브라우저 API 별도 연동 필요 | 중간 |

## 비고
- [UNKNOWN] 항목은 빠른 PoC로 “가능/불가/대체 방식”을 먼저 판별해야 합니다.
- [CUSTOM] 항목은 기존 데이터 스키마(content.json/source.json) 유지 여부와 함께 설계를 진행해야 합니다.

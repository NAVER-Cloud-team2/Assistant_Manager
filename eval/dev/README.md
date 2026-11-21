# 개발용 평가 케이스 (B)

- 여기에 개발용 20~30건을 둔다. 모양은 `tests/fixtures/garam-4.json`과 같다.
  - 명확·정정·모호·범위 밖 구분은 정답(`resolution`의 질문·차단, `events`)에서 자동으로 읽는다
- 실행: `npm run eval` (기준 예시 + 이 폴더), `npm run eval -- --repeat 3` (재현성), `npm run eval -- hidden` (미공개, 지표만 출력)
- **미공개 100건은 여기 두지 않는다.** C·D가 만들어 `eval/hidden/`(저장소 제외)이나 팀 드라이브에 보관하고, B에게는 지표 결과만 공유한다.

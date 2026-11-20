# FIN:O

개인 자산·고정지출·대출을 기록하는 로컬 금융 대시보드입니다. Next.js, React, TypeScript로 구현했습니다.

## 문서

- [프로젝트 구성과 데이터 흐름](docs/architecture.md)
- [화면별 사용법과 문제 해결](docs/usage.md)
- [Google 초기 가져오기용 탭/열 구성](docs/sheets-layout.md)
- [분류·정렬·그룹 소계 기준](docs/classification.md)
- [검증 결과와 남은 범위](docs/local-review.md)

## 기능

- 자산 카드/그리드 관리, 현금 세부 유형·소계·필터, 일괄 수정과 천 단위 금액 입력
- 날짜별 최종 잔액과 별도의 수정 전후 금액/시각 기록
- 날짜별 자산 기록, 과거 상세 이력 미리보기/가져오기, 항목별 추이와 확인/이월/가져온 값 구분
- 고정지출 현금흐름 구분 및 용도별 그룹·필터·월 환산 합계
- 고정지출·대출 항목별 수정 전후 이력과 금액/금리/월 환산 지표 차트
- 대출 관리와 금리 시뮬레이션
- 삭제·휴지통 복원·영구삭제, JSON 백업/복원
- Google OAuth와 앱 전용 Google Sheets 저장소
- 모바일 화면 및 밝은/어두운 테마

## 설치 및 실행

Node.js 20.9 이상이 필요합니다. 아래 명령은 프로젝트 루트에서 실행합니다.

```sh
npm ci
npm run dev
```

앱은 <http://127.0.0.1:3000>에서 열립니다. 개인 데이터가 포함되지 않으므로 새 설치는 `/connect`를 열어 Google 연결 설정을 시작합니다.

실제 연결 없이 가상 데이터로 UI를 살펴보려면 테스트 모드를 사용할 수 있습니다. 테스트 데이터는 `.data/e2e.json`에 저장하며 테스트 OAuth 설정도 분리됩니다.

```sh
FINANCE_E2E=1 npm run dev
```

프로덕션 빌드:

```sh
npm run build
npm start
```

macOS에서는 `scripts/start-fino.command`를 실행할 수 있습니다. `scripts/fino-launcher.applescript`를 Script Editor에서 애플리케이션으로 저장하면 실행 아이콘으로 사용할 수 있습니다. 해당 앱은 실행할 소스 폴더를 선택받습니다. 서버 종료는 터미널에서 Control+C를 누릅니다.

## 환경 설정

| 변수 | 용도 |
| --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 선택적 서버 OAuth 설정. 기본은 연결 화면에서 입력 |
| `GOOGLE_REFRESH_TOKEN` | 이미 발급받은 오프라인 토큰을 서버에서 설정할 때만 사용 |
| `GOOGLE_SPREADSHEET_ID` | 본인의 저장용 문서 ID |
| `GOOGLE_REDIRECT_URI` | Google Cloud와 앱에서 일치시킬 콜백 URI |
| `GOOGLE_PROTECTED_SPREADSHEET_ID` | 쓰기 대상으로 거부할 원본 문서 ID |
| `FINANCE_E2E` | 합성 자료·독립 설정을 사용하는 테스트 모드 |

실제 값을 `.env.example`에 적어 커밋하지 마세요. 필요한 경우 이 파일을 `.env.local`로 복사해 본인 기기에서만 편집합니다.

## Google 연결

1. Google Cloud에서 Google Sheets API를 활성화합니다.
2. 웹 애플리케이션 OAuth 클라이언트를 만들고 콜백에 `http://127.0.0.1:3000/api/google/callback`을 등록합니다.
3. 테스트 상태인 앱은 로그인할 계정을 테스트 사용자로 등록합니다.
4. `/connect`에서 본인의 클라이언트 ID·시크릿·저장할 스프레드시트 ID를 입력합니다.
5. Google 로그인과 권한 승인을 마친 뒤 저장 범위를 확인하고 실제 저장소 연결을 활성화합니다.

현재 초기 가져오기는 `02_자산현황`, `03_대출관리`, `01_월고정지출`, `05_이력분석`, `06_설정·가이드` 관리 탭을 대상으로 합니다. 열 매핑은 `lib/migration.ts`와 합성 자료를 사용하는 `tests/migration.test.ts`를 참고하세요. 임의 형식의 빈 스프레드시트에서 자동으로 데이터를 수집하는 기능은 아닙니다.

이후 변경은 `08_앱데이터!A1:D5000`과 해당 앱 탭의 쓰기 소유자 메타데이터에 저장합니다. 기존 관리 탭의 셀을 갱신하지 않습니다. 보호할 원본 문서가 있으면 `GOOGLE_PROTECTED_SPREADSHEET_ID`를 설정하세요. 본인의 시트 복사본을 사용하세요. 금융기관 계좌의 실시간 잔액을 조회하는 앱은 아닙니다.

선택적 서버 환경변수는 `.env.example`을 참고하세요. OAuth 설정·토큰은 서버의 `.data`에 저장하고 조회 API나 금융 데이터 내보내기에 포함하지 않습니다.

## 개인정보와 운영 범위

이 저장소에는 앱 코드와 합성 테스트/데모만 포함합니다. 개인 자산·지출·계좌 데이터, 실제 스프레드시트 ID, OAuth 자격 증명, 백업, 화면 캡처, 로컬 개발 기록은 포함하지 않습니다. 실행 후 생성되는 `.data/`와 `.env*`는 Git에서 제외됩니다(`.env.example` 제외).

단일 사용자·로컬 서버용입니다. 인터넷에 공개할 다중 사용자 인증은 포함하지 않습니다. Google 쓰기는 한 설치에 소유권을 등록하고, revision 확인·서버 직렬화·프로세스 잠금·백업·읽기 검증으로 충돌을 감지합니다. 다른 기기로 `.data/installation-id`를 복제하거나 앱 전용 저장 범위를 직접 편집하지 마세요.

비정상 종료로 `.data/google-writer-*.lock`이 남으면 해당 프로젝트의 모든 서버 프로세스를 종료한 후 남은 잠금 파일을 제거하세요. 실행 중 잠금 파일을 삭제하지 마세요.

## 검증

```sh
npm test
npm run typecheck
npx playwright install chromium
npm run e2e
npm run build
```

E2E는 3100 포트와 별도 테스트 파일을 사용합니다. 테스트 서버나 개발 서버는 공용 인터넷으로 노출하지 마세요.

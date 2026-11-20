# 프로젝트 구성

## 기술 구성

Next.js App Router와 React로 화면·서버 API를 구현합니다. TypeScript와 Zod로 도메인 값을 검증하고 React Hook Form으로 폼을 관리합니다. Tailwind CSS와 전역 CSS를 함께 사용하며 Recharts로 추이를 표시합니다. Google API SDK는 서버에서 OAuth와 Sheets 요청을 처리합니다.

```text
app/                     화면 진입점, 전역 스타일
  connect/               Google 설정 화면
  api/state/             조회·수정·삭제·복원 요청
  api/google/            OAuth 설정·로그인·콜백·연결/해제
  api/history/import/    날짜 탭 상세 이력 미리보기/병합
  api/imported/          선택적 로컬 이관 파일 읽기
components/              화면, 카드, 그리드, 폼과 차트
  ui/                    공통 버튼·모달·금액 입력
lib/
  domain.ts              상태 스키마, 계산, 합성 데모
  mutations.ts           엔터티 수정·삭제·복원
  repository.ts          저장소 선택 및 호환 JSON 저장소
  sqlite-repository.ts   기본 SQLite 트랜잭션·이관·조회 인덱스
  excel-export.ts        상태 기반 엑셀·Google 보고서
  sheets.ts              Google 저장소 및 초기 가져오기
  sheets-document.ts     앱 탭 문서 인코딩·검증
  google-connection.ts   서버 OAuth 설정과 클라이언트
  google-writer.ts       설치 소유권과 파일 잠금
  migration.ts           기존 관리 탭의 열 매핑
  expense-purpose.ts     이름 기반 지출 용도 분류
  backups.ts             수정 전 로컬 백업
scripts/                 macOS 실행 도우미
tests/                  단위·정합성 테스트
  e2e/                   Playwright 브라우저 검사
```

## 저장소와 변경 흐름

화면은 `/api/state`로 상태와 revision을 보냅니다. 서버는 Origin/Host, 스키마, revision과 요청 ID를 확인하고 변이를 적용합니다. 기본 저장소는 SQLite입니다. `BEGIN IMMEDIATE` 트랜잭션 안에서 수정 전 JSON 백업, 상태·항목·관측값·이력 인덱스 갱신, 읽기 검증 후 커밋합니다. 전체 상태 JSON을 함께 보관해 선택적 필드와 배열 순서를 보존합니다. WAL·FULL 동기화·잠금 대기와 revision 검사를 사용합니다. Google 인증 여부는 기본 저장소 선택에 영향을 주지 않습니다.

금액은 0 이상의 원 단위 정수입니다. 쉼표는 입력 표시 형식이며 데이터에는 포함되지 않습니다. 자산 스냅샷은 날짜별 자산 값, 확인한 항목 ID와 부채를 보관합니다. 지출의 현금흐름 구분과 표시용 세부 용도는 독립적입니다.

## Google 문서

앱 상태는 `08_앱데이터!A1:D5000`에 JSON 청크로 저장합니다. 헤더에는 서명·revision·요청 ID·체크섬을 기록합니다. 쓰기는 문자열 값으로 전송해 사용자 이름이나 메모가 시트 수식으로 실행되지 않게 합니다. 수동 전송 시 같은 앱 탭 F:R에 조회용 표를 함께 씁니다. 일반 조회·수정은 Google에 요청하지 않습니다. 관리·날짜 탭은 갱신하지 않으며 양방향 동기화는 제공하지 않습니다.

한 설치만 쓰도록 앱 탭의 DeveloperMetadata에 설치 ID를 등록합니다. 서버 내부 요청 순서, 프로세스 파일 잠금, 사전 revision 확인과 저장 후 읽기 검증을 함께 사용합니다. 직접 시트 편집이나 복제된 설치 ID에 대한 분산 트랜잭션은 제공하지 않습니다.

## 개인정보 경계

`.data/`에는 실행 후 생성되는 금융 상태, OAuth 자격 증명·토큰, 설치 ID, 백업과 잠금 파일이 포함될 수 있습니다. 공개 소스에 포함하지 않으며 파일은 서버 전용입니다. JSON 자격 증명 파일은 소유자 접근 권한으로 저장하지만 별도 암호화 저장소는 아닙니다. 기기와 계정 보안이 필요합니다.

시트 ID·개인 경로를 소스에 고정하지 않습니다. 예제 환경변수 값은 비어 있으며 보호할 원본 ID는 서버 환경변수로 지정합니다. 클라이언트 공개 환경변수에 시크릿을 넣지 않습니다. 공개 테스트와 데모는 합성 자료만 사용합니다.

## 실행과 검사

- `npm run dev`: 로컬 개발, 기본 3000 포트
- `npm run build` / `npm start`: 프로덕션 빌드/로컬 실행
- `npm test`: 단위·정합성 검사
- `npm run typecheck`: 타입 검사
- `npm run e2e`: 3100 포트, `.next-e2e/`, 별도 테스트 상태/설정

이 앱은 인증된 공용 웹 서비스가 아니라 단일 사용자의 로컬 앱입니다. 공용 호스팅·다중 사용자 권한 관리·은행 자동 조회·자동 거래는 별도 구현이 필요합니다.

과거 시트의 상세 잔액은 선택적 `assetHistory`에 저장합니다. 추이에서 기존 스냅샷 값을 우선해 합치며, 현재 자산 목록이나 총액 이력을 변경하지 않습니다. 가져오기 전 preview·revision 확인, 동일 요청 중복 방지, 서버 잠금/백업/저장 검증을 적용합니다. 삭제·휴지통·영구삭제와 전체 비우기는 이 이력도 함께 처리합니다.

자산의 선택적 `cashType`은 직접 지정한 현금 세부 유형입니다. 표시용 자동 제안은 원본 필드를 일괄 바꾸지 않습니다. 잔액 저장 시 audit 행에 선택적 assetId·beforeValue·afterValue·effectiveDate를 함께 기록합니다. 날짜별 스냅샷은 최종 잔액을 유지하고, 동일 날짜의 수정 전후 값은 이 구조화된 수정 이력으로 보존합니다. 기존 일반 audit 행에서 과거 금액을 추정하지 않습니다.

고정지출·대출 변경은 서버가 이전 저장 상태와 수정 후 상태를 비교해 audit의 선택적 `itemChange`에 전체 before/after 상태를 저장합니다. 지출/대출 스키마를 각각 검증하고 항목 ID를 일치시킵니다. 일반 갱신 요청의 클라이언트 audit 내용을 이력으로 신뢰하지 않습니다. 변경이 없으면 새 항목 이력을 만들지 않으며 등록·수정·삭제·복원 동작을 구분합니다. 각 지표는 해당 이벤트의 입력 조건으로 계산하고, 이력 조회는 시각 순으로 정렬해 휴지통 이력 복원 후에도 순서를 유지합니다.

## SQLite와 내보내기

Node.js 24의 내장 `node:sqlite`를 사용합니다. 정상 자료는 `.data/finance.sqlite`, 합성 테스트는 `.data/e2e.sqlite`에 분리합니다. DB와 WAL/SHM은 소유자 파일 권한으로 제한합니다. DB 상태와 검색용 항목·관측값·이력 테이블을 하나의 트랜잭션으로 갱신합니다. 원본 JSON 작업본과 이관 캡처 중 최신 revision을 선택하고 같은 버전 충돌은 중단합니다. 새 설치는 빈 로컬 상태로 시작합니다.

`/api/storage`는 로컬 상태·전송 시각만 읽습니다. `/api/export/excel`은 ExcelJS로 상태를 보고서로 만듭니다. `/api/transfer/google`의 preview/push에서만 수동 전송하며 로컬 revision과 원격 문서 해시를 검증합니다. 전송 ID 재시도로 같은 Google 쓰기가 중복되지 않게 처리합니다. Google 전송 이력은 금융 자료 revision과 별도 테이블에 기록합니다.

실행 중 DB 파일 하나만 복사하면 WAL의 최신 수정이 빠질 수 있습니다. 평상시 이동·복원용 백업은 앱의 JSON 내보내기를 사용하세요. 파일 자체를 보관하려면 서버를 종료한 뒤 DB와 WAL/SHM을 함께 보관하세요. SQLite는 별도로 암호화하지 않습니다.

## 급여 자료

급여는 같은 SQLite 파일의 `payroll_meta`, `payroll_records`, `payroll_images`, `payroll_audit`에 별도 revision으로 저장합니다. 자산 상태 JSON과 자동으로 합치지 않습니다. 사진은 MIME 서명·크기·SHA-256을 확인한 BLOB이며 앱 API로만 읽고 공개 정적 폴더에는 저장하지 않습니다. 급여 전용 백업에는 전체 기록·이력·사진이 포함됩니다. 원본 사진은 수정 전후 이력에서 참조하는 동안 보존합니다. 삭제/복원/영구삭제 및 파괴적 복원 전 백업을 지원합니다.

`lib/payroll-ocr.ts`는 macOS의 로컬 Swift/Vision 스크립트를 실행하고 제안 필드만 반환합니다. 원본 OCR 텍스트는 임시 디렉터리 안에 두고 종료 시 제거합니다. 앱 자체는 OCR을 위해 외부 서비스나 별도 API 키를 사용하지 않습니다. 급여 표시값은 원본 확인 전까지 draft로 유지하며 자산/지출 계산·DSR 소득에 자동 반영하지 않습니다.

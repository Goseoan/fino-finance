# 프로젝트 구성

## 기술 구성

Next.js App Router와 React로 화면·서버 API를 구현합니다. TypeScript와 Zod로 도메인 값을 검증하고 React Hook Form으로 폼을 관리합니다. Tailwind CSS와 전역 CSS를 함께 사용하며 Recharts로 추이를 표시합니다. Google API SDK는 서버에서 OAuth와 Sheets 요청을 처리합니다.

```text
app/                     화면 진입점, 전역 스타일
  connect/               Google 설정 화면
  api/state/             조회·수정·삭제·복원 요청
  api/google/            OAuth 설정·로그인·콜백·연결/해제
  api/imported/          선택적 로컬 이관 파일 읽기
components/              화면, 카드, 그리드, 폼과 차트
  ui/                    공통 버튼·모달·금액 입력
lib/
  domain.ts              상태 스키마, 계산, 합성 데모
  mutations.ts           엔터티 수정·삭제·복원
  repository.ts          로컬 JSON 저장소
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

화면은 `/api/state`로 상태와 revision을 보냅니다. 서버는 Origin/Host, 스키마, revision과 요청 ID를 확인하고 변이를 적용합니다. 로컬 저장은 임시 파일을 쓴 뒤 이름을 바꾸고 읽어 검증합니다. Google 연결이 활성화되면 Google 저장소가 우선하며 실패를 숨기고 데모로 전환하지 않습니다.

금액은 0 이상의 원 단위 정수입니다. 쉼표는 입력 표시 형식이며 데이터에는 포함되지 않습니다. 자산 스냅샷은 날짜별 자산 값, 확인한 항목 ID와 부채를 보관합니다. 지출의 현금흐름 구분과 표시용 세부 용도는 독립적입니다.

## Google 문서

앱 상태는 `08_앱데이터!A1:D5000`에 JSON 청크로 저장합니다. 헤더에는 서명·revision·요청 ID·체크섬을 기록합니다. 쓰기는 문자열 값으로 전송해 사용자 이름이나 메모가 시트 수식으로 실행되지 않게 합니다. 최초 연결 시 기존 관리 탭을 읽을 수 있지만 이후 그 관리 셀들을 양방향 갱신하지 않습니다.

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

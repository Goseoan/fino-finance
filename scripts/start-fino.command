#!/bin/zsh
set -eu
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
APP_DIR="${0:A:h:h}"
APP_URL="http://127.0.0.1:3000"
cd "$APP_DIR"

is_fino() {
  /usr/bin/curl --max-time 2 -fsS "$APP_URL" 2>/dev/null | /usr/bin/grep -q 'FIN:O'
}
if is_fino; then
  /usr/bin/open "$APP_URL"
  exit 0
fi
if /usr/sbin/lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  print '3000 포트를 다른 서버가 사용 중입니다. 해당 서버를 확인한 뒤 다시 실행해 주세요.'
  read '?Enter 키를 누르면 닫습니다. '
  exit 1
fi
if ! command -v node >/dev/null || [[ ! -f node_modules/next/dist/bin/next ]]; then
  print 'Node.js 또는 앱 의존성이 없습니다. 프로젝트에서 npm ci를 실행해 주세요.'
  read '?Enter 키를 누르면 닫습니다. '
  exit 1
fi
if ! node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)' ; then
  print 'SQLite 저장에는 Node.js 24 이상이 필요합니다. Node.js를 업데이트해 주세요.'
  read '?Enter 키를 누르면 닫습니다. '
  exit 1
fi
print 'FINO 서버를 시작합니다. 종료하려면 이 창에서 Control+C를 누르세요.'
(
  for attempt in {1..120}; do
    if is_fino; then
      /usr/bin/open "$APP_URL"
      exit 0
    fi
    /bin/sleep 1
  done
  print '브라우저 자동 열기 시간이 초과되었습니다. 터미널 오류를 확인해 주세요.'
) &
WATCHER_PID=$!
trap 'kill "$WATCHER_PID" 2>/dev/null || true' EXIT
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3000

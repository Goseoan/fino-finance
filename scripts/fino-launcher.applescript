on run
  set projectFolder to choose folder with prompt "FINO 소스 폴더를 선택하세요"
  set projectLauncher to (POSIX path of projectFolder) & "scripts/start-fino.command"
  set appURL to "http://127.0.0.1:3000"
  try
    do shell script "/usr/bin/curl --max-time 2 -fsS " & quoted form of appURL & " | /usr/bin/grep -q 'FIN:O'"
    open location appURL
  on error
    tell application "Terminal"
      activate
      do script "/bin/zsh " & quoted form of projectLauncher
    end tell
  end try
end run

@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   HLE 허브 - 업로드 전용 (암호화 생략)
echo   ※ payload.bin과 index.html이 이미 준비된 경우에만 사용
echo ============================================
echo.
echo [1/2] 변경사항 커밋...
git add -A
git commit -m "허브 갱신(업로드 전용) %date% %time:~0,5%"
if errorlevel 1 (
  echo.
  echo [알림] 변경된 내용이 없습니다.
  pause
  exit /b
)
echo [2/2] 업로드...
git push origin main
if errorlevel 1 (
  echo.
  echo [오류] 업로드에 실패했습니다. 인터넷 연결 또는 GitHub 로그인 상태를 확인하세요.
  pause
  exit /b
)
echo.
echo ✅ 업로드 완료! 약 1분 뒤 반영됩니다: https://hleanalysis.github.io/
pause

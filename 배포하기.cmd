@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   HLE 통합 분석 허브 - 암호화 후 배포
echo ============================================
echo.
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\GitHub CLI"

echo [1/3] 원본(src\index.html)을 압축·암호화하는 중...
node encrypt.mjs
if errorlevel 1 (
  echo [오류] 암호화에 실패했습니다.
  pause
  exit /b
)

echo [2/3] 변경사항 커밋...
git add index.html payload.bin img img-map.json .gitignore
git commit -m "허브 갱신 %date% %time:~0,5%"
if errorlevel 1 (
  echo.
  echo [알림] 변경된 내용이 없습니다. src\index.html을 수정한 뒤 다시 실행하세요.
  pause
  exit /b
)

echo [3/3] 업로드...
git push origin main
if errorlevel 1 (
  echo.
  echo [오류] 업로드에 실패했습니다. 인터넷 연결을 확인하세요.
  pause
  exit /b
)
echo.
echo ✅ 배포 완료! 약 1분 뒤 반영됩니다:
echo    https://hleanalysis.github.io/
echo    (비밀번호는 비밀번호.txt 참고)
echo.
pause

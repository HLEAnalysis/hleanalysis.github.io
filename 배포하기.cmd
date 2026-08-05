@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   HLE 통합 분석 허브 - 암호화 후 배포
echo ============================================
echo.
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files\GitHub CLI"
set /p PW=<비밀번호.txt

echo [1/3] 원본(src\index.html)을 암호화하는 중...
cd src
call npx -y staticrypt index.html -d .. -p "%PW%" --remember 30 --short --template "..\login-template.html" --template-title "HLE 통합 분석 허브" --template-instructions "한화생명e스포츠 내부 전용 페이지입니다. 디스코드에 공유된 비밀번호를 입력하세요." --template-placeholder "비밀번호 입력" --template-button "접속하기" --template-remember "이 기기에서 30일간 기억" --template-error "비밀번호가 올바르지 않습니다"
cd ..
if not exist index.html (
  echo [오류] 암호화에 실패했습니다.
  pause
  exit /b
)

echo [2/3] 변경사항 커밋...
git add -A
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

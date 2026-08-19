/* RUNEGUARD — 부트스트랩 + 화면 에러 리포터 */
(function () {
  'use strict';

  /* 어떤 오류든 조용한 검은 화면 대신 화면 상단에 띄운다.
     사용자가 스크린샷 한 장으로 원인을 알려줄 수 있게 하는 진단 장치. */
  function showFatal(msg) {
    try {
      var bar = document.getElementById('rg-fatal');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'rg-fatal';
        bar.style.cssText =
          'position:fixed;top:0;left:0;right:0;z-index:99999;' +
          'background:#7a1f18;color:#fff;font:12px/1.6 monospace;' +
          'padding:8px 40px 8px 12px;white-space:pre-wrap;word-break:break-all;';
        var x = document.createElement('button');
        x.textContent = '✕';
        x.style.cssText =
          'position:absolute;top:4px;right:8px;background:none;border:none;' +
          'color:#fff;font-size:14px;cursor:pointer;';
        x.onclick = function () { bar.remove(); };
        bar.appendChild(x);
        document.body.appendChild(bar);
      }
      var line = document.createElement('div');
      line.textContent = '⚠ ' + msg;
      bar.appendChild(line);
    } catch (e) { /* 리포터 자체는 절대 죽지 않는다 */ }
  }

  window.addEventListener('error', function (ev) {
    var src = (ev.filename || '').split('/').pop();
    showFatal((ev.message || '알 수 없는 오류') + (src ? '  @' + src + ':' + ev.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    showFatal('Promise 오류: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason));
  });

  function boot() {
    if (!window.RG || !window.RG.UI) {
      showFatal('스크립트 로드 실패 — RG.UI 없음. Ctrl+F5 로 새로고침해 보세요.');
      return;
    }
    /* SVG 공용 그라디언트를 문서에 심는다 (아트 재질 표현에 필요) */
    try {
      if (window.RG.Art && window.RG.Art.injectDefs) window.RG.Art.injectDefs(document);
      window.RG.UI.init();
    } catch (e) {
      showFatal('초기화 실패: ' + e.message);
      throw e;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

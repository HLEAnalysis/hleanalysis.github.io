/* RUNEGUARD — 환경 씬 (테마별 배경 아트)
   Duelyst 처럼 보드가 '세계 안에' 앉아 있도록, 전장 뒤에 하늘·능선·소품을
   SVG 로 그린다. 이미지 파일 없음 — 전부 코드.
   viewBox 1600x900, slice 로 화면을 가득 채운다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};

  /* ═════════ 도형 프리미티브 ═════════ */
  function ridge(y, amp, fill, opacity) {
    /* 완만한 능선 — 사인 느낌의 베지어 */
    var d = 'M0 ' + (y + amp) +
      ' C 200 ' + (y - amp) + ', 380 ' + (y + amp * 1.4) + ', 600 ' + y +
      ' S 1000 ' + (y - amp * 1.2) + ', 1200 ' + (y + amp * 0.6) +
      ' S 1500 ' + (y - amp * 0.8) + ', 1600 ' + y +
      ' L 1600 900 L 0 900 Z';
    return '<path d="' + d + '" fill="' + fill + '"' +
      (opacity != null ? ' opacity="' + opacity + '"' : '') + '/>';
  }

  function glow(x, y, r, color, op) {
    return '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + color +
      '" opacity="' + (op == null ? 0.5 : op) + '" filter="url(#scBlur)"/>';
  }

  function tree(x, y, s, trunk, leaf, leaf2) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<rect x="-4" y="-6" width="8" height="26" rx="3" fill="' + trunk + '"/>' +
      '<ellipse cx="0" cy="-26" rx="26" ry="22" fill="' + leaf + '"/>' +
      '<ellipse cx="-14" cy="-14" rx="18" ry="14" fill="' + leaf + '"/>' +
      '<ellipse cx="15" cy="-12" rx="16" ry="13" fill="' + (leaf2 || leaf) + '"/>' +
      '<ellipse cx="-6" cy="-32" rx="12" ry="9" fill="' + (leaf2 || leaf) + '" opacity=".85"/>' +
      '<ellipse cx="0" cy="22" rx="26" ry="6" fill="#000" opacity=".25"/></g>';
  }

  function rock(x, y, s, a, b) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<path d="M-24 12 L-14 -14 L4 -20 L22 -8 L26 12 Z" fill="' + a + '"/>' +
      '<path d="M4 -20 L22 -8 L26 12 L6 12 Z" fill="' + b + '"/>' +
      '<ellipse cx="0" cy="14" rx="28" ry="6" fill="#000" opacity=".25"/></g>';
  }

  function cactus(x, y, s, a, b) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<rect x="-7" y="-42" width="14" height="54" rx="7" fill="' + a + '"/>' +
      '<rect x="-24" y="-30" width="11" height="24" rx="5.5" fill="' + b + '"/>' +
      '<rect x="-24" y="-12" width="18" height="10" rx="5" fill="' + b + '"/>' +
      '<rect x="13" y="-38" width="11" height="20" rx="5.5" fill="' + b + '"/>' +
      '<rect x="6" y="-24" width="18" height="10" rx="5" fill="' + b + '"/>' +
      '<ellipse cx="0" cy="14" rx="24" ry="5" fill="#000" opacity=".25"/></g>';
  }

  function crystal(x, y, s, a, b) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<path d="M0 -52 L14 -12 L8 12 L-8 12 L-14 -12 Z" fill="' + a + '"/>' +
      '<path d="M0 -52 L14 -12 L8 12 L0 12 Z" fill="' + b + '"/>' +
      '<path d="M-22 -18 L-12 2 L-20 12 L-28 4 Z" fill="' + a + '" opacity=".9"/>' +
      '<path d="M22 -22 L30 -2 L22 12 L14 2 Z" fill="' + b + '" opacity=".9"/>' +
      '<ellipse cx="0" cy="14" rx="26" ry="5" fill="#000" opacity=".22"/></g>';
  }

  function volcanoCone(x, y, s, a, lava) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<path d="M-60 30 L-16 -44 L18 -44 L62 30 Z" fill="' + a + '"/>' +
      '<path d="M-16 -44 L18 -44 L10 -30 L-8 -30 Z" fill="' + lava + '"/>' +
      '<path d="M-2 -30 L6 -30 L14 30 L-8 30 Z" fill="' + lava + '" opacity=".5"/>' +
      '<circle cx="0" cy="-48" r="10" fill="' + lava + '" opacity=".55" filter="url(#scBlur)"/></g>';
  }

  function shroom(x, y, s, cap, stem, dot) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')">' +
      '<rect x="-5" y="-8" width="10" height="22" rx="5" fill="' + stem + '"/>' +
      '<path d="M-24 -6 A24 20 0 0 1 24 -6 Z" fill="' + cap + '"/>' +
      '<circle cx="-9" cy="-14" r="3.4" fill="' + dot + '"/>' +
      '<circle cx="7" cy="-18" r="2.6" fill="' + dot + '"/>' +
      '<circle cx="0" cy="-14" r="7" fill="' + cap + '" opacity=".5" filter="url(#scBlur)"/>' +
      '<ellipse cx="0" cy="15" rx="18" ry="4" fill="#000" opacity=".3"/></g>';
  }

  function cloud(x, y, s, color, op) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + s + ')" opacity="' + (op || 0.5) + '">' +
      '<ellipse cx="0" cy="0" rx="46" ry="14" fill="' + color + '"/>' +
      '<ellipse cx="-24" cy="6" rx="26" ry="10" fill="' + color + '"/>' +
      '<ellipse cx="26" cy="5" rx="30" ry="11" fill="' + color + '"/></g>';
  }

  function stars(list, color) {
    return list.map(function (p) {
      return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + color + '" opacity=".8"/>';
    }).join('');
  }

  /* ═════════ 테마별 씬 ═════════ */
  var SCENES = {
    grass: function () {
      return '<rect width="1600" height="380" fill="url(#skyGrass)"/>' +
        glow(1220, 120, 90, '#fff6c8', 0.85) + '<circle cx="1220" cy="120" r="46" fill="#fff2b0"/>' +
        cloud(300, 100, 1.1, '#ffffff', 0.55) + cloud(760, 60, 0.8, '#ffffff', 0.4) +
        cloud(1450, 200, 0.9, '#ffffff', 0.35) +
        ridge(300, 46, '#1e4a30', 0.9) + ridge(340, 34, '#2a6a40') +
        tree(120, 372, 1.4, '#4a3420', '#2e8a4a', '#3aa85e') +
        tree(240, 396, 1.0, '#4a3420', '#2a7a42', '#38a058') +
        tree(1420, 380, 1.5, '#4a3420', '#2e8a4a', '#3aa85e') +
        tree(1530, 420, 1.0, '#4a3420', '#2a7a42', '#38a058') +
        rock(60, 720, 1.6, '#3e5a44', '#54785a') +
        rock(1520, 760, 2.0, '#3e5a44', '#54785a') +
        tree(80, 850, 2.0, '#4a3420', '#2e8a4a', '#3aa85e') +
        tree(1500, 870, 2.2, '#4a3420', '#2a7a42', '#3aa85e');
    },
    desert: function () {
      return '<rect width="1600" height="400" fill="url(#skyDesert)"/>' +
        glow(1180, 130, 110, '#ffd98a', 0.9) + '<circle cx="1180" cy="130" r="58" fill="#ffce6a"/>' +
        cloud(420, 110, 1.0, '#ffe8c0', 0.3) +
        ridge(320, 40, '#8a5c22', 0.9) + ridge(360, 26, '#a8742e') +
        cactus(140, 400, 1.2, '#4a7a3a', '#3e6a30') +
        cactus(1470, 420, 1.5, '#4a7a3a', '#3e6a30') +
        rock(280, 420, 0.9, '#7a5426', '#96682e') +
        rock(70, 760, 1.8, '#7a5426', '#96682e') +
        cactus(90, 860, 2.0, '#4a7a3a', '#3e6a30') +
        rock(1530, 780, 2.2, '#7a5426', '#96682e') +
        cactus(1450, 880, 1.8, '#4a7a3a', '#3e6a30');
    },
    ice: function () {
      return '<rect width="1600" height="400" fill="url(#skyIce)"/>' +
        stars([[200, 80, 2], [420, 140, 1.6], [660, 60, 2.2], [980, 110, 1.5], [1360, 70, 2]], '#e8f6ff') +
        glow(1240, 130, 80, '#e8f6ff', 0.7) + '<circle cx="1240" cy="130" r="40" fill="#dceeff"/>' +
        ridge(300, 50, '#3e6a8e', 0.85) + ridge(345, 30, '#5a88ae') +
        crystal(140, 400, 1.3, '#9fd4f0', '#d6efff') +
        crystal(1460, 410, 1.6, '#9fd4f0', '#d6efff') +
        crystal(300, 430, 0.8, '#8ec4e4', '#c8e8ff') +
        crystal(80, 780, 2.2, '#9fd4f0', '#d6efff') +
        crystal(1520, 800, 2.6, '#9fd4f0', '#d6efff') +
        crystal(1380, 880, 1.4, '#8ec4e4', '#c8e8ff');
    },
    volcano: function () {
      return '<rect width="1600" height="400" fill="url(#skyVolcano)"/>' +
        stars([[300, 90, 1.6], [900, 60, 1.4], [1300, 120, 1.8]], '#ffb08a') +
        volcanoCone(1250, 330, 1.6, '#3a1e16', '#ff7a3a') +
        volcanoCone(280, 350, 1.1, '#341a12', '#ff6a2a') +
        ridge(330, 36, '#2a120e', 0.95) +
        glow(1250, 250, 90, '#ff6a2a', 0.35) +
        rock(90, 750, 1.9, '#3e2018', '#54301e') +
        rock(1520, 780, 2.3, '#3e2018', '#54301e') +
        glow(80, 860, 60, '#ff6a2a', 0.3) + glow(1500, 880, 70, '#ff6a2a', 0.3) +
        stars([[500, 500, 2], [1100, 560, 1.6], [820, 680, 1.8], [300, 620, 1.4]], '#ffa060');
    },
    dusk: function () {
      return '<rect width="1600" height="400" fill="url(#skyDusk)"/>' +
        stars([[180, 70, 2], [500, 120, 1.6], [860, 50, 2.2], [1120, 140, 1.4], [1420, 90, 2]], '#e0ccff') +
        glow(1200, 140, 100, '#e8d8ff', 0.6) + '<circle cx="1200" cy="140" r="52" fill="#d8c4f5"/>' +
        '<circle cx="1216" cy="128" r="44" fill="url(#skyDusk)"/>' +
        ridge(310, 44, '#241440', 0.9) + ridge(350, 30, '#342054') +
        tree(140, 390, 1.3, '#2a1a3e', '#4a2e6a', '#5e3c86') +
        tree(1460, 410, 1.6, '#2a1a3e', '#4a2e6a', '#5e3c86') +
        shroom(90, 800, 2.0, '#b06ae0', '#d8c4f0', '#f0e4ff') +
        shroom(1520, 830, 2.4, '#8a5ae0', '#d8c4f0', '#f0e4ff') +
        shroom(1400, 890, 1.5, '#b06ae0', '#d8c4f0', '#f0e4ff') +
        stars([[400, 550, 1.6], [1200, 600, 1.4], [700, 700, 1.8]], '#c8a8ff');
    }
  };

  var SKY_DEFS =
    '<defs>' +
    '<filter id="scBlur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="14"/></filter>' +
    '<linearGradient id="skyGrass" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#7ec8e8"/><stop offset="70%" stop-color="#b8e0d0"/><stop offset="100%" stop-color="#d8ecc8"/></linearGradient>' +
    '<linearGradient id="skyDesert" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#f0a05a"/><stop offset="60%" stop-color="#f0c078"/><stop offset="100%" stop-color="#e8d09a"/></linearGradient>' +
    '<linearGradient id="skyIce" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#1a3050"/><stop offset="70%" stop-color="#3a6a92"/><stop offset="100%" stop-color="#6a9cc0"/></linearGradient>' +
    '<linearGradient id="skyVolcano" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#1c0c10"/><stop offset="60%" stop-color="#4a1c14"/><stop offset="100%" stop-color="#7a3018"/></linearGradient>' +
    '<linearGradient id="skyDusk" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#180f30"/><stop offset="60%" stop-color="#3a2260"/><stop offset="100%" stop-color="#5e3a80"/></linearGradient>' +
    '</defs>';

  /* 전경 실루엣 — 화면 코너의 어두운 지형 덩어리가 깊이를 만든다 */
  var FG_TINT = {
    grass: '#07160c', desert: '#1c1004', ice: '#081420',
    volcano: '#120504', dusk: '#0a0516'
  };
  function foreground(color) {
    return '<ellipse cx="-60" cy="940" rx="520" ry="260" fill="' + color + '" opacity=".9" filter="url(#scBlur)"/>' +
      '<ellipse cx="1660" cy="950" rx="560" ry="270" fill="' + color + '" opacity=".9" filter="url(#scBlur)"/>' +
      '<ellipse cx="-80" cy="-40" rx="380" ry="180" fill="' + color + '" opacity=".55" filter="url(#scBlur)"/>' +
      '<ellipse cx="1680" cy="-50" rx="400" ry="190" fill="' + color + '" opacity=".55" filter="url(#scBlur)"/>';
  }

  function render(themeId) {
    var host = global.document && global.document.getElementById('sceneLayer');
    if (!host) return;
    if (host.dataset.scene === themeId) return;      /* 같은 테마면 다시 그리지 않는다 */
    host.dataset.scene = themeId;
    var body = (SCENES[themeId] || SCENES.grass)();
    host.innerHTML =
      '<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + SKY_DEFS + body +
      foreground(FG_TINT[themeId] || FG_TINT.grass) + '</svg>';
  }

  RG.Scene = { render: render, SCENES: SCENES };
})(typeof window !== 'undefined' ? window : global);

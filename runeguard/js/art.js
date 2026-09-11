/* RUNEGUARD — 아트 라이브러리 v1.0 "Painted"
   외부 이미지 없이 코드로 그린다. 기존 API 호환 (svg / inner / factionCrest / attachImg / injectDefs / figure).

   v1.0 변경점
   · 페인터리 렌더 파이프라인: 실루엣 그림자 → 잉크 윤곽(굵은 실루엣) → 본체 → 림라이트(진영색)
   · 진영별 천·에너지 그라디언트를 defs 에 두고, 파츠는 토큰(%C% %A% %SK% …)으로 진영을 받는다.
     → CSS 클래스 의존 없음. 스타일시트 없이도 그대로 렌더된다.
   · 청키한 Duelyst 비율: 큰 머리·큰 무기·짧은 다리.
   · 신규 API: crest(진영 엠블럼) · tile(지형 타일) · ark · fx(연출) · icon(UI) · logo · frame(카드 프레임)

   좌표계(유닛): 0 0 100 124 — 발끝 y≈110, 지면 그림자 y≈116 */
(function (global) {
  'use strict';
  var RG = global.RG = global.RG || {};

  /* ═══════════════ 진영 팔레트 ═══════════════ */
  var PAL = {
    vanguard: { c1: '#ffd46a', c2: '#c48a1e', c3: '#5c3d0a', a: '#f5b942', al: '#fff0c2', sk: 'skN', rim: 'rimV', en: 'enV' },
    exile:    { c1: '#8fd0ff', c2: '#3a7fe0', c3: '#183a7a', a: '#58a8ff', al: '#e2f2ff', sk: 'skN', rim: 'rimE', en: 'enE' },
    arcane:   { c1: '#d9a8ff', c2: '#7d47d8', c3: '#2c1a63', a: '#c084ff', al: '#f1e2ff', sk: 'skP', rim: 'rimA', en: 'enA' },
    demon:    { c1: '#ff6a55', c2: '#b8231f', c3: '#4a0a0a', a: '#ff6b5e', al: '#ffc4a8', sk: 'skD', rim: 'rimD', en: 'enD' },
    neutral:  { c1: '#d8c39a', c2: '#8d7147', c3: '#3f3220', a: '#d3b98a', al: '#f6ecd6', sk: 'skN', rim: 'rimN', en: 'enN' }
  };
  var GEN_FACTION = { gen_volkov: 'vanguard', gen_arden: 'exile', gen_selene: 'arcane', gen_karnak: 'demon' };
  function factionOf(id) {
    if (!id) return 'neutral';
    if (GEN_FACTION[id]) return GEN_FACTION[id];
    if (id === 'tk_elemental') return 'arcane';
    var p = id.charAt(0);
    return p === 'v' ? 'vanguard' : p === 'e' ? 'exile' : p === 'a' ? 'arcane' : p === 'd' ? 'demon' : 'neutral';
  }

  /* ═══════════════ 공유 defs (재질 · 진영 그라디언트 · 필터) ═══════════════ */
  function lg(id, dir, stops) {
    var d = { v: 'x1="0" y1="0" x2="0" y2="1"', d: 'x1="0" y1="0" x2="1" y2="1"', h: 'x1="0" y1="0" x2="1" y2="0"' }[dir];
    return '<linearGradient id="' + id + '" ' + d + '>' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"/>'; }).join('') +
      '</linearGradient>';
  }
  function rg(id, stops) {
    return '<radialGradient id="' + id + '" cx="50%" cy="50%" r="50%">' +
      stops.map(function (s) { return '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>'; }).join('') +
      '</radialGradient>';
  }
  function rim(id, col) {
    return '<filter id="' + id + '" x="-15%" y="-15%" width="130%" height="130%">' +
      '<feMorphology in="SourceAlpha" operator="erode" radius="1.5" result="e"/>' +
      '<feOffset in="e" dx="-1.6" dy="1.4" result="eo"/>' +
      '<feComposite in="SourceAlpha" in2="eo" operator="out" result="ring"/>' +
      '<feFlood flood-color="' + col + '" flood-opacity=".85"/><feComposite in2="ring" operator="in"/>' +
      '<feGaussianBlur stdDeviation=".3"/></filter>';
  }
  var DEFS =
    '<svg id="rg-defs" width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden"><defs>' +
      /* 재질 */
      lg('mSteel', 'd', [['0%', '#f4f7ff'], ['35%', '#a9b6d2'], ['68%', '#5e6b8a'], ['100%', '#2d3448']]) +
      lg('mSteelD', 'd', [['0%', '#9aa7c2'], ['55%', '#4a5570'], ['100%', '#1f2536']]) +
      lg('mGold', 'd', [['0%', '#fff6d0'], ['38%', '#f0c14f'], ['72%', '#b47d17'], ['100%', '#6b4708']]) +
      lg('mBronze', 'd', [['0%', '#e7b98a'], ['50%', '#9a6238'], ['100%', '#4a2a14']]) +
      lg('mLeather', 'v', [['0%', '#a5744a'], ['100%', '#3f2814']]) +
      lg('mLeatherD', 'v', [['0%', '#5a3c22'], ['100%', '#23150a']]) +
      lg('mBone', 'v', [['0%', '#fbf5e4'], ['60%', '#cfc4a4'], ['100%', '#8a7d5e']]) +
      lg('mIron', 'v', [['0%', '#7d879b'], ['50%', '#454d61'], ['100%', '#20242f']]) +
      lg('mGun', 'd', [['0%', '#6f7a86'], ['45%', '#3b434e'], ['100%', '#171b22']]) +
      lg('mOlive', 'v', [['0%', '#8e8a5c'], ['100%', '#4a4a2e']]) +
      lg('mWood', 'h', [['0%', '#9c6a3a'], ['50%', '#6b4423'], ['100%', '#3a2211']]) +
      lg('mStone', 'v', [['0%', '#aeb6c6'], ['55%', '#6a7386'], ['100%', '#353c4c']]) +
      lg('mObsid', 'v', [['0%', '#4b3d5c'], ['100%', '#14101e']]) +
      lg('mFire', 'v', [['0%', '#fff3b0'], ['35%', '#ffb02e'], ['75%', '#ff4d1c'], ['100%', '#7a0e0e']]) +
      lg('mIce', 'v', [['0%', '#ffffff'], ['50%', '#bfe9ff'], ['100%', '#4e9be0']]) +
      /* 피부 */
      lg('skN', 'v', [['0%', '#f3c9a3'], ['100%', '#a87553']]) +
      lg('skP', 'v', [['0%', '#e9d8ff'], ['100%', '#9d86c4']]) +
      lg('skD', 'v', [['0%', '#f26a4b'], ['55%', '#b2301f'], ['100%', '#54100c']]) +
      /* 진영 천 */
      lg('clV', 'd', [['0%', PAL.vanguard.c1], ['55%', PAL.vanguard.c2], ['100%', PAL.vanguard.c3]]) +
      lg('clE', 'd', [['0%', PAL.exile.c1], ['55%', PAL.exile.c2], ['100%', PAL.exile.c3]]) +
      lg('clA', 'd', [['0%', PAL.arcane.c1], ['55%', PAL.arcane.c2], ['100%', PAL.arcane.c3]]) +
      lg('clD', 'd', [['0%', PAL.demon.c1], ['55%', PAL.demon.c2], ['100%', PAL.demon.c3]]) +
      lg('clN', 'd', [['0%', PAL.neutral.c1], ['55%', PAL.neutral.c2], ['100%', PAL.neutral.c3]]) +
      /* 진영 에너지 */
      rg('enV', [['0%', '#fff8dc'], ['40%', PAL.vanguard.a], ['100%', PAL.vanguard.a, 0]]) +
      rg('enE', [['0%', '#ffffff'], ['40%', PAL.exile.a], ['100%', PAL.exile.a, 0]]) +
      rg('enA', [['0%', '#ffffff'], ['40%', PAL.arcane.a], ['100%', PAL.arcane.a, 0]]) +
      rg('enD', [['0%', '#fff1b0'], ['40%', PAL.demon.a], ['100%', PAL.demon.a, 0]]) +
      rg('enN', [['0%', '#ffffff'], ['40%', PAL.neutral.a], ['100%', PAL.neutral.a, 0]]) +
      rg('rgGround', [['0%', '#000', .62], ['100%', '#000', 0]]) +
      rg('rgArk', [['0%', '#e9fdff'], ['30%', '#5df0ff'], ['65%', '#1a8fbf', .7], ['100%', '#0a3550', 0]]) +
      /* 필터 */
      '<filter id="rgSil" x="-20%" y="-20%" width="140%" height="150%">' +
        '<feFlood flood-color="#04060c" flood-opacity=".8"/><feComposite in2="SourceAlpha" operator="in"/>' +
        '<feGaussianBlur stdDeviation="1.4"/><feOffset dy="2.6"/></filter>' +
      '<filter id="rgInk" x="-12%" y="-12%" width="124%" height="124%">' +
        '<feMorphology in="SourceAlpha" operator="dilate" radius="1.35" result="d"/>' +
        '<feFlood flood-color="#0a0d17"/><feComposite in2="d" operator="in" result="ink"/>' +
        '<feMerge result="m"><feMergeNode in="ink"/><feMergeNode in="SourceGraphic"/></feMerge>' +
        '<feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="4" result="n"/>' +
        '<feDisplacementMap in="m" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      '<filter id="rgSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>' +
      '<filter id="rgBlur1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2"/></filter>' +
      rim('rimV', PAL.vanguard.al) + rim('rimE', PAL.exile.al) + rim('rimA', PAL.arcane.al) +
      rim('rimD', PAL.demon.al) + rim('rimN', PAL.neutral.al) +
    '</defs></svg>';

  var defsInjected = false;
  function injectDefs(doc) {
    doc = doc || global.document;
    if (!doc || !doc.body || defsInjected || doc.getElementById('rg-defs')) return;
    var host = doc.createElement('div');
    host.innerHTML = DEFS;
    doc.body.insertBefore(host.firstChild, doc.body.firstChild);
    defsInjected = true;
  }
  if (global.document) {
    if (global.document.body) injectDefs();
    else global.document.addEventListener('DOMContentLoaded', function () { injectDefs(); });
  }

  /* ═══════════════ 토큰 ═══════════════
     %C%  진영 천 그라디언트   %C1% 밝은 천   %C2% 중간 천   %C3% 어두운 천
     %A%  진영 발광색          %AL% 림라이트  %E% 에너지 라디얼  %SK% 피부 */
  var K = '#0a0d17';   /* 잉크 */
  var W = '#ffffff';
  function paint(str, fac) {
    var p = PAL[fac] || PAL.neutral;
    var cl = { vanguard: 'clV', exile: 'clE', arcane: 'clA', demon: 'clD', neutral: 'clN' }[fac] || 'clN';
    return str
      .replace(/%C1%/g, p.c1).replace(/%C2%/g, p.c2).replace(/%C3%/g, p.c3)
      .replace(/%C%/g, 'url(#' + cl + ')')
      .replace(/%AL%/g, p.al).replace(/%A%/g, p.a)
      .replace(/%E%/g, 'url(#' + p.en + ')')
      .replace(/%SK%/g, 'url(#' + p.sk + ')');
  }
  /* 단축 헬퍼 */
  function pth(fill, d, extra) { return '<path fill="' + fill + '" d="' + d + '"' + (extra || '') + '/>'; }
  function shade(d, o) { return pth('#000', d, ' opacity="' + (o || .28) + '"'); }
  function lite(d, o) { return pth(W, d, ' opacity="' + (o || .32) + '"'); }
  function circ(fill, cx, cy, r, extra) { return '<circle fill="' + fill + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (extra || '') + '/>'; }
  function ell(fill, cx, cy, rx, ry, extra) { return '<ellipse fill="' + fill + '" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"' + (extra || '') + '/>'; }
  function rect(fill, x, y, w, h, r, extra) { return '<rect fill="' + fill + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (r || 0) + '"' + (extra || '') + '/>'; }
  var STEEL = 'url(#mSteel)', STEELD = 'url(#mSteelD)', GOLD = 'url(#mGold)', LEATHER = 'url(#mLeather)', LEATHERD = 'url(#mLeatherD)',
      BONE = 'url(#mBone)', IRON = 'url(#mIron)', GUN = 'url(#mGun)', OLIVE = 'url(#mOlive)', WOOD = 'url(#mWood)',
      STONE = 'url(#mStone)', OBSID = 'url(#mObsid)', FIRE = 'url(#mFire)', ICE = 'url(#mIce)', BRONZE = 'url(#mBronze)';

  /* ═══════════════ 파츠 라이브러리 ═══════════════ */
  var P = {};

  /* ── 다리 ── */
  P.legsPlate =
    pth(STEELD, 'M36 72h13l-1 20-2 12h-9l-1-14z') + pth(STEEL, 'M51 72h13l1 18-1 14h-9l-3-12z') +
    circ(STEEL, 42, 88, 4.6) + circ(STEELD, 58, 88, 4.6) +
    pth(IRON, 'M28 104q8-5 16-2l3 9H27z') + pth(IRON, 'M56 102q8-3 16 2l1 9H54z') +
    lite('M38 74h4l-1 12h-4z', .3);
  P.legsLight =
    pth(LEATHERD, 'M38 72h11l-1 22-2 10h-9l-1-14z') + pth(LEATHER, 'M51 72h11l1 20-1 12h-9l-2-12z') +
    pth('#1a1410', 'M29 104q8-4 15-2l2 9H28z') + pth('#1a1410', 'M57 102q7-2 15 2v9H55z') +
    rect(IRON, 34, 96, 12, 3, 1) + rect(IRON, 56, 96, 12, 3, 1);
  P.legsModern =
    pth(OLIVE, 'M38 72h11l-1 22-2 10h-9l-1-14z') + pth(OLIVE, 'M51 72h11l1 20-1 12h-9l-2-12z') +
    rect(GUN, 36, 88, 12, 6, 2) + rect(GUN, 54, 88, 12, 6, 2) +
    pth('#1d1c17', 'M29 104q8-4 15-2l2 9H28z') + pth('#1d1c17', 'M57 102q7-2 15 2v9H55z');
  P.robeSkirt =
    pth('%C%', 'M34 66q16-6 32 0l10 42q-26 6-52 0z') + shade('M50 66q8 0 16 0l10 42q-13 3-26 3z', .3) +
    pth('%C3%', 'M40 80q10 4 20 0l6 26q-16 4-32 0z', ' opacity=".55"') +
    pth(GOLD, 'M24 105q26 7 52 0l1 4q-27 7-54 0z') + lite('M36 68q4-2 8-2l-2 28h-6z', .18);
  P.legsHulk =
    pth('%SK%', 'M30 70h16l-2 24-4 10H28l2-16z') + pth('%SK%', 'M54 70h16l2 18-2 16h-12l-4-10z') +
    shade('M62 70h8l2 18-2 16h-8z', .3) +
    pth('#1a1014', 'M22 102q10-6 20-2l2 10H20z') + pth('#1a1014', 'M58 100q10-4 20 2v10H56z') +
    pth(BONE, 'M22 108l4-6 4 8zM70 108l4-6 4 8z');
  P.legsBone =
    pth(BONE, 'M40 72h8l-1 30h-7zM52 72h8l1 30h-8z') + circ(BONE, 44, 88, 4) + circ(BONE, 56, 88, 4) +
    pth(BONE, 'M36 102h12l3 8H34zM52 102h12l2 8H50z');

  /* ── 몸통 ── */
  P.bodyPlate =
    pth(STEEL, 'M31 44q19-9 38 0l-3 34q-16 7-32 0z') + shade('M50 40q10 1 19 4l-3 34q-8 3-16 4z', .26) +
    pth('%C%', 'M44 42h12l-1 36h-10z') + pth(GOLD, 'M46 46h8l-1 6h-6z') +
    lite('M36 46q6-3 12-4v8q-7 1-12 3z', .34) +
    rect(LEATHER, 33, 70, 34, 8, 3) + circ(GOLD, 50, 74, 4.4) + circ(K, 50, 74, 1.6);
  P.bodyTunic =
    pth('%C%', 'M33 45q17-7 34 0l-3 28q-14 6-28 0z') + shade('M50 41q9 1 17 4l-3 28q-7 2-14 3z', .28) +
    pth(LEATHER, 'M38 44l12 9 12-9 4 5-16 12-16-12z') + rect(LEATHERD, 34, 68, 32, 7, 3) + circ(BRONZE, 50, 71.5, 3.2) +
    lite('M37 47q5-3 10-3l-1 8q-5 1-9 3z', .22);
  P.bodyRobe =
    pth('%C%', 'M32 44q18-7 36 0l-2 26q-16 6-32 0z') + shade('M50 40q10 1 18 4l-2 26q-8 2-16 3z', .3) +
    pth('%C3%', 'M44 44l6 10 6-10 2 28H42z', ' opacity=".8"') + pth(GOLD, 'M45 42h10l-1 4h-8z') +
    pth(GOLD, 'M38 66q12 4 24 0v4q-12 4-24 0z');
  P.bodyCoat =
    pth(OLIVE, 'M32 44q18-7 36 0l-3 32q-15 6-30 0z') + shade('M50 40q10 1 18 4l-3 32q-7 2-15 3z', .3) +
    pth(GUN, 'M37 47h26l-2 22H39z') + pth('%C%', 'M45 47h10v22H45z', ' opacity=".9"') +
    rect(LEATHERD, 32, 62, 36, 7, 2) + rect(GUN, 36, 70, 10, 7, 2) + rect(GUN, 54, 70, 10, 7, 2) +
    rect('%A%', 40, 50, 4, 4, 1) + lite('M36 46q5-2 10-3v6q-6 1-10 3z', .2);
  P.bodyHulk =
    pth('%SK%', 'M26 44q24-11 48 0l-5 32q-19 8-38 0z') + shade('M50 38q13 1 24 6l-5 32q-9 4-19 5z', .3) +
    pth('%SK%', 'M36 50q6-4 14-3 8-1 14 3l-2 12q-12 5-24 0z') + shade('M50 47q8 0 14 3l-2 12q-6 2-12 3z', .22) +
    pth('%E%', 'M42 54q8-4 16 0l-2 16q-6 3-12 0z', ' opacity=".9"') +
    lite('M32 48q6-4 12-5l-1 10q-6 1-11 3z', .18);
  P.bodyBone =
    pth(BONE, 'M36 46q14-6 28 0l-2 26q-12 4-24 0z') + pth(K, 'M40 52h20v3H40zM40 58h20v3H40zM41 64h18v3H41z', ' opacity=".75"') +
    pth('%E%', 'M45 56h10v8H45z', ' opacity=".8"');
  P.bodyGolem =
    pth(STONE, 'M26 42q24-12 48 0l-4 36q-20 8-40 0z') + shade('M50 36q13 1 24 6l-4 36q-10 4-20 5z', .3) +
    pth('%E%', 'M40 52l10-8 10 8-10 14z', ' opacity=".95"') + pth(K, 'M32 60h8v4h-8zM60 60h8v4h-8z', ' opacity=".5"');

  /* ── 팔 / 어깨 ── */
  P.armsPlate =
    pth(STEELD, 'M24 54h10l3 24-10 2z') + pth(STEEL, 'M66 54h10l-3 26-10-2z') +
    pth(STEEL, 'M18 52q3-14 16-14t14 12q-15 2-30 2z') + pth(STEELD, 'M52 50q1-12 14-12t16 14q-15 0-30-2z') +
    pth('%C%', 'M20 48q4-8 14-8 8 0 12 6-13 2-26 2z', ' opacity=".9"') + pth('%C%', 'M54 46q4-6 12-6 10 0 14 8-13 0-26-2z', ' opacity=".75"') +
    rect(IRON, 22, 76, 12, 8, 3) + rect(IRON, 66, 78, 12, 8, 3);
  P.armsLight =
    pth('%C%', 'M26 52h10l3 22-9 3z') + pth('%C%', 'M64 52h10l-3 24-9-3z') +
    circ(LEATHER, 31, 50, 7.5) + circ(LEATHER, 69, 50, 7.5) +
    rect(LEATHERD, 24, 74, 11, 7, 3) + rect(LEATHERD, 65, 76, 11, 7, 3);
  P.armsModern =
    pth(OLIVE, 'M26 52h10l3 22-9 3z') + pth(OLIVE, 'M64 52h10l-3 24-9-3z') +
    pth(GUN, 'M22 50q4-8 12-8 6 0 10 6-11 3-22 2z') + pth(GUN, 'M56 48q4-6 10-6 8 0 12 8-11 1-22-2z') +
    rect('#1d1c17', 24, 74, 11, 7, 3) + rect('#1d1c17', 65, 76, 11, 7, 3);
  P.armsRobe =
    pth('%C%', 'M30 50l-12 26 20 2 2-24z') + pth('%C%', 'M70 50l12 26-20 2-2-24z') +
    shade('M70 50l12 26-12 1z', .3) + pth('%C3%', 'M18 76l20 2-1 4-20-2zM62 78l20-2 1 4-20 2z', ' opacity=".8"');
  P.armsHulk =
    pth('%SK%', 'M14 54h14l5 26-14 4z') + pth('%SK%', 'M72 54h14l-5 30-14-4z') +
    circ('%SK%', 24, 50, 14) + circ('%SK%', 76, 50, 14) + shade('M76 36a14 14 0 0 1 0 28z', .3) +
    pth(BONE, 'M14 42l6-12 6 12zM74 42l6-12 6 12z') +
    pth('#1a1014', 'M12 78l14-2 2 8-14 3zM74 80l14 2-2 8-14-3z');

  /* ── 머리 ── */
  P.headKnight =
    rect(K, 44, 34, 12, 10, 3) +
    pth(STEEL, 'M34 30q16-18 32 0v11q-16 8-32 0z') + shade('M50 17q10 2 16 13v11q-8 4-16 5z', .24) +
    pth(K, 'M36 32h28v5H36z') + pth('%A%', 'M39 33h9v3h-9zM52 33h9v3h-9z') +
    pth('%C%', 'M50 6q9 9 4 20-2 5-4 6-1-11-5-16z') + pth(GOLD, 'M34 41h32v3H34z') + lite('M38 26q5-6 10-7l-1 5q-5 1-9 4z', .4);
  P.headGreat =
    pth(STEEL, 'M33 28q17-20 34 0v16q-17 9-34 0z') + shade('M50 14q10 1 17 14v16q-9 4-17 5z', .26) +
    pth(K, 'M38 32h24v4H38zM48 26h4v20h-4z') + pth('%A%', 'M40 33h6v2h-6zM54 33h6v2h-6z') +
    pth(GOLD, 'M33 43h34v3H33z') + pth(GOLD, 'M44 12l6-8 6 8-2 6h-8z') + lite('M37 24q4-6 9-8l-1 5q-4 2-8 5z', .4);
  P.headModern =
    rect('%SK%', 43, 32, 14, 13, 4) + pth(GUN, 'M33 30q17-16 34 0v7q-17 5-34 0z') + shade('M50 18q10 1 17 12v7q-9 3-17 3z', .3) +
    pth(K, 'M35 34h30v5H35z') + rect('%A%', 55, 25, 11, 6, 2) + pth(K, 'M41 40h18v5H41z') + lite('M36 27q5-6 12-7l-1 5q-6 1-11 4z', .3);
  P.headCap =
    rect('%SK%', 43, 32, 14, 13, 4) + pth(K, 'M46 40h8v3h-8z', ' opacity=".5"') +
    pth(OLIVE, 'M33 32q17-14 34 0z') + rect(GUN, 31, 31, 38, 4, 2) + pth('%C%', 'M44 24h12l2 8H42z') + circ(GOLD, 50, 28, 2.6);
  P.headHood =
    pth('%C%', 'M32 44q0-30 18-34 18 4 18 34-18 9-36 0z') + shade('M50 10q18 4 18 34-9 5-18 6z', .3) +
    ell(K, 50, 34, 12, 10) + circ('%A%', 45, 34, 2.6) + circ('%A%', 55, 34, 2.6) +
    circ('%A%', 45, 34, 5, ' opacity=".35" filter="url(#rgBlur1)"') + circ('%A%', 55, 34, 5, ' opacity=".35" filter="url(#rgBlur1)"');
  P.headWizard =
    pth('%SK%', 'M40 34q10-8 20 0v10q-10 5-20 0z') + pth(K, 'M45 36h3v2h-3zM52 36h3v2h-3z') +
    pth('%C%', 'M30 36q20 4 40 0l-14-32z') + shade('M56 4l14 32q-10 2-20 1z', .3) + pth(GOLD, 'M30 36q20 5 40 0l1 3q-21 5-42 0z') +
    pth(BONE, 'M42 42q8 10 16 0l-2 12q-6 4-12 0z');
  P.headHorned =
    pth('%SK%', 'M34 30q16-16 32 0v12q-16 9-32 0z') + shade('M50 18q10 1 16 12v12q-8 4-16 5z', .3) +
    pth(BONE, 'M34 28Q26 12 14 8q6 16 16 24zM66 28q8-16 20-20-6 16-16 24z') +
    circ('%A%', 42, 32, 3.6) + circ('%A%', 58, 32, 3.6) + circ('%A%', 42, 32, 7, ' opacity=".3" filter="url(#rgBlur1)"') +
    pth(K, 'M42 41l8 5 8-5-3 7H45z') + pth(BONE, 'M45 43l1 4 2-3zM53 43l-1 4-2-3z');
  P.headSkull =
    pth(BONE, 'M34 28q16-17 32 0v9q0 8-7 11l-1 6H42l-1-6q-7-3-7-11z') + shade('M50 15q10 1 16 13v9q0 8-7 11l-1 6h-8z', .22) +
    circ(K, 43, 32, 5) + circ(K, 57, 32, 5) + circ('%A%', 43, 32, 2.2) + circ('%A%', 57, 32, 2.2) +
    pth(K, 'M47 40h6l-3 5z') + pth(K, 'M44 48h12v2H44z', ' opacity=".6"');
  P.headCrown =
    rect(K, 44, 34, 12, 10, 3) + pth(STEEL, 'M35 30q15-16 30 0v11q-15 8-30 0z') + shade('M50 18q9 1 15 12v11q-8 4-15 5z', .24) +
    pth(K, 'M37 33h26v4H37z') + pth('%A%', 'M40 34h8v2h-8zM52 34h8v2h-8z') +
    pth(GOLD, 'M31 26l3-17 7 10 9-15 9 15 7-10 3 17z') + circ('%A%', 50, 17, 3.4) + lite('M33 24l3-10 3 5z', .5);
  P.headBare =
    circ('%SK%', 50, 33, 12) + pth(LEATHERD, 'M38 30q12-11 24 0-2-4-12-6-10 2-12 6z') + pth(LEATHERD, 'M38 30q3 6 2 14l-4-2z') +
    circ(K, 45, 34, 1.9) + circ(K, 55, 34, 1.9) + pth(K, 'M46 40q4 3 8 0', ' fill="none" stroke="' + K + '" stroke-width="1.4" stroke-linecap="round" opacity=".7"');
  P.headGem =
    pth(STONE, 'M36 24h28v20H36z') + shade('M50 24h14v20H50z', .3) + pth('%E%', 'M50 27l10 9-10 9-10-9z') + lite('M50 29l5 5-5 4-5-4z', .5) +
    pth(K, 'M36 44h28v3H36z', ' opacity=".6"');
  P.headHalo =
    circ('%SK%', 50, 33, 11) + pth(GOLD, 'M40 28q10-9 20 0-2-5-10-6-8 1-10 6z') + circ(K, 45, 34, 1.8) + circ(K, 55, 34, 1.8) +
    '<circle fill="none" stroke="' + GOLD + '" stroke-width="3" cx="50" cy="20" r="14"/>' +
    circ('%A%', 50, 20, 17, ' opacity=".25" filter="url(#rgBlur1)"');
  P.headGoggle =
    rect('%SK%', 43, 32, 14, 13, 4) + pth(GUN, 'M33 30q17-16 34 0v7q-17 5-34 0z') +
    circ(K, 43, 36, 5.5) + circ(K, 57, 36, 5.5) + circ('%A%', 43, 36, 3.5) + circ('%A%', 57, 36, 3.5) + lite('M41 34a3 3 0 0 1 3-2', .6) +
    pth(K, 'M44 42h12v3H44z', ' opacity=".6"');

  /* ── 무기 (오른손 · 화면 우측) ── */
  P.wSword =
    pth(STEEL, 'M75 54h9l-1-38-3-8-4 8z') + lite('M78 50h2V16h-2z', .6) + shade('M80 54h4l-1-38-3-8z', .22) +
    rect(GOLD, 68, 53, 23, 5.5, 2.6) + rect(LEATHERD, 76, 58.5, 7, 13, 2.6) + circ(GOLD, 79.5, 74, 4.2);
  P.wGreatsword =
    pth(STEEL, 'M72 50h16l-3-44-5-6-5 6z') + lite('M78 46h3V8h-3z', .55) + shade('M80 50h8l-3-44-5-6z', .22) +
    rect(GOLD, 62, 49, 36, 7, 3.5) + rect(LEATHERD, 76, 56, 8, 18, 3) + circ(GOLD, 80, 78, 5) + circ('%A%', 80, 78, 2);
  P.wSpear =
    rect(WOOD, 77, 16, 5, 64, 2) + pth(STEEL, 'M79.5 0l8 18h-16z') + lite('M79.5 4l4 12h-4z', .5) + pth(GOLD, 'M71 18h17v4H71z') +
    pth('%C%', 'M72 20l-8 12 8 2z');
  P.wLance =
    pth(WOOD, 'M74 18h10l4 60H72z') + pth(STEEL, 'M79 0l7 18H72z') + pth(GOLD, 'M70 60h18v5H70z') + pth('%C%', 'M71 22h16l-8 24z', ' opacity=".9"');
  P.wAxe =
    rect(WOOD, 77, 22, 5, 56, 2) + pth(STEEL, 'M79 18q20-12 22 12-14 12-22 2z') + shade('M83 24q12-5 16 6-9 6-16 0z', .25) +
    pth(K, 'M80 20q4 6 0 12', ' fill="none" stroke="' + K + '" stroke-width="2"') + lite('M84 20q8-3 12 3', .5);
  P.wHammer =
    rect(WOOD, 77, 30, 5, 48, 2) + rect(STEEL, 66, 12, 28, 20, 5) + shade('M80 12h14v20H80z', .25) + pth(GOLD, 'M66 19h28v5H66z') +
    pth('%A%', 'M72 16h6v4h-6z', ' opacity=".9"');
  P.wStaff =
    rect(WOOD, 77, 28, 5, 54, 2.4) + pth(GOLD, 'M72 28q8-10 16 0l-4 6h-8z') +
    circ('%E%', 80, 17, 14, ' opacity=".5"') + circ('%C1%', 80, 17, 7.5) + circ(W, 77, 14.5, 2.6, ' opacity=".8"');
  P.wScythe =
    rect(WOOD, 77, 18, 5, 62, 2) + pth(STEEL, 'M80 16Q48 4 36 30q22-14 44-6z') + lite('M74 18q-20-6-30 8', .4);
  P.wRifle =
    rect(GUN, 58, 52, 38, 6.5, 2) + rect(K, 92, 53.5, 12, 3.6, 1.6) + pth(WOOD, 'M60 58h13l-4 15h-9z') +
    rect(K, 70, 45, 10, 8, 2) + rect(GUN, 74, 58, 6, 10, 2) + rect('%A%', 66, 49, 4, 3, 1) + lite('M60 53h30v1.6H60z', .35);
  P.wSniper =
    rect(GUN, 54, 52, 48, 5.2, 2) + rect(K, 68, 42, 24, 6.5, 3) + circ('%A%', 92, 45, 3.4) + pth(WOOD, 'M56 57h13l-4 16h-9z') +
    rect(K, 58, 46, 9, 6, 2) + rect(GUN, 96, 50, 6, 9, 1) + lite('M58 53h36v1.4H58z', .35);
  P.wWrench =
    rect(IRON, 76, 34, 6.5, 40, 2.5) + pth(STEEL, 'M72 34q7-14 15 0-3 6-7 6t-8-6z') + circ(K, 79.5, 31, 3.4) + rect(GOLD, 75, 66, 8.5, 4, 1);
  P.wClaws =
    pth(BONE, 'M70 54q11 6 15 22l-6 2q-4-13-11-19z') + pth(BONE, 'M77 50q12 5 17 19l-6 2q-5-12-13-16z') +
    pth(BONE, 'M84 46q12 4 18 16l-6 3q-6-10-14-14z') + shade('M84 46q12 4 18 16l-3 1q-6-9-15-13z', .25);
  P.wBanner =
    rect(WOOD, 77, 8, 5, 72, 2) + pth('%C%', 'M52 12h26v30L66 34l-14 8z') + shade('M66 12h12v30L66 34z', .25) +
    pth(GOLD, 'M58 20h14v3H58z') + circ(GOLD, 79.5, 6, 4.6) + pth(GOLD, 'M74 10h11v3H74z');
  P.wBow =
    '<path d="M70 12q22 24 0 66" fill="none" stroke="' + WOOD + '" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M70 12v66" fill="none" stroke="' + K + '" stroke-width="1.6"/>' +
    pth(STEEL, 'M54 43h36l-7-4v8z') + pth('%C%', 'M54 41l-6 2 6 2z');
  P.wTome =
    rect(LEATHERD, 66, 50, 22, 26, 3, ' transform="rotate(-12 77 63)"') + rect(BONE, 69, 53, 16, 20, 1, ' transform="rotate(-12 77 63)"') +
    pth('%A%', 'M74 58l4 6 4-6-4 10z', ' transform="rotate(-12 77 63)"');
  P.wNone = '';

  /* ── 왼손 ── */
  P.oShield =
    pth(STEEL, 'M10 46l20-7 20 7v20q0 15-20 24Q10 81 10 66z') + shade('M30 39l20 7v20q0 15-20 24z', .25) +
    pth('%C%', 'M18 51l12-4 12 4v14q0 9-12 15-12-6-12-15z') + pth(GOLD, 'M30 54l3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7z') + lite('M14 48l14-5v6l-14 5z', .3);
  P.oTowerShield =
    pth(STEELD, 'M6 34h30v50q0 11-15 17Q6 95 6 84z') + pth(STEEL, 'M9 37h24v46q0 8-12 13Q9 91 9 83z') +
    pth('%C%', 'M13 42h16v40q0 6-8 10-8-4-8-10z') + pth(GOLD, 'M19 48h4v34h-4zM12 60h18v4H12z') +
    rect(GOLD, 6, 34, 30, 3, 1) + lite('M10 40h6v40h-6z', .18);
  P.oOrb =
    circ('%E%', 22, 60, 18, ' opacity=".55"') + circ('%C1%', 22, 60, 10.5) + shade('M22 49.5a10.5 10.5 0 0 1 0 21z', .2) +
    circ(W, 18.5, 56.5, 3.4, ' opacity=".8"') + pth(GOLD, 'M12 68q10 6 20 0l-2 6q-8 3-16 0z');
  P.oMedkit =
    rect(K, 8, 50, 28, 22, 4) + rect(W, 19, 53, 6, 16, 1.5) + rect(W, 12, 58, 20, 6, 1.5) + rect(GUN, 16, 46, 12, 5, 2) + lite('M10 52h4v18h-4z', .15);
  P.oSack =
    pth(LEATHER, 'M12 54q10-10 22 0l5 20q-16 8-32 0z') + shade('M24 50q6 0 10 4l5 20q-8 4-15 4z', .3) +
    pth(LEATHERD, 'M18 48h12l3 7H15z') + circ(GOLD, 22, 66, 3.5) + circ(GOLD, 30, 68, 2.6);
  P.oHourglass =
    pth(GOLD, 'M10 46h26v5H10zM10 76h26v5H10z') + pth('%C1%', 'M15 51h16l-8 12 8 12H15l8-12z', ' opacity=".55"') +
    pth('%A%', 'M17 53h12l-6 8zM17 73h12l-6-8z') + lite('M19 54h6l-3 5z', .6) + rect(WOOD, 11, 51, 2.5, 25, 1) + rect(WOOD, 32.5, 51, 2.5, 25, 1);
  P.oTome =
    rect(LEATHERD, 8, 50, 26, 30, 3) + rect(BONE, 11, 53, 20, 24, 1) + pth('%A%', 'M18 60l3 5 3-5-3 10z') + pth(K, 'M14 68h14v1.6H14zM14 72h10v1.6H14z', ' opacity=".5"');
  P.oLantern =
    rect(IRON, 14, 50, 16, 22, 3) + pth('%E%', 'M17 54h10v14H17z') + pth(K, 'M20 46h4v5h-4z') + circ(FIRE, 22, 61, 3.5);
  P.oNone = '';

  /* ── 등 ── */
  P.bCloak =
    pth('%C%', 'M30 44q-16 26-12 62l32-8 32 8q4-36-12-62z', ' opacity=".95"') + shade('M50 40q10 2 20 6 6 30 0 54l-20-6z', .32) +
    pth('%C3%', 'M18 106l32-8 32 8-2 4-30-7-30 7z', ' opacity=".7"');
  P.bCape =
    pth('%C%', 'M34 44q-10 22-8 52l24-6 24 6q2-30-8-52z', ' opacity=".95"') + shade('M50 42q8 1 16 4 4 26 0 46l-16-4z', .3);
  P.bWings =
    pth(BONE, 'M36 40Q6 24-6 50q8-4 14 2-2 8 2 16 8-14 26-20z') + pth(BONE, 'M64 40q30-16 42 10-8-4-14 2 2 8-2 16-8-14-26-20z') +
    shade('M64 40q30-16 42 10-8-4-14 2 2 8-2 16-3-6-8-11z', .2) +
    pth(W, 'M30 46q-14-4-24 8 12-2 22 6z', ' opacity=".35"') + pth(W, 'M70 46q14-4 24 8-12-2-22 6z', ' opacity=".3"');
  P.bBatWings =
    pth('%C3%', 'M36 42Q10 20-8 46l10 2-4 12 12-4 2 12 12-10q-2-10 12-16z') + pth('%C3%', 'M64 42q26-22 44 4l-10 2 4 12-12-4-2 12-12-10q2-10-12-16z') +
    pth('%C%', 'M34 46Q14 30 0 46l8 1-2 8 8-2 2 7 8-6q-2-8 10-12z', ' opacity=".6"') + pth('%C%', 'M66 46q20-16 34 0l-8 1 2 8-8-2-2 7-8-6q2-8-10-12z', ' opacity=".5"');
  P.bBoneWings = P.bBatWings;
  P.bAura = circ('%E%', 50, 60, 36, ' opacity=".4"');
  P.bNone = '';

  var GROUND = ell('url(#rgGround)', 50, 116, 30, 6);

  /* ═══════════════ 캐릭터 조립 ═══════════════ */
  function figure(spec) {
    return GROUND +
      (P['b' + cap(spec.back || 'None')] || '') +
      (P[spec.legs] || P.legsPlate) +
      (P[spec.body] || P.bodyPlate) +
      (P[spec.arms] || P.armsPlate) +
      (P['o' + cap(spec.off || 'None')] || '') +
      (P['w' + cap(spec.weapon || 'None')] || '') +
      (P[spec.head] || P.headKnight) +
      (spec.extra || '');
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function mix(base, over) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in over) o[k] = over[k]; return o; }

  var KNIGHT  = { legs: 'legsPlate',  body: 'bodyPlate', arms: 'armsPlate',  head: 'headKnight' };
  var SOLDIER = { legs: 'legsModern', body: 'bodyCoat',  arms: 'armsModern', head: 'headModern' };
  var LIGHT   = { legs: 'legsLight',  body: 'bodyTunic', arms: 'armsLight',  head: 'headBare' };
  var MAGE    = { legs: 'robeSkirt',  body: 'bodyRobe',  arms: 'armsRobe',   head: 'headHood' };
  var FIEND   = { legs: 'legsHulk',   body: 'bodyHulk',  arms: 'armsHulk',   head: 'headHorned' };
  var UNDEAD  = { legs: 'legsBone',   body: 'bodyBone',  arms: 'armsLight',  head: 'headSkull' };

  var FIGS = {
    /* 중립 */
    n_scout:      mix(LIGHT,  { head: 'headHood', weapon: 'sword', back: 'cape' }),
    n_bulwark:    mix(KNIGHT, { head: 'headGreat', off: 'towerShield' }),
    n_merc:       mix(KNIGHT, { weapon: 'sword', off: 'shield' }),
    n_medic:      mix(SOLDIER,{ head: 'headCap', off: 'medkit' }),
    n_looter:     mix(LIGHT,  { head: 'headHood', weapon: 'axe', off: 'sack' }),
    n_golem:      { legs: 'legsHulk', body: 'bodyGolem', arms: 'armsHulk', head: 'headGem' },
    n_warlord:    mix(KNIGHT, { head: 'headCrown', weapon: 'banner', back: 'cloak' }),
    n_apoth:      mix(LIGHT,  { head: 'headHood', off: 'medkit' }),
    n_pathfinder: mix(LIGHT,  { head: 'headCap', weapon: 'sword', back: 'cape' }),
    n_duelist:    mix(LIGHT,  { weapon: 'sword', back: 'cape' }),
    n_windrider:  mix(LIGHT,  { weapon: 'spear', back: 'wings' }),
    n_falcon:     mix(LIGHT,  { head: 'headCap', weapon: 'bow' }),
    tk_soldier:   mix(SOLDIER,{ weapon: 'rifle' }),
    /* 밴가드 */
    v_rifleman:   mix(SOLDIER, { weapon: 'rifle' }),
    v_sapper:     mix(SOLDIER, { head: 'headCap', weapon: 'wrench' }),
    v_sniper:     mix(SOLDIER, { head: 'headGoggle', weapon: 'sniper' }),
    v_shock:      mix(SOLDIER, { weapon: 'rifle', back: 'cape' }),
    v_grenadier:  mix(SOLDIER, { head: 'headCap', weapon: 'rifle', back: 'cape' }),
    v_hero:       mix(SOLDIER, { head: 'headCap', weapon: 'rifle', back: 'cloak' }),
    v_fortress:   mix(KNIGHT,  { head: 'headGreat', off: 'towerShield' }),
    v_blitz:      mix(SOLDIER, { weapon: 'sword', back: 'cape' }),
    v_flamer:     mix(SOLDIER, { head: 'headGoggle', weapon: 'rifle' }),
    v_marksman:   mix(SOLDIER, { head: 'headCap', weapon: 'rifle' }),
    /* 엑자일 */
    e_squire:      mix(LIGHT,  { head: 'headKnight', weapon: 'sword' }),
    e_shield:      mix(KNIGHT, { head: 'headGreat', off: 'towerShield' }),
    e_retainer:    mix(LIGHT,  { weapon: 'spear', off: 'shield' }),
    e_templar:     mix(KNIGHT, { weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_lancer:      mix(KNIGHT, { weapon: 'lance', off: 'shield' }),
    e_gale:        mix(KNIGHT, { weapon: 'spear', back: 'cape' }),
    e_paladin:     mix(KNIGHT, { head: 'headGreat', weapon: 'hammer', off: 'towerShield', back: 'cloak' }),
    e_marshal:     mix(KNIGHT, { head: 'headCrown', weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_grandmaster: mix(KNIGHT, { head: 'headCrown', weapon: 'greatsword', back: 'cloak' }),
    e_banneret:    mix(KNIGHT, { weapon: 'banner' }),
    e_vindicator:  mix(KNIGHT, { weapon: 'greatsword' }),
    e_seraph:      mix(KNIGHT, { head: 'headHalo', weapon: 'sword', back: 'wings' }),
    e_chaplain:    mix(MAGE,   { head: 'headHood', off: 'tome' }),
    e_crusader:    mix(KNIGHT, { weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_archon:      mix(MAGE,   { head: 'headGreat', weapon: 'staff', back: 'cloak' }),
    e_avenger:     mix(KNIGHT, { weapon: 'sword', back: 'cloak' }),
    e_hero:        mix(KNIGHT, { head: 'headGreat', weapon: 'sword', off: 'towerShield', back: 'cloak' }),
    /* 아케인 */
    a_apprentice:   mix(MAGE, { head: 'headWizard', weapon: 'staff' }),
    a_elementalist: mix(MAGE, { weapon: 'staff', off: 'orb' }),
    a_chrono:       mix(MAGE, { head: 'headWizard', off: 'hourglass' }),
    a_guard:        mix(KNIGHT, { head: 'headGreat', body: 'bodyRobe', off: 'towerShield', back: 'wings' }),
    a_sage:         mix(MAGE, { head: 'headWizard', weapon: 'staff', off: 'orb', back: 'cloak' }),
    a_archivist:    mix(MAGE, { off: 'tome', back: 'cloak' }),
    a_adept:        mix(MAGE, { head: 'headBare', weapon: 'staff' }),
    a_phase:        mix(MAGE, { back: 'cloak' }),
    a_storm:        mix(MAGE, { weapon: 'staff' }),
    a_chronarch:    mix(MAGE, { weapon: 'staff', off: 'hourglass' }),
    a_voidcaller:   mix(MAGE, { head: 'headBare', weapon: 'staff', back: 'cloak' }),
    a_hero:         mix(MAGE, { weapon: 'staff', back: 'cloak' }),
    /* 데몬 */
    d_imp:       { legs: 'legsHulk', body: 'bodyTunic', arms: 'armsLight', head: 'headHorned', weapon: 'claws', back: 'batWings' },
    d_tormentor: mix(FIEND, { weapon: 'claws', off: 'lantern' }),
    d_ravager:   mix(FIEND, { weapon: 'axe' }),
    d_soul:      mix(UNDEAD, { weapon: 'scythe', back: 'cloak' }),
    d_bones:     mix(UNDEAD, { weapon: 'staff', back: 'cape' }),
    d_abyss:     mix(FIEND, { off: 'towerShield' }),
    d_riftlord:  mix(FIEND, { weapon: 'greatsword', back: 'cloak' }),
    d_valgar:    mix(FIEND, { weapon: 'greatsword', back: 'batWings' }),
    d_glutton:   mix(FIEND, { head: 'headSkull', weapon: 'claws' }),
    d_warfiend:  mix(FIEND, { weapon: 'axe', back: 'cloak' }),
    d_legion:    mix(FIEND, { weapon: 'sword', back: 'cloak' }),
    d_ritualist: mix(MAGE,  { head: 'headHorned', weapon: 'staff' }),
    d_gate:      mix(FIEND, { weapon: 'axe' }),
    d_hero:      mix(FIEND, { weapon: 'axe', back: 'cloak' }),
    /* 장군 */
    gen_volkov: mix(SOLDIER, { head: 'headCap', weapon: 'sniper', back: 'cloak',
      extra: pth(GOLD, 'M38 50h7v4h-7zM38 56h7v4h-7zM38 62h7v4h-7z') + rect('%A%', 55, 50, 6, 3, 1) }),
    gen_arden:  mix(KNIGHT, { head: 'headCrown', weapon: 'greatsword', off: 'shield', back: 'cloak',
      extra: pth(GOLD, 'M33 44h34v3H33z') }),
    gen_selene: mix(MAGE, { head: 'headWizard', weapon: 'staff', off: 'orb', back: 'cloak',
      extra: circ('%E%', 50, 30, 30, ' opacity=".28"') + pth(GOLD, 'M64 4a19 19 0 1 0 0 32 15 15 0 1 1 0-32z') }),
    gen_karnak: mix(FIEND, { weapon: 'greatsword', back: 'batWings',
      extra: circ('%E%', 50, 58, 30, ' opacity=".28"') + pth(GOLD, 'M30 22l4-14 6 8 10-14 10 14 6-8 4 14z', ' transform="translate(0,-2)"') })
  };

  /* ═══════════════ 비인간형 ═══════════════ */
  var S = {};
  S.tank = GROUND +
    pth(K, 'M6 82h88q4 0 4 10t-4 10H6q-4 0-4-10t4-10z') + circ(GUN, 20, 92, 7.5) + circ(GUN, 40, 92, 7.5) + circ(GUN, 60, 92, 7.5) + circ(GUN, 80, 92, 7.5) +
    pth(OLIVE, 'M10 62h80l8 20H2z') + shade('M50 62h40l8 20H50z', .25) + pth(OLIVE, 'M26 40h46l8 22H18z') + shade('M50 40h22l8 22H50z', .25) +
    rect(GUN, 66, 44, 40, 8, 4) + rect(K, 100, 42, 8, 12, 3) + pth('%C%', 'M30 66h20v8H30z') + lite('M30 43h20l-3 8H27z', .3) + rect('%A%', 34, 46, 5, 3, 1);
  S.apc = GROUND +
    pth(OLIVE, 'M6 66l16-26h54l22 26v20H6z') + shade('M50 40h26l22 26v20H50z', .25) + pth(GUN, 'M24 46h46l16 20H12z') +
    rect('%A%', 32, 50, 30, 9, 3, ' opacity=".9"') + circ(K, 26, 92, 13) + circ(K, 72, 92, 13) + circ(GUN, 26, 92, 6) + circ(GUN, 72, 92, 6) +
    pth('%C%', 'M42 70h16v7H42z') + lite('M10 66l12-18h10l-10 18z', .2);
  S.turret = GROUND +
    pth(LEATHERD, 'M14 90h72l-6 16H20z') + pth(OLIVE, 'M22 66h56l6 26H16z') + shade('M50 66h28l6 26H50z', .25) +
    pth(GUN, 'M34 42h32l6 24H28z') + rect(GUN, 62, 47, 40, 6, 3) + rect(GUN, 62, 56, 34, 5, 2.5) + circ('%A%', 50, 54, 5) +
    pth('%C%', 'M26 72h48v6H26z', ' opacity=".8"') + pth(LEATHER, 'M14 90h20v-8h-20zM66 90h20v-8h-20z');
  S.mortar = GROUND +
    pth(LEATHERD, 'M12 96h76l-4 12H16z') + rect(GUN, 40, 26, 22, 60, 9, ' transform="rotate(22 51 56)"') +
    pth(STEEL, 'M44 28h16l-2 10H46z', ' transform="rotate(22 51 33)"') + pth(OLIVE, 'M18 88h64l-6 10H24z') +
    circ('%E%', 74, 22, 10, ' opacity=".7"') + pth(GUN, 'M30 70l10 18M70 70l-10 18', ' fill="none" stroke="' + GUN + '" stroke-width="5"');
  S.railgun = GROUND +
    pth(LEATHERD, 'M12 96h76l-4 12H16z') + pth(GUN, 'M20 70h60l6 24H14z') + rect(GUN, 40, 30, 20, 40, 6, ' transform="rotate(-30 50 50)"') +
    rect('%A%', 46, 20, 8, 50, 3, ' transform="rotate(-30 50 50)" opacity=".9"') + circ('%E%', 78, 18, 12, ' opacity=".7"') + pth('%C%', 'M26 76h48v6H26z');
  S.drone = ell(K, 50, 100, 16, 3, ' opacity=".4"') +
    ell('%C%', 50, 50, 24, 12) + shade('M50 38a24 12 0 0 1 0 24z', .25) + pth(GUN, 'M20 40h60v6H20z') +
    ell(GUN, 20, 40, 14, 3) + ell(GUN, 80, 40, 14, 3) + circ('%A%', 50, 52, 4.5) + pth(K, 'M46 62h8v8h-8z');
  S.airship = ell(K, 50, 104, 26, 4, ' opacity=".45"') +
    ell('%C%', 50, 36, 40, 21) + shade('M50 15a40 21 0 0 1 0 42z', .26) + lite('M22 26q16-10 34-4-18 0-30 8z', .4) +
    pth(GOLD, 'M10 36h80', ' fill="none" stroke="' + GOLD + '" stroke-width="2"') +
    pth(WOOD, 'M28 60h44l-7 22H35z') + pth(K, 'M28 60h44v4H28z') + pth(GOLD, 'M34 66h32v3H34z') + pth(IRON, 'M32 56l-3-6h7zM68 56l3-6h-7z') + circ('%A%', 50, 72, 3);
  S.galleon = ell(K, 50, 110, 40, 4, ' opacity=".45"') +
    pth(WOOD, 'M4 74h92l-14 28H18z') + pth(K, 'M4 74h92v5H4z') + pth(GOLD, 'M12 84h76v4H12z') + pth(WOOD, 'M4 74q-4-10 6-16z') +
    rect(WOOD, 47, 8, 6, 66, 2) + pth('%C%', 'M55 14q30 12 0 34z') + pth('%C%', 'M45 22q-26 10 0 28z', ' opacity=".85"') + shade('M55 14q30 12 0 34z', .2) +
    circ('%E%', 50, 8, 8, ' opacity=".8"') + pth('%A%', 'M50 2l3 6h-6z');
  S.hound = GROUND +
    pth('%SK%', 'M18 62q10-20 32-20t32 18l-6 36H24z') + shade('M50 42q24 0 32 18l-6 36H50z', .26) + pth(K, 'M24 92h13v18H24zM60 92h13v18H60z') +
    pth('%SK%', 'M68 38q20 0 24 16-8 12-26 8z') + pth(BONE, 'M64 32l-6-18 14 8zM82 34l8-18-2 20z') + circ('%A%', 80, 48, 4) + circ('%A%', 80, 48, 8, ' opacity=".35" filter="url(#rgBlur1)"') +
    pth(BONE, 'M82 60l12-2-6 8zM76 62l4 6', ' fill="none" stroke="' + BONE + '" stroke-width="2"') + pth('%E%', 'M18 60q-14 6-16 20 12-6 20-6z', ' opacity=".7"') +
    pth(FIRE, 'M30 44q-6-10 4-16-2 8 6 12z', ' opacity=".8"');
  S.leech = GROUND +
    pth('%C3%', 'M20 80q0-30 30-32 30 2 30 32-14 20-30 22-16-2-30-22z') + shade('M50 48q30 2 30 32-14 20-30 22z', .3) +
    pth('%SK%', 'M40 56q10-6 20 0-4 14-10 16-6-2-10-16z') + circ('%A%', 44, 62, 3) + circ('%A%', 56, 62, 3) + circ('%A%', 50, 72, 2.4) +
    pth(BONE, 'M36 84l-8 16M64 84l8 16M28 70l-12 10M72 70l12 10', ' fill="none" stroke="' + BONE + '" stroke-width="3" stroke-linecap="round"') +
    pth(BONE, 'M42 88l8 6 8-6-8 12z');
  S.charger = GROUND +
    pth('%SK%', 'M14 70q6-24 36-26 30 2 36 24l-8 34H22z') + shade('M50 44q30 2 36 24l-8 34H50z', .26) + pth(K, 'M20 92h14v18H20zM64 92h14v18H64z') +
    pth(BONE, 'M20 50L4 22l22 20zM80 50l16-28-22 20z') + pth(STEEL, 'M30 46q20-6 40 0l-4 10q-16-4-32 0z') + pth('%C%', 'M40 48h20v6H40z') +
    circ('%A%', 34, 62, 3.6) + circ('%A%', 66, 62, 3.6) + pth(K, 'M40 80h20l-2 6H42z');
  S.jugger = GROUND +
    pth(K, 'M6 84h88q4 0 4 9t-4 9H6q-4 0-4-9t4-9z') + circ(GUN, 22, 93, 7) + circ(GUN, 50, 93, 7) + circ(GUN, 78, 93, 7) +
    pth(STONE, 'M10 60h80l6 24H4z') + shade('M50 60h40l6 24H50z', .25) + pth(STONE, 'M22 36h56l10 26H12z') + shade('M50 36h28l10 26H50z', .25) +
    pth(STEEL, 'M6 62l6-18h8l-4 18zM94 62l-6-18h-8l4 18z') + pth('%C%', 'M40 44h20v12H40z') + rect('%A%', 46, 66, 8, 4, 1);
  S.floatstone = ell(K, 50, 108, 18, 3, ' opacity=".35"') +
    circ('%E%', 50, 54, 36, ' opacity=".35"') + pth(STONE, 'M50 16l28 20-11 36H33L22 36z') + shade('M50 16l28 20-11 36H50z', .28) +
    pth('%C%', 'M50 34l13 10-5 17H42l-5-17z') + pth('%E%', 'M50 40l7 6-3 10h-8l-3-10z', ' opacity=".9"') + lite('M44 36q4-4 8-4l-6 10z', .5) +
    pth(STONE, 'M18 80l6-8 6 8-6 6zM74 86l5-7 5 7-5 6z');
  S.elemental = ell(K, 50, 108, 18, 3, ' opacity=".35"') +
    circ('%E%', 50, 58, 34, ' opacity=".55"') + pth('%C%', 'M50 20q22 18 18 44-4 20-18 26-14-6-18-26-4-26 18-44z') + shade('M50 20q22 18 18 44-4 20-18 26z', .25) +
    pth(W, 'M50 32q12 12 10 30-2 14-10 18-8-4-10-18-2-18 10-30z', ' opacity=".35"') + circ(W, 44, 52, 3) + circ(W, 56, 52, 3) +
    pth('%C1%', 'M20 40l8-4-2 10zM80 40l-8-4 2 10zM26 84l10-8v10zM74 84l-10-8v10z', ' opacity=".8"');

  /* ── 거점 ── */
  S.st_spire = GROUND +
    pth(STONE, 'M50 2l22 36-6 62H34l-6-62z') + shade('M50 2l22 36-6 62H50z', .3) + pth('%E%', 'M50 24l12 18-4 34H42l-4-34z', ' opacity=".75"') +
    pth('%C%', 'M50 32l8 12-3 22h-10l-3-22z') + pth(K, 'M26 98h48l4 10H22z') + pth(GOLD, 'M32 58h36v4H32zM30 78h40v4H30z') + circ('%E%', 50, 10, 10, ' opacity=".8"');
  S.st_barracks = GROUND +
    pth(WOOD, 'M8 48L50 14l42 34v54H8z') + shade('M50 14l42 34v54H50z', .28) + pth(K, 'M4 50L50 12l46 38-4 6L50 22 8 56z') +
    pth(K, 'M36 66h28v36H36z') + pth('%E%', 'M40 70h20v28H40z', ' opacity=".55"') + rect(IRON, 16, 62, 12, 12, 2) + rect(IRON, 72, 62, 12, 12, 2) +
    pth('%C%', 'M44 24h12v22l-6-4-6 4z') + pth(STONE, 'M8 92h84v10H8z');
  S.st_shrine = GROUND +
    pth(STONE, 'M50 6l42 76H8z') + shade('M50 6l42 76H50z', .28) + pth('%E%', 'M50 34l24 42H26z', ' opacity=".65"') + pth('%C%', 'M50 46l14 26H36z') +
    pth(K, 'M4 82h92l3 12H1z') + pth(GOLD, 'M46 18h8v16h-8zM40 26h20v4H40z') + circ('%E%', 50, 8, 8, ' opacity=".8"');

  /* ── 주문 ── */
  function spell(inner) { return circ('%E%', 50, 60, 42, ' opacity=".28"') + inner; }
  S.sp_fire = spell(pth(FIRE, 'M50 10q24 30 24 52a24 24 0 0 1-48 0q0-22 24-52z') + pth(W, 'M50 44q12 16 12 28a12 12 0 0 1-24 0q0-12 12-28z', ' opacity=".7"') +
    pth(FIRE, 'M22 40q6 10 2 22-8-8-2-22zM78 40q-6 10-2 22 8-8 2-22z', ' opacity=".85"'));
  S.sp_bolt = spell(pth(GOLD, 'M60 6L22 62h22l-8 50 40-60H54z') + pth(W, 'M57 20L38 56h10l-3 24 20-32H52z', ' opacity=".6"'));
  S.sp_chain = spell(pth(GOLD, 'M40 6L12 54h16l-8 40 32-48H36z') + pth('%C1%', 'M78 22L54 62h14l-6 34 26-42H72z') + pth(W, 'M38 20L26 48h8l-4 18 14-24h-8z', ' opacity=".5"'));
  S.sp_heal = spell(pth('%C%', 'M50 104Q12 74 12 48a21 21 0 0 1 38-12 21 21 0 0 1 38 12q0 26-38 56z') +
    pth(W, 'M44 38h12v42H44zM29 53h42v12H29z', ' opacity=".9"') + lite('M20 46a14 14 0 0 1 14-12l-2 6q-8 2-10 8z', .5));
  S.sp_buff = spell(pth(GOLD, 'M50 6l12 36 36 12-36 12-12 36-12-36-36-12 36-12z') + circ('%C1%', 50, 54, 13) + circ(W, 46, 50, 4.5, ' opacity=".7"') +
    pth(W, 'M50 14l4 12-4 4-4-4z', ' opacity=".7"'));
  S.sp_draw = spell(rect(STEELD, 12, 28, 42, 60, 5, ' transform="rotate(-12 33 58)"') + rect('%C%', 46, 20, 42, 60, 5, ' transform="rotate(10 67 50)"') +
    pth(W, 'M52 30h28v5H52zM52 42h22v5H52zM52 54h16v5H52z', ' opacity=".6" transform="rotate(10 67 50)"') + pth(GOLD, 'M50 24h34v4H50z', ' transform="rotate(10 67 50)"'));
  S.sp_aoe = spell(circ('%C%', 50, 58, 15) + '<circle fill="none" stroke="' + GOLD + '" stroke-width="5" cx="50" cy="58" r="27" opacity=".85"/>' +
    '<circle fill="none" stroke="' + GOLD + '" stroke-width="4" cx="50" cy="58" r="40" opacity=".45"/>' + pth(W, 'M50 20l3 8h-6zM50 96l3-8h-6zM12 58l8-3v6zM88 58l-8-3v6z', ' opacity=".7"'));
  S.sp_crosshair = spell('<circle fill="none" stroke="' + STEEL + '" stroke-width="7" cx="50" cy="58" r="34"/>' +
    pth('%C1%', 'M47 12h6v28h-6zM47 76h6v28h-6zM4 55h28v6H4zM68 55h28v6H68z') + circ('%A%', 50, 58, 8) + circ(W, 50, 58, 3));
  S.sp_flare = spell(circ('%E%', 50, 34, 28, ' opacity=".9"') + circ(W, 50, 34, 12) +
    pth(GOLD, 'M50 2v12M22 12l7 10M78 12l-7 10M10 36h12M78 36h12', ' fill="none" stroke="' + GOLD + '" stroke-width="4" stroke-linecap="round"') +
    pth(GUN, 'M42 54h16l8 48H34z') + pth(W, 'M46 60h6l2 30h-8z', ' opacity=".2"'));
  S.sp_trench = spell(pth(LEATHER, 'M6 66h28v18H6zM36 66h28v18H36zM66 66h28v18H66z') + pth('%C%', 'M20 46h30v18H20zM52 46h30v18H52z') +
    pth(K, 'M4 84h92l2 10H2z') + rect(GUN, 46, 30, 8, 18, 3) + pth(STEEL, 'M42 32h16l-8-8z'));
  S.sp_horn = spell(pth(GOLD, 'M8 66q0-32 32-36l18-10-4 22q-28 2-34 30z') + circ(STEELD, 22, 76, 15) + circ(GOLD, 22, 76, 8) +
    '<path d="M76 40q14 12 0 26" fill="none" stroke="%C1%" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M88 30q22 22 0 46" fill="none" stroke="%C1%" stroke-width="4" stroke-linecap="round" opacity=".55"/>');
  S.sp_judgment = spell(pth(GOLD, 'M50 2l11 36h31l-25 20 10 36-27-22-27 22 10-36L8 38h31z') + circ('%C1%', 50, 52, 13) + circ(W, 46, 48, 4.5, ' opacity=".7"') +
    pth(W, 'M50 8l4 14-4 6-4-6z', ' opacity=".6"'));
  S.sp_teleport = spell('<ellipse fill="none" stroke="%C1%" stroke-width="7" cx="50" cy="58" rx="20" ry="46"/>' +
    '<ellipse fill="none" stroke="' + GOLD + '" stroke-width="6" cx="50" cy="58" rx="46" ry="20" opacity=".85"/>' + circ(W, 50, 58, 11, ' opacity=".9"') + circ('%A%', 50, 58, 16, ' opacity=".5" filter="url(#rgBlur1)"'));
  S.sp_pact = spell(pth(BONE, 'M20 6h46l18 18v78H20z') + shade('M66 6l18 18H66z', .4) + pth('%C%', 'M38 40l12-12 12 12-12 14z') +
    pth(K, 'M30 64h40v5H30zM30 76h28v5H30zM30 88h34v5H30z', ' opacity=".7"') + pth(FIRE, 'M62 86q6-8 6-14 6 8 2 16z', ' opacity=".9"'));
  S.sp_sacrifice = spell(pth(BONE, 'M42 98h16V60h32V44H58V6H42v38H10v16h32z') + circ('%C%', 50, 52, 15, ' opacity=".95"') + circ(W, 45, 47, 4.5, ' opacity=".6"') +
    pth(FIRE, 'M46 30q4-10 8 0-2 6-4 6t-4-6z', ' opacity=".9"'));
  S.sp_hellfire = spell(pth(FIRE, 'M22 12q16 24 16 36a16 16 0 0 1-32 0q0-12 16-36z') + pth(FIRE, 'M78 12q16 24 16 36a16 16 0 0 1-32 0q0-12 16-36z') +
    pth(FIRE, 'M50 30q22 32 22 50a22 22 0 0 1-44 0q0-18 22-50z') + pth(W, 'M50 60q10 14 10 22a10 10 0 0 1-20 0q0-8 10-22z', ' opacity=".7"'));
  S.sp_cataclysm = spell(pth(GOLD, 'M50 0l14 34 36 2-28 24 10 36-32-20-32 20 10-36L0 36l36-2z') + circ('%C%', 50, 48, 17) + circ(W, 44, 42, 5.5, ' opacity=".6"') +
    circ('%A%', 50, 48, 24, ' opacity=".4" filter="url(#rgBlur1)"'));
  S.sp_coin = spell(circ(GOLD, 50, 58, 40) + shade('M50 18a40 40 0 0 1 0 80z', .2) + circ('%C%', 50, 58, 27) +
    pth(GOLD, 'M50 36l7 15 16 2-12 11 3 16-14-8-14 8 3-16-12-11 16-2z') + '<path d="M28 42a26 26 0 0 1 18-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/>');
  S.sp_rift = spell(pth('%C%', 'M46 2q-12 30 6 56t-2 50q16-28-4-54T46 2z') + pth(W, 'M48 20q-6 20 6 40t0 36q8-24-4-44T48 20z', ' opacity=".45"') +
    circ('%A%', 24, 36, 7) + circ('%A%', 76, 74, 7) + circ(W, 78, 28, 4, ' opacity=".8"') + circ(W, 22, 82, 4, ' opacity=".8"'));
  S.sp_storm = spell(pth('%C3%', 'M8 46q14-22 42-16 24-10 42 12 10 14-6 26H14q-14-8-6-22z') + shade('M50 30q24-10 42 12 10 14-6 26H50z', .3) +
    pth(GOLD, 'M40 62L26 88h10l-6 26 20-32h-10zM66 62L54 84h9l-5 22 18-28h-9z') + pth(W, 'M20 70l4 14M78 72l4 14', ' fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".6"'));

  var NONFIG = {
    v_tank: 'tank', v_apc: 'apc', v_mgnest: 'turret', v_mortar: 'mortar', v_railgun: 'railgun', v_drone: 'drone',
    a_skiff: 'airship', a_galleon: 'galleon', a_floatstone: 'floatstone', tk_elemental: 'elemental',
    d_hound: 'hound', d_leech: 'leech', d_charger: 'charger', n_jugger: 'jugger',
    st_spire: 'st_spire', st_barracks: 'st_barracks', st_shrine: 'st_shrine',
    n_regroup: 'sp_draw', n_coin: 'sp_coin',
    v_precision: 'sp_crosshair', v_barrage: 'sp_aoe', v_flare: 'sp_flare', v_trench: 'sp_trench',
    e_sanctuary: 'sp_buff', e_judgment: 'sp_judgment', e_warhorn: 'sp_horn',
    a_bolt: 'sp_bolt', a_rift: 'sp_rift', a_chain: 'sp_chain', a_cataclysm: 'sp_cataclysm', a_stormcall: 'sp_storm',
    d_pact: 'sp_pact', d_sacrifice: 'sp_sacrifice', d_hellfire: 'sp_hellfire'
  };

  /* ═══════════════ 렌더 ═══════════════ */
  function innerRaw(cardId) {
    if (NONFIG[cardId] && S[NONFIG[cardId]]) return S[NONFIG[cardId]];
    if (FIGS[cardId]) return figure(FIGS[cardId]);
    return figure(mix(KNIGHT, { weapon: 'sword', off: 'shield' }));
  }
  function inner(cardId, fac) { return paint(innerRaw(cardId), fac || factionOf(cardId)); }

  function wrap(body, vb, cls, fac, opts) {
    opts = opts || {};
    var p = PAL[fac] || PAL.neutral;
    return '<svg class="art-svg ' + (cls || '') + '" viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow:visible">' +
      (opts.noSil ? '' : '<g class="l-sil" filter="url(#rgSil)">' + body + '</g>') +
      '<g class="l-body" filter="url(#rgInk)">' + body + '</g>' +
      (opts.noRim ? '' : '<g class="l-rim" filter="url(#' + p.rim + ')">' + body + '</g>') +
      '</svg>';
  }
  function svg(cardId, cls, fac) {
    fac = fac || factionOf(cardId);
    return wrap(inner(cardId, fac), '0 0 100 124', cls, fac);
  }

  /* ═══════════════ 진영 엠블럼 ═══════════════  viewBox 0 0 100 100 */
  var CREST = {
    vanguard:
      pth('%C3%', 'M50 4l40 14v30q0 30-40 48Q10 78 10 48V18z') + pth(GUN, 'M50 10l34 12v26q0 26-34 42Q16 74 16 48V22z') +
      pth('%C%', 'M50 16l28 10v22q0 22-28 36Q22 70 22 48V26z') +
      '<circle fill="none" stroke="' + GOLD + '" stroke-width="5" cx="50" cy="48" r="17"/>' + pth(GOLD, 'M47 22h6v14h-6zM47 60h6v14h-6zM24 45h14v6H24zM62 45h14v6H62z') +
      pth(K, 'M40 46h20v4H40z') + pth(GOLD, 'M30 84h40l-20 8z') + circ('%A%', 50, 48, 4),
    exile:
      pth('%C3%', 'M50 4l40 14v30q0 30-40 48Q10 78 10 48V18z') + pth(STEEL, 'M50 10l34 12v26q0 26-34 42Q16 74 16 48V22z') +
      pth('%C%', 'M50 16l28 10v22q0 22-28 36Q22 70 22 48V26z') +
      pth(GOLD, 'M44 22h12v18h18v12H56v22H44V52H26V40h18z') + pth(W, 'M46 24h4v16h-4z', ' opacity=".5"') +
      pth(BONE, 'M20 30q-8 14 0 30-2-16 0-30zM80 30q8 14 0 30 2-16 0-30z') + circ('%A%', 50, 46, 4),
    arcane:
      pth('%C3%', 'M50 4l40 14v30q0 30-40 48Q10 78 10 48V18z') + pth(OBSID, 'M50 10l34 12v26q0 26-34 42Q16 74 16 48V22z') +
      pth('%C%', 'M50 16l28 10v22q0 22-28 36Q22 70 22 48V26z') +
      circ('%E%', 50, 46, 24, ' opacity=".55"') + pth(GOLD, 'M50 20l6 20 20 6-20 6-6 20-6-20-20-6 20-6z') +
      pth(GOLD, 'M66 26a16 16 0 1 0 0 22 12 12 0 1 1 0-22z', ' opacity=".9"') + circ(W, 50, 46, 4),
    demon:
      pth('%C3%', 'M50 4l40 14v30q0 30-40 48Q10 78 10 48V18z') + pth(OBSID, 'M50 10l34 12v26q0 26-34 42Q16 74 16 48V22z') +
      pth('%C%', 'M50 16l28 10v22q0 22-28 36Q22 70 22 48V26z') +
      pth(BONE, 'M34 40q-10-14-6-26 8 8 12 20zM66 40q10-14 6-26-8 8-12 20z') + pth(K, 'M36 40q14-10 28 0v12q-14 10-28 0z') +
      circ('%A%', 44, 46, 3.5) + circ('%A%', 56, 46, 3.5) + pth(BONE, 'M42 56l3 6 2-5zM58 56l-3 6-2-5z') + pth(FIRE, 'M50 66q8 10 0 20-8-10 0-20z', ' opacity=".9"'),
    neutral:
      pth('%C3%', 'M50 4l40 14v30q0 30-40 48Q10 78 10 48V18z') + pth(STONE, 'M50 10l34 12v26q0 26-34 42Q16 74 16 48V22z') +
      pth('%C%', 'M50 16l28 10v22q0 22-28 36Q22 70 22 48V26z') + pth(GOLD, 'M50 24l14 22-14 22-14-22z') + circ(K, 50, 46, 4)
  };
  function crest(factionId, cls) {
    var fac = CREST[factionId] ? factionId : 'neutral';
    return wrap(paint(CREST[fac], fac), '0 0 100 100', 'crest ' + (cls || ''), fac, { noSil: true });
  }
  /* 기존 API: 메뉴의 진영 카드에는 장군 초상 대신 엠블럼을 쓰고 싶으면 crest() 를, 초상을 쓰려면 이걸 유지 */
  function factionCrest(factionId) {
    var gen = { vanguard: 'gen_volkov', exile: 'gen_arden', arcane: 'gen_selene', demon: 'gen_karnak' };
    return svg(gen[factionId] || 'gen_arden', 'crest');
  }

  /* ═══════════════ 지형 타일 ═══════════════  viewBox 0 0 100 100 (한 칸) */
  var TILE = {
    grass:   { a: '#3f8a3a', b: '#2d6a2c', c: '#5aa84a', d: '#1f4a20' },
    desert:  { a: '#c9a15f', b: '#a67f44', c: '#e2c184', d: '#7a5a2c' },
    ice:     { a: '#a9d8ef', b: '#7fb6d8', c: '#e6f7ff', d: '#4f86ad' },
    volcano: { a: '#4a3a3a', b: '#2d2222', c: '#6b4c48', d: '#ff6a2a' },
    dusk:    { a: '#4a4f7a', b: '#33375a', c: '#6a6f9c', d: '#8f6fbf' }
  };
  var tileSeedIdx = 0;
  function tile(theme, seed) {
    var t = TILE[theme] || TILE.grass; seed = (seed == null ? tileSeedIdx++ : seed) | 0;
    var r = function (n) { seed = (seed * 9301 + 49297) % 233280; return (seed / 233280) * n; };
    var s = '<svg class="tile-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none">' +
      rect(t.a, 0, 0, 100, 100, 6) + pth(t.b, 'M0 100V0h100z', ' opacity=".35"') +
      pth(t.c, 'M4 4h92v6H4z', ' opacity=".28"') + pth(t.d, 'M4 90h92v6H4z', ' opacity=".35"');
    var i, x, y;
    for (i = 0; i < 4; i++) { x = 10 + r(80); y = 10 + r(80);
      if (theme === 'ice') s += pth(t.c, 'M' + x + ' ' + y + 'l' + (6 + r(10)) + ' ' + (2 + r(4)) + ' -3 5z', ' opacity=".7"');
      else if (theme === 'volcano') s += ell(t.d, x, y, 2 + r(5), 1 + r(2), ' opacity=".55"');
      else if (theme === 'desert') s += ell(t.c, x, y, 6 + r(10), 1.5, ' opacity=".5"');
      else if (theme === 'dusk') s += circ(t.d, x, y, 1 + r(1.6), ' opacity=".7"');
      else s += pth(t.c, 'M' + x + ' ' + y + 'l3-8 2 8zM' + (x + 5) + ' ' + y + 'l2-6 2 6z', ' opacity=".6"');
    }
    return s + '<rect fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3" x="1.5" y="1.5" width="97" height="97" rx="6"/></svg>';
  }

  /* ═══════════════ 아크 (중앙 거점) ═══════════════ viewBox 0 0 100 100 */
  function ark(progress, owner) {
    var col = owner === 'p1' ? '#58a8ff' : owner === 'p2' ? '#ff6b5e' : '#5df0ff';
    var deg = Math.max(0, Math.min(1, progress || 0)) * 360;
    var big = deg > 180 ? 1 : 0, rad = (deg - 90) * Math.PI / 180;
    var ex = 50 + 40 * Math.cos(rad), ey = 50 + 40 * Math.sin(rad);
    var arc = deg > 0 ? '<path d="M50 10A40 40 0 ' + big + ' 1 ' + ex.toFixed(2) + ' ' + ey.toFixed(2) + '" fill="none" stroke="' + col + '" stroke-width="5" stroke-linecap="round"/>' : '';
    return '<svg class="ark-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow:visible">' +
      circ('url(#rgArk)', 50, 50, 46, ' opacity=".85"') +
      '<circle fill="none" stroke="#0a3550" stroke-width="5" cx="50" cy="50" r="40" opacity=".8"/>' + arc +
      pth(STONE, 'M50 14l10 16-4 24H44l-4-24z') + pth(ICE, 'M50 20l6 10-3 20h-6l-3-20z', ' opacity=".9"') +
      pth(STONE, 'M18 62l8-6 4 14-8 6zM82 62l-8-6-4 14 8 6z') + circ(W, 50, 34, 4, ' opacity=".9"') +
      pth(GOLD, 'M36 80h28l-3 6H39z') + '</svg>';
  }

  /* ═══════════════ FX ═══════════════ viewBox -50 -50 100 100 (중앙 기준) */
  var FX = {
    slash: '<path d="M-38 30Q-10-30 40-38" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>' +
           '<path d="M-38 30Q-10-30 40-38" fill="none" stroke="%A%" stroke-width="14" stroke-linecap="round" opacity=".55" filter="url(#rgSoft)"/>' +
           '<path d="M-30 36Q-6-16 36-26" fill="none" stroke="#fff" stroke-width="2.5" opacity=".7"/>',
    hit:   pth('%A%', 'M0-44l10 24 26-14-14 26 24 10-24 10 14 26-26-14L0 44l-10-24-26 14 14-26-24-10 24-10-14-26 26 14z', ' opacity=".9"') +
           pth(W, 'M0-22l6 14 14-6-6 14 14 6-14 6 6 14-14-6L0 22l-6-14-14 6 6-14-14-6 14-6-6-14 14 6z'),
    heal:  circ('%E%', 0, 0, 44, ' opacity=".7"') + pth(W, 'M-6-30h12v60H-6zM-30-6h60v12h-60z') +
           pth(W, 'M-34-34l6 8M34-34l-6 8M-34 34l6-8M34 34l-6-8', ' fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"'),
    cast:  '<circle fill="none" stroke="%A%" stroke-width="3" r="40"/><circle fill="none" stroke="%A%" stroke-width="2" r="30" opacity=".7"/>' +
           pth('%A%', 'M0-36l8 20 20 8-20 8-8 20-8-20-20-8 20-8z', ' opacity=".9"') + circ(W, 0, 0, 6) +
           pth(W, 'M0-40v6M0 34v6M-40 0h6M34 0h6', ' fill="none" stroke="#fff" stroke-width="2.5"'),
    summon: circ('%E%', 0, 10, 44, ' opacity=".8"') + ell('%A%', 0, 24, 40, 10, ' opacity=".7"') + ell(W, 0, 24, 30, 6, ' opacity=".5"') +
           pth('%C1%', 'M-16 24l6-60 10 60zM6 24l4-44 6 44z', ' opacity=".85"'),
    explode: circ(FIRE, 0, 0, 40) + pth('#ffd35a', 'M0-46l12 26 26-14-14 26 26 12-28 4 8 26-22-16-6 28-8-28-22 16 8-26-28-4 26-12-14-26 26 14z', ' opacity=".8"') +
           circ(W, 0, 0, 14, ' opacity=".9"'),
    shield: pth('%A%', 'M0-44l36 14v22q0 26-36 44-36-18-36-44v-22z', ' opacity=".35"') +
           '<path d="M0-44l36 14v22q0 26-36 44-36-18-36-44v-22z" fill="none" stroke="%AL%" stroke-width="4"/>' + pth(W, 'M-24-20l16-6v16l-16 6z', ' opacity=".35"'),
    arrow: pth(W, 'M-40 4h56v-12l24 8-24 8v-12z', ' transform="translate(0,4)"') + pth('%A%', 'M-40 0h56v-6l14 6-14 6v-6z', ' opacity=".8"')
  };
  function fx(kind, fac) {
    var body = paint(FX[kind] || FX.hit, fac || 'neutral');
    return '<svg class="fx-svg fx-' + kind + '" viewBox="-50 -50 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="overflow:visible">' + body + '</svg>';
  }

  /* ═══════════════ UI 아이콘 ═══════════════ viewBox 0 0 24 24 — currentColor */
  var IC = {
    attack:  '<path d="M4 20l6-6M6 22l-4-4M13 11l6-7 2 2-7 6zM10 14l-2-2 8-8 2 2z"/>',
    hp:      '<path d="M12 21C5 15 3 12 3 8.5 3 6 5 4 7.5 4c1.8 0 3.3 1 4.5 2.6C13.2 5 14.7 4 16.5 4 19 4 21 6 21 8.5c0 3.5-2 6.5-9 12.5z"/>',
    move:    '<path d="M12 2l4 4h-3v4h-2V6H8zM2 12l4-4v3h4v2H6v3zM22 12l-4 4v-3h-4v-2h4V8zM12 22l-4-4h3v-4h2v4h3z"/>',
    range:   '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="2.5"/><path d="M11 1h2v5h-2zM11 18h2v5h-2zM1 11h5v2H1zM18 11h5v2h-5z"/>',
    mana:    '<path d="M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z"/><path d="M12 10c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z" fill="#fff" opacity=".5"/>',
    deck:    '<rect x="6" y="2" width="14" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 6v14a2 2 0 0 0 2 2h12v-2H6V6z"/><path d="M10 6h6v2h-6zM10 10h4v2h-4z"/>',
    endturn: '<path d="M5 4l14 8-14 8z"/>',
    build:   '<path d="M3 21v-9l9-8 9 8v9h-6v-6h-6v6z"/>',
    swap:    '<path d="M7 7h10l-3-3 1.5-1.5L21 8l-5.5 5.5L14 12l3-3H7zM17 17H7l3 3-1.5 1.5L3 16l5.5-5.5L10 12l-3 3h10z"/>',
    sound:   '<path d="M3 9v6h4l5 4V5L7 9zM16 8a5 5 0 0 1 0 8M18.5 5.5a8.5 8.5 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M3 9v6h4l5 4V5L7 9z"/>',
    music:   '<path d="M9 18a3 3 0 1 1-2-2.8V5l12-2v12a3 3 0 1 1-2-2.8V7L9 8.5z"/>',
    menu:    '<path d="M3 5h18v3H3zM3 10.5h18v3H3zM3 16h18v3H3z"/>',
    codex:   '<path d="M4 3h7v18H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM13 3h7a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-7z"/><path d="M5.5 6h4v1.5h-4zM14.5 6h4v1.5h-4z" fill="#000" opacity=".35"/>',
    close:   '<path d="M5 3.5L20.5 19 19 20.5 3.5 5zM19 3.5L20.5 5 5 20.5 3.5 19z"/>',
    power:   '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    ark:     '<path d="M12 2l5 8-2 12H9L7 10z"/><path d="M12 6l2 4-1 8h-2l-1-8z" fill="#fff" opacity=".45"/>',
    turn:    '<path d="M12 3a9 9 0 1 1-9 9h2.5A6.5 6.5 0 1 0 12 5.5V9l-5-4 5-4z"/>',
    /* 키워드 */
    kw_charge:  '<path d="M3 12l9-9 2 2-5 5h12v4H9l5 5-2 2z"/>',
    kw_provoke: '<path d="M12 2l9 4v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="M11 7h2v6h-2zM11 15h2v2h-2z" fill="#000" opacity=".5"/>',
    kw_flying:  '<path d="M12 4c-3 5-9 5-10 9 4-1 6 0 8 3 1-3 1-6 2-8 1 2 1 5 2 8 2-3 4-4 8-3-1-4-7-4-10-9z"/>',
    kw_first:   '<path d="M12 2l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/>',
    kw_bulwark: '<path d="M4 4h16v16H4zM6 6v4h5V6zm7 0v4h5V6zM6 12v6h5v-6zm7 0v6h5v-6z" fill-rule="evenodd"/>',
    kw_leap:    '<path d="M6 20h12v2H6zM8 18l2-8 4-4 3 1-3 4 1 7z"/>'
  };
  function icon(name, size) {
    return '<svg class="ic ic-' + name + '" viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + (IC[name] || IC.attack) + '</svg>';
  }

  /* ═══════════════ 로고 ═══════════════ viewBox 0 0 640 160 */
  function logo(sub) {
    return '<svg class="logo-svg" viewBox="0 0 640 160" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="RUNEGUARD" style="overflow:visible">' +
      '<defs><linearGradient id="lgGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5cf"/><stop offset=".45" stop-color="#f3c452"/><stop offset=".55" stop-color="#b9821a"/><stop offset="1" stop-color="#f7d77a"/></linearGradient>' +
      '<filter id="lgGlow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="6"/></filter></defs>' +
      '<path d="M320 8l22 26-22 26-22-26z" fill="#5df0ff" opacity=".5" filter="url(#lgGlow)"/>' +
      '<path d="M40 128L320 118l280 10" fill="none" stroke="#f3c452" stroke-width="2" opacity=".5"/>' +
      '<text x="320" y="104" text-anchor="middle" font-family="Cinzel, Georgia, \'Noto Serif KR\', serif" font-weight="800" font-size="88" letter-spacing="14" fill="#0a0d17" stroke="#0a0d17" stroke-width="10" stroke-linejoin="round">RUNEGUARD</text>' +
      '<text x="320" y="104" text-anchor="middle" font-family="Cinzel, Georgia, \'Noto Serif KR\', serif" font-weight="800" font-size="88" letter-spacing="14" fill="url(#lgGold)">RUNEGUARD</text>' +
      '<path d="M320 14l16 20-16 20-16-20z" fill="#e9fdff"/><path d="M320 20l10 14-10 14-10-14z" fill="#5df0ff"/>' +
      (sub ? '<text x="320" y="146" text-anchor="middle" font-family="\'Noto Sans KR\', system-ui, sans-serif" font-size="18" letter-spacing="6" fill="#cfd6e6" opacity=".85">' + sub + '</text>' : '') +
      '</svg>';
  }

  /* ═══════════════ 카드 프레임 (배경 장식) ═══════════════ viewBox 0 0 200 280 */
  function frame(fac, rare) {
    var p = PAL[fac] || PAL.neutral;
    return '<svg class="frame-svg" viewBox="0 0 200 280" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="none">' +
      '<rect x="3" y="3" width="194" height="274" rx="12" fill="#0f1320"/>' +
      '<rect x="3" y="3" width="194" height="150" rx="12" fill="' + p.c3 + '" opacity=".55"/>' +
      circ(paint('%E%', fac), 100, 96, 90, ' opacity=".28"') +
      '<rect x="3" y="3" width="194" height="274" rx="12" fill="none" stroke="' + (rare ? '#f3c452' : p.c2) + '" stroke-width="3"/>' +
      '<path d="M3 150h194" stroke="' + p.a + '" stroke-width="1.5" opacity=".6"/>' +
      pth(p.a, 'M100 144l8 6-8 6-8-6z') + '</svg>';
  }

  /* ═══════════════ 이미지 에셋 파이프라인 (유지) ═══════════════ */
  var imgKnown = {};
  function attachImg(host, id, kind) {
    /* v0.13: 유닛 아트는 새 SVG 로 통일 — PNG 는 배경(scenes)에만 쓴다.
       옛 PNG 유닛으로 되돌리려면 아래 한 줄을 지우면 된다. */
    if ((kind || 'units') !== 'scenes') return;
    if (!global.Image || !host) return;
    var src = 'assets/' + (kind || 'units') + '/' + id + '.png';
    if (imgKnown[src] === 'missing') return;
    var img = global.document.createElement('img');
    img.className = 'art-img'; img.alt = ''; img.draggable = false;
    img.onload = function () { imgKnown[src] = 'ok'; host.classList.add('has-img'); };
    img.onerror = function () { imgKnown[src] = 'missing'; img.remove(); };
    img.src = src; host.appendChild(img);
  }

  RG.Art = {
    svg: svg, inner: inner, factionCrest: factionCrest, crest: crest,
    tile: tile, ark: ark, fx: fx, icon: icon, logo: logo, frame: frame,
    attachImg: attachImg, injectDefs: injectDefs, DEFS: DEFS,
    PAL: PAL, factionOf: factionOf, paint: paint,
    PARTS: P, FIGS: FIGS, SYMBOLS: S, NONFIG: NONFIG, FX: FX, ICONS: IC, figure: figure
  };
})(typeof window !== 'undefined' ? window : global);

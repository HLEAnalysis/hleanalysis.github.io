/* RUNEGUARD — SVG 아트 라이브러리 v0.3
   외부 이미지 없이 코드로 그린다.

   v0.2 는 "칼 아이콘 / 방패 아이콘"이라 캐릭터로 읽히지 않았다.
   v0.3 은 부위 조립식 캐릭터로 다시 그린다:
     다리 → 몸통 → 팔 → 어깨 → 머리 → 무기 → 망토/날개
   색도 단색 틴트를 버리고 강철·가죽·황금·피부 재질 팔레트를 쓴다.
   진영 색(--accent)은 천·문장·에너지에만 들어간다.

   좌표계: 0 0 100 124  (발끝 y≈108, 지면 y≈116) */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};

  /* ═══════════════ 재질 그라디언트 / 필터 ═══════════════ */
  var DEFS =
    '<svg id="rg-defs" width="0" height="0" aria-hidden="true" ' +
    'style="position:absolute;width:0;height:0;overflow:hidden"><defs>' +

      '<linearGradient id="mSteel" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#e8eef8"/><stop offset="38%" stop-color="#9aa8c2"/>' +
        '<stop offset="70%" stop-color="#5d6a86"/><stop offset="100%" stop-color="#38425a"/>' +
      '</linearGradient>' +
      '<linearGradient id="mSteelD" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#8b98b2"/><stop offset="55%" stop-color="#4b5670"/>' +
        '<stop offset="100%" stop-color="#262d40"/>' +
      '</linearGradient>' +
      '<linearGradient id="mGold" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0%" stop-color="#fff3c8"/><stop offset="40%" stop-color="#e3b955"/>' +
        '<stop offset="100%" stop-color="#8a6620"/>' +
      '</linearGradient>' +
      '<linearGradient id="mLeather" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#96694025"/><stop offset="0%" stop-color="#9b6d43"/>' +
        '<stop offset="100%" stop-color="#452e1c"/>' +
      '</linearGradient>' +
      '<linearGradient id="mSkin" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#e8bb96"/><stop offset="100%" stop-color="#9c7250"/>' +
      '</linearGradient>' +
      '<linearGradient id="mBone" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#f2ecd8"/><stop offset="100%" stop-color="#a2977a"/>' +
      '</linearGradient>' +
      '<linearGradient id="mIron" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#6d7688"/><stop offset="100%" stop-color="#2c3242"/>' +
      '</linearGradient>' +
      '<linearGradient id="mWood" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#8a6136"/><stop offset="100%" stop-color="#4a341c"/>' +
      '</linearGradient>' +
      '<linearGradient id="mStone" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0%" stop-color="#9aa3b4"/><stop offset="100%" stop-color="#434b60"/>' +
      '</linearGradient>' +

      '<radialGradient id="rgGround" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#000" stop-opacity=".62"/>' +
        '<stop offset="100%" stop-color="#000" stop-opacity="0"/>' +
      '</radialGradient>' +
      '<radialGradient id="rgHalo" cx="50%" cy="50%" r="50%">' +
        '<stop offset="0%" stop-color="#fff" stop-opacity=".5"/>' +
        '<stop offset="100%" stop-color="#fff" stop-opacity="0"/>' +
      '</radialGradient>' +
    '</defs></svg>';

  var defsInjected = false;
  function injectDefs(doc) {
    doc = doc || global.document;
    if (!doc || defsInjected || doc.getElementById('rg-defs')) return;
    var host = doc.createElement('div');
    host.innerHTML = DEFS;
    doc.body.insertBefore(host.firstChild, doc.body.firstChild);
    defsInjected = true;
  }

  /* ═══════════════ 부위 라이브러리 ═══════════════
     클래스 규약
       f-steel / f-steelD / f-gold / f-leather / f-skin / f-bone / f-iron / f-wood / f-stone
       f-cloth  = 진영색      f-glow = 진영색 발광
       f-shade  = 검은 음영    f-lite = 흰 하이라이트    f-dark = 틈새/윤곽 */
  var P = {};

  /* ── 다리 ── */
  P.legsPlate =
    '<path class="f-steelD" d="M39 74h10l-2 30H37z"/>' +
    '<path class="f-steel"  d="M51 74h10l2 30H53z"/>' +
    '<rect class="f-leather" x="32" y="101" width="18" height="9" rx="3.5"/>' +
    '<rect class="f-leather" x="50" y="101" width="18" height="9" rx="3.5"/>' +
    '<path class="f-shade" d="M32 106h36v4H32z" opacity=".35"/>';

  P.legsLight =
    '<path class="f-leather" d="M40 74h9l-2 28h-9z"/>' +
    '<path class="f-leather" d="M51 74h9l2 28h-9z"/>' +
    '<rect class="f-dark" x="34" y="100" width="16" height="9" rx="3.5"/>' +
    '<rect class="f-dark" x="50" y="100" width="16" height="9" rx="3.5"/>';

  P.robeSkirt =
    '<path class="f-cloth" d="M36 68q14-5 28 0l8 40H28z"/>' +
    '<path class="f-shade" d="M50 68q7 0 14 2l8 38H50z" opacity=".3"/>' +
    '<path class="f-dark" d="M28 104h44l1 6H27z"/>';

  P.legsHulk =
    '<path class="f-steelD" d="M34 72h14l-3 32H31z"/>' +
    '<path class="f-steel"  d="M52 72h14l3 32H55z"/>' +
    '<rect class="f-dark" x="26" y="100" width="22" height="11" rx="4"/>' +
    '<rect class="f-dark" x="52" y="100" width="22" height="11" rx="4"/>';

  /* ── 몸통 ── */
  P.bodyPlate =
    '<path class="f-steel" d="M33 46q17-7 34 0l-4 32q-13 6-26 0z"/>' +
    '<path class="f-shade" d="M50 42q9 1 17 4l-4 32q-6 3-13 4z" opacity=".26"/>' +
    '<path class="f-lite" d="M38 48q6-3 12-3v9q-7 0-12 2z" opacity=".3"/>' +
    '<path class="f-cloth" d="M46 44h8l-1 34h-6z"/>' +
    '<rect class="f-leather" x="35" y="70" width="30" height="8" rx="3"/>' +
    '<circle class="f-gold" cx="50" cy="74" r="4.2"/>';

  P.bodyTunic =
    '<path class="f-cloth" d="M35 47q15-6 30 0l-3 26q-12 5-24 0z"/>' +
    '<path class="f-shade" d="M50 43q8 1 15 4l-3 26q-6 2-12 3z" opacity=".28"/>' +
    '<path class="f-leather" d="M40 46l10 8 10-8 3 4-13 10-13-10z"/>' +
    '<rect class="f-leather" x="36" y="68" width="28" height="7" rx="3"/>';

  P.bodyRobe =
    '<path class="f-cloth" d="M34 46q16-6 32 0l-2 24q-14 5-28 0z"/>' +
    '<path class="f-shade" d="M50 42q9 1 16 4l-2 24q-7 2-14 3z" opacity=".3"/>' +
    '<path class="f-gold" d="M47 44h6l-1 28h-4z"/>';

  P.bodyCoat =
    '<path class="f-iron" d="M34 46q16-6 32 0l-3 30q-13 5-26 0z"/>' +
    '<path class="f-shade" d="M50 42q9 1 16 4l-3 30q-6 2-13 3z" opacity=".3"/>' +
    '<path class="f-cloth" d="M46 44h8v32h-8z" opacity=".85"/>' +
    '<rect class="f-leather" x="34" y="60" width="32" height="6" rx="2"/>' +
    '<rect class="f-leather" x="44" y="46" width="12" height="5" rx="2"/>';

  P.bodyHulk =
    '<path class="f-steel" d="M28 46q22-9 44 0l-6 30q-16 6-32 0z"/>' +
    '<path class="f-shade" d="M50 40q12 1 22 6l-6 30q-8 3-16 4z" opacity=".28"/>' +
    '<path class="f-glow" d="M44 52h12l-2 20h-8z"/>';

  /* ── 팔 / 어깨 ── */
  P.armsPlate =
    '<path class="f-steelD" d="M25 55h9l3 22-9 2z"/>' +
    '<path class="f-steel"  d="M66 55h9l-3 24-9-2z"/>' +
    '<circle class="f-steel"  cx="31" cy="50" r="11"/>' +
    '<circle class="f-steelD" cx="69" cy="50" r="11"/>' +
    '<path class="f-cloth" d="M22 48a11 11 0 0 1 18 0z" opacity=".9"/>' +
    '<path class="f-cloth" d="M60 48a11 11 0 0 1 18 0z" opacity=".7"/>';

  P.armsLight =
    '<path class="f-cloth" d="M27 52h8l3 22-8 2z"/>' +
    '<path class="f-cloth" d="M65 52h8l-3 24-8-2z"/>' +
    '<circle class="f-leather" cx="32" cy="50" r="7"/>' +
    '<circle class="f-leather" cx="68" cy="50" r="7"/>';

  P.armsHulk =
    '<path class="f-steelD" d="M18 54h11l4 26-11 3z"/>' +
    '<path class="f-steel"  d="M71 54h11l-4 28-11-3z"/>' +
    '<circle class="f-steel"  cx="26" cy="50" r="13"/>' +
    '<circle class="f-steelD" cx="74" cy="50" r="13"/>' +
    '<path class="f-dark" d="M18 44l6-8 5 9zM82 44l-6-8-5 9z"/>';

  /* ── 머리 ── */
  P.headKnight =
    '<rect class="f-dark" x="45" y="34" width="10" height="10" rx="3"/>' +
    '<path class="f-steel" d="M36 30q14-16 28 0v10q-14 7-28 0z"/>' +
    '<path class="f-dark" d="M38 32h24v5H38z"/>' +
    '<path class="f-glow" d="M40 33h8v3h-8zM52 33h8v3h-8z"/>' +
    '<path class="f-cloth" d="M50 8q7 8 3 16-3 4-3 4-1-10-4-14z"/>' +
    '<path class="f-gold" d="M36 40h28v3H36z"/>';

  P.headGreat =
    '<rect class="f-dark" x="45" y="34" width="10" height="10" rx="3"/>' +
    '<path class="f-steel" d="M35 28q15-18 30 0v14q-15 8-30 0z"/>' +
    '<path class="f-dark" d="M40 33h20v4H40z"/>' +
    '<path class="f-glow" d="M42 34h5v2h-5zM53 34h5v2h-5z"/>' +
    '<path class="f-steelD" d="M48 26h4v18h-4z"/>' +
    '<path class="f-gold" d="M35 42h30v3H35z"/>';

  P.headModern =
    '<rect class="f-skin" x="44" y="32" width="12" height="12" rx="4"/>' +
    '<path class="f-iron" d="M35 30q15-15 30 0v6q-15 5-30 0z"/>' +
    '<path class="f-dark" d="M37 34h26v4H37z"/>' +
    '<rect class="f-glow" x="56" y="26" width="10" height="5" rx="2"/>' +
    '<path class="f-dark" d="M42 40h16v5H42z"/>';

  P.headCap =
    '<rect class="f-skin" x="44" y="32" width="12" height="12" rx="4"/>' +
    '<path class="f-iron" d="M36 32q14-12 28 0z"/>' +
    '<rect class="f-dark" x="34" y="31" width="32" height="4" rx="2"/>' +
    '<circle class="f-gold" cx="50" cy="26" r="3"/>';

  P.headHood =
    '<path class="f-cloth" d="M34 42q0-26 16-30 16 4 16 30-16 8-32 0z"/>' +
    '<path class="f-shade" d="M50 12q16 4 16 30-8 4-16 5z" opacity=".3"/>' +
    '<ellipse class="f-dark" cx="50" cy="34" rx="11" ry="9"/>' +
    '<circle class="f-glow" cx="45" cy="34" r="2.4"/><circle class="f-glow" cx="55" cy="34" r="2.4"/>';

  P.headHorned =
    '<path class="f-skin" d="M36 30q14-14 28 0v10q-14 8-28 0z"/>' +
    '<path class="f-bone" d="M34 28q-8-12-16-16 4 14 12 22zM66 28q8-12 16-16-4 14-12 22z"/>' +
    '<circle class="f-glow" cx="43" cy="32" r="3.4"/><circle class="f-glow" cx="57" cy="32" r="3.4"/>' +
    '<path class="f-dark" d="M43 41l7 5 7-5-3 6h-8z"/>';

  P.headSkull =
    '<path class="f-bone" d="M36 28q14-15 28 0v8q0 7-6 10l-1 6h-14l-1-6q-6-3-6-10z"/>' +
    '<circle class="f-dark" cx="43" cy="32" r="4.6"/><circle class="f-dark" cx="57" cy="32" r="4.6"/>' +
    '<circle class="f-glow" cx="43" cy="32" r="2"/><circle class="f-glow" cx="57" cy="32" r="2"/>' +
    '<path class="f-dark" d="M47 40h6l-3 5z"/>';

  P.headCrown =
    '<rect class="f-dark" x="45" y="34" width="10" height="10" rx="3"/>' +
    '<path class="f-steel" d="M37 30q13-14 26 0v10q-13 7-26 0z"/>' +
    '<path class="f-dark" d="M39 33h22v4H39z"/>' +
    '<path class="f-gold" d="M32 26l3-16 6 9 9-13 9 13 6-9 3 16z"/>' +
    '<circle class="f-cloth" cx="50" cy="18" r="3.4"/>';

  P.headBare =
    '<circle class="f-skin" cx="50" cy="34" r="11"/>' +
    '<path class="f-leather" d="M39 30q11-10 22 0z"/>' +
    '<circle class="f-dark" cx="45" cy="34" r="1.8"/><circle class="f-dark" cx="55" cy="34" r="1.8"/>';

  P.headGem =
    '<path class="f-stone" d="M38 26h24v18H38z"/>' +
    '<path class="f-glow" d="M50 28l9 8-9 8-9-8z"/>' +
    '<path class="f-lite" d="M50 30l5 5-5 4-5-4z" opacity=".5"/>';

  /* ── 무기 (오른손, 화면 우측) ── */
  P.wSword =
    '<path class="f-steel" d="M76 56h7l-1-40-2.5-6-3.5 6z"/>' +
    '<path class="f-lite" d="M78 52h2V18h-2z" opacity=".55"/>' +
    '<rect class="f-gold" x="70" y="55" width="19" height="5" rx="2.4"/>' +
    '<rect class="f-leather" x="76" y="60" width="7" height="13" rx="2.6"/>' +
    '<circle class="f-gold" cx="79.5" cy="75" r="4"/>';

  P.wGreatsword =
    '<path class="f-steel" d="M74 52h12l-2-42-4-8-4 8z"/>' +
    '<path class="f-lite" d="M78 48h3V12h-3z" opacity=".5"/>' +
    '<rect class="f-gold" x="66" y="51" width="28" height="6" rx="3"/>' +
    '<rect class="f-leather" x="76" y="57" width="8" height="16" rx="3"/>' +
    '<circle class="f-gold" cx="80" cy="76" r="4.6"/>';

  P.wSpear =
    '<rect class="f-wood" x="77" y="18" width="5" height="60" rx="2"/>' +
    '<path class="f-steel" d="M79.5 2l7 16h-14z"/>' +
    '<path class="f-gold" d="M72 18h15v4H72z"/>';

  P.wAxe =
    '<rect class="f-wood" x="77" y="22" width="5" height="54" rx="2"/>' +
    '<path class="f-steel" d="M79 20q16-10 20 6-12 10-20 2z"/>' +
    '<path class="f-shade" d="M83 24q10-4 14 4-8 5-14 1z" opacity=".28"/>';

  P.wHammer =
    '<rect class="f-wood" x="77" y="30" width="5" height="46" rx="2"/>' +
    '<rect class="f-steel" x="68" y="14" width="24" height="18" rx="4"/>' +
    '<path class="f-gold" d="M68 20h24v4H68z"/>';

  P.wStaff =
    '<rect class="f-wood" x="77" y="26" width="5" height="54" rx="2.4"/>' +
    '<circle class="f-glow" cx="79.5" cy="18" r="11" opacity=".45"/>' +
    '<circle class="f-cloth" cx="79.5" cy="18" r="7"/>' +
    '<circle class="f-lite" cx="77" cy="15.5" r="2.4" opacity=".7"/>';

  P.wRifle =
    '<rect class="f-iron" x="60" y="52" width="34" height="6" rx="2"/>' +
    '<rect class="f-dark" x="88" y="53" width="12" height="3.4" rx="1.6"/>' +
    '<path class="f-wood" d="M62 58h12l-4 14h-8z"/>' +
    '<rect class="f-dark" x="70" y="46" width="9" height="7" rx="2"/>' +
    '<rect class="f-iron" x="74" y="58" width="6" height="9" rx="2"/>';

  P.wSniper =
    '<rect class="f-iron" x="56" y="52" width="44" height="5" rx="2"/>' +
    '<rect class="f-dark" x="70" y="43" width="20" height="6" rx="3"/>' +
    '<circle class="f-glow" cx="90" cy="46" r="3"/>' +
    '<path class="f-wood" d="M58 57h12l-4 15h-8z"/>' +
    '<rect class="f-dark" x="60" y="46" width="8" height="6" rx="2"/>';

  P.wWrench =
    '<rect class="f-iron" x="76" y="34" width="6" height="40" rx="2.4"/>' +
    '<path class="f-steel" d="M74 34q5-12 12 0-3 5-6 5t-6-5z"/>' +
    '<circle class="f-dark" cx="79" cy="31" r="3.2"/>';

  P.wClaws =
    '<path class="f-bone" d="M70 54q10 6 14 20l-5 2q-4-13-11-18z"/>' +
    '<path class="f-bone" d="M76 50q11 5 16 18l-5 2q-5-12-13-16z"/>' +
    '<path class="f-bone" d="M82 46q11 4 17 15l-5 3q-6-10-14-13z"/>';

  P.wBanner =
    '<rect class="f-wood" x="77" y="12" width="5" height="66" rx="2"/>' +
    '<path class="f-cloth" d="M56 16h22v26L68 34l-12 8z"/>' +
    '<path class="f-shade" d="M67 16h11v26l-10-8z" opacity=".25"/>' +
    '<circle class="f-gold" cx="79.5" cy="9" r="4.4"/>';

  P.wBow =
    '<path class="f-wood" d="M70 16q18 22 0 60" fill="none" stroke-width="6"/>' +
    '<path class="f-dark" d="M70 16v60" fill="none" stroke-width="2"/>' +
    '<path class="f-steel" d="M58 44h32l-6-4v8z"/>';

  P.wNone = '';

  /* ── 왼손 ── */
  P.oShield =
    '<path class="f-steel" d="M8 48l18-6 18 6v18q0 14-18 22Q8 80 8 66z" transform="translate(4,0)"/>' +
    '<path class="f-cloth" d="M18 52l12-4 12 4v13q0 9-12 15-12-6-12-15z"/>' +
    '<path class="f-gold" d="M30 54l3 7h7l-6 5 2 8-6-4-6 4 2-8-6-5h7z"/>';

  P.oTowerShield =
    '<path class="f-steelD" d="M8 36h26v46q0 10-13 16Q8 92 8 82z"/>' +
    '<path class="f-cloth" d="M13 42h16v38q0 6-8 10-8-4-8-10z"/>' +
    '<path class="f-gold" d="M19 48h4v34h-4zM12 60h18v4H12z"/>';

  P.oOrb =
    '<circle class="f-glow" cx="22" cy="60" r="15" opacity=".45"/>' +
    '<circle class="f-cloth" cx="22" cy="60" r="10"/>' +
    '<circle class="f-lite" cx="19" cy="57" r="3.2" opacity=".7"/>';

  P.oMedkit =
    '<rect class="f-dark" x="10" y="52" width="26" height="20" rx="4"/>' +
    '<rect class="f-lite" x="20" y="55" width="6" height="14" rx="2"/>' +
    '<rect class="f-lite" x="14" y="59" width="18" height="6" rx="2"/>';

  P.oSack =
    '<path class="f-leather" d="M14 54q10-8 20 0l4 20q-14 6-28 0z"/>' +
    '<path class="f-dark" d="M20 50h10l2 6H18z"/>' +
    '<circle class="f-gold" cx="24" cy="66" r="3"/>';

  P.oHourglass =
    '<path class="f-gold" d="M12 48h24v4H12zM12 76h24v4H12z"/>' +
    '<path class="f-cloth" d="M16 52h16l-8 12 8 12H16l8-12z"/>' +
    '<path class="f-lite" d="M20 54h8l-4 6z" opacity=".55"/>';

  P.oNone = '';

  /* ── 등 (망토 / 날개) ── */
  P.bCloak =
    '<path class="f-cloth" d="M32 44q-14 26-10 60l28-8 28 8q4-34-10-60z" opacity=".92"/>' +
    '<path class="f-shade" d="M50 40q10 2 18 6 4 30 0 52l-18-6z" opacity=".32"/>';

  P.bWings =
    '<path class="f-cloth" d="M36 40Q6 22-4 48q20-4 28 12 2-12 12-20z" opacity=".9"/>' +
    '<path class="f-cloth" d="M64 40Q94 22 104 48q-20-4-28 12-2-12-12-20z" opacity=".7"/>' +
    '<path class="f-shade" d="M64 40q18-10 30 0-12 2-20 12z" opacity=".25"/>';

  P.bBoneWings =
    '<path class="f-bone" d="M36 40Q8 20 0 46q6-6 12-2 4 4 6 12 4-10 18-16z"/>' +
    '<path class="f-bone" d="M64 40Q92 20 100 46q-6-6-12-2-4 4-6 12-4-10-18-16z"/>';

  P.bNone = '';

  /* ── 바닥 그림자 ── */
  var GROUND = '<ellipse class="l-shadow" cx="50" cy="116" rx="27" ry="5.5"/>';

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

  /* 자주 쓰는 조합 */
  var KNIGHT  = { legs: 'legsPlate', body: 'bodyPlate', arms: 'armsPlate', head: 'headKnight' };
  var SOLDIER = { legs: 'legsLight', body: 'bodyCoat',  arms: 'armsLight', head: 'headModern' };
  var LIGHT   = { legs: 'legsLight', body: 'bodyTunic', arms: 'armsLight', head: 'headBare' };
  var MAGE    = { legs: 'robeSkirt', body: 'bodyRobe',  arms: 'armsLight', head: 'headHood' };
  var FIEND   = { legs: 'legsHulk',  body: 'bodyHulk',  arms: 'armsHulk',  head: 'headHorned' };

  function mix(base, over) {
    var o = {}; var k;
    for (k in base) o[k] = base[k];
    for (k in over) o[k] = over[k];
    return o;
  }

  /* ═══════════════ 카드별 조합 ═══════════════ */
  var FIGS = {
    /* 중립 */
    n_scout:   mix(LIGHT,  { head: 'headHood', weapon: 'sword', back: 'cloak' }),
    n_bulwark: mix(KNIGHT, { head: 'headGreat', off: 'towerShield' }),
    n_merc:    mix(KNIGHT, { weapon: 'sword', off: 'shield' }),
    n_medic:   mix(SOLDIER,{ head: 'headCap', off: 'medkit' }),
    n_looter:  mix(LIGHT,  { head: 'headHood', weapon: 'axe', off: 'sack' }),
    n_falcon:  mix(LIGHT,  { head: 'headCap', weapon: 'bow' }),
    n_apoth:   mix(LIGHT,  { head: 'headHood', off: 'medkit' }),
    n_pathfinder: mix(LIGHT, { head: 'headCap', weapon: 'sword', back: 'cloak' }),
    v_flamer:  mix(SOLDIER, { head: 'headModern', weapon: 'rifle' }),
    v_marksman: mix(SOLDIER, { head: 'headCap', weapon: 'rifle' }),
    e_chaplain: mix(MAGE,   { head: 'headHood', off: 'shield' }),
    e_crusader: mix(KNIGHT, { weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_seraph:  mix(KNIGHT,  { head: 'headBare', weapon: 'sword' }),
    a_adept:   mix(MAGE,    { head: 'headBare', weapon: 'staff' }),
    a_phase:   mix(MAGE,    { head: 'headHood', back: 'cloak' }),
    a_storm:   mix(MAGE,    { weapon: 'staff' }),
    d_gate:    mix(FIEND,   { head: 'headHorned', weapon: 'axe' }),
    n_golem:   mix(FIEND,  { body: 'bodyHulk', head: 'headGem', arms: 'armsHulk' }),
    n_warlord: mix(KNIGHT, { head: 'headCrown', weapon: 'banner', back: 'cloak' }),

    /* 밴가드 */
    v_rifleman: mix(SOLDIER, { weapon: 'rifle' }),
    v_sapper:   mix(SOLDIER, { head: 'headCap', weapon: 'wrench' }),
    v_sniper:   mix(SOLDIER, { weapon: 'sniper' }),
    v_shock:    mix(SOLDIER, { weapon: 'rifle', back: 'cloak' }),

    /* 엑자일 */
    e_squire:      mix(KNIGHT, { legs: 'legsLight', body: 'bodyTunic', arms: 'armsLight', weapon: 'sword' }),
    e_shield:      mix(KNIGHT, { head: 'headGreat', off: 'towerShield' }),
    e_retainer:    mix(LIGHT,  { weapon: 'spear' }),
    e_templar:     mix(KNIGHT, { weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_lancer:      mix(KNIGHT, { weapon: 'spear', off: 'shield' }),
    e_gale:        mix(KNIGHT, { weapon: 'spear', back: 'cloak', head: 'headKnight' }),
    e_paladin:     mix(KNIGHT, { head: 'headGreat', weapon: 'hammer', off: 'towerShield', back: 'cloak' }),
    e_marshal:     mix(KNIGHT, { head: 'headCrown', weapon: 'sword', off: 'shield', back: 'cloak' }),
    e_grandmaster: mix(KNIGHT, { head: 'headCrown', weapon: 'greatsword', back: 'cloak' }),

    /* 아케인 */
    a_apprentice:  mix(MAGE, { weapon: 'staff' }),
    a_elementalist:mix(MAGE, { weapon: 'staff', off: 'orb' }),
    a_chrono:      mix(MAGE, { off: 'hourglass' }),
    a_guard:       mix(MAGE, { head: 'headGreat', off: 'towerShield', back: 'wings' }),
    a_sage:        mix(MAGE, { weapon: 'staff', off: 'orb', back: 'cloak' }),

    /* 데몬 */
    d_imp:       mix(FIEND, { legs: 'legsLight', arms: 'armsLight', body: 'bodyTunic', weapon: 'claws' }),
    d_tormentor: mix(FIEND, { weapon: 'claws' }),
    d_ravager:   mix(FIEND, { weapon: 'axe' }),
    d_soul:      mix(FIEND, { head: 'headSkull', weapon: 'claws', back: 'cloak' }),
    d_bones:     mix(MAGE,  { head: 'headSkull', weapon: 'staff' }),
    d_abyss:     mix(FIEND, { off: 'towerShield' }),
    d_riftlord:  mix(FIEND, { weapon: 'greatsword', back: 'cloak' }),
    d_valgar:    mix(FIEND, { weapon: 'greatsword', back: 'boneWings' }),

    /* 신규 (v0.6) */
    v_grenadier: mix(SOLDIER, { head: 'headCap', weapon: 'rifle', back: 'cloak' }),
    e_banneret: mix(KNIGHT, { weapon: 'banner' }),
    e_vindicator: mix(KNIGHT, { weapon: 'greatsword' }),
    a_archivist: mix(MAGE, { off: 'orb', back: 'cloak' }),
    d_glutton: mix(FIEND, { head: 'headSkull', weapon: 'claws' }),
    d_warfiend: mix(FIEND, { weapon: 'axe', back: 'cloak' }),
    n_duelist: mix(LIGHT, { weapon: 'sword', back: 'cloak' }),
    n_windrider: mix(LIGHT, { weapon: 'spear', back: 'wings' }),

    /* 토큰 */
    tk_soldier: mix(SOLDIER, { weapon: 'rifle' }),

    /* 장군 — 더 화려하게 */
    gen_volkov: mix(SOLDIER, { head: 'headCap', weapon: 'rifle', off: 'none', back: 'cloak',
      extra: '<path class="f-gold" d="M40 50h6v4h-6zM40 57h6v4h-6z"/>' }),
    gen_arden:  mix(KNIGHT,  { head: 'headCrown', weapon: 'greatsword', off: 'shield', back: 'cloak' }),
    gen_selene: mix(MAGE,    { weapon: 'staff', off: 'orb', back: 'cloak',
      extra: '<circle class="f-glow" cx="50" cy="30" r="24" opacity=".22"/>' +
             '<path class="f-gold" d="M62 6a18 18 0 1 0 0 30 14 14 0 1 1 0-30z"/>' }),
    gen_karnak: mix(FIEND,   { weapon: 'greatsword', back: 'boneWings',
      extra: '<circle class="f-glow" cx="50" cy="58" r="26" opacity=".18"/>' })
  };

  /* ═══════════════ 비인간형 (탈것 · 건물 · 주문) ═══════════════ */
  var S = {};

  S.tank =
    GROUND +
    '<rect class="f-dark" x="8" y="80" width="84" height="22" rx="11"/>' +
    '<circle class="f-iron" cx="24" cy="91" r="8"/><circle class="f-iron" cx="50" cy="91" r="8"/>' +
    '<circle class="f-iron" cx="76" cy="91" r="8"/>' +
    '<path class="f-steelD" d="M12 62h76l6 18H6z"/>' +
    '<path class="f-steel" d="M28 40h44l6 20H22z"/>' +
    '<path class="f-lite" d="M32 43h18l-3 8H30z" opacity=".28"/>' +
    '<rect class="f-iron" x="70" y="44" width="34" height="8" rx="4"/>' +
    '<rect class="f-dark" x="96" y="42" width="8" height="12" rx="3"/>' +
    '<rect class="f-cloth" x="34" y="66" width="14" height="6" rx="2"/>';

  S.apc =
    GROUND +
    '<path class="f-steelD" d="M8 66l16-24h50l22 24v20H8z"/>' +
    '<path class="f-steel" d="M26 46h44l16 20H14z"/>' +
    '<rect class="f-glow" x="34" y="50" width="26" height="9" rx="3"/>' +
    '<circle class="f-dark" cx="28" cy="92" r="13"/><circle class="f-dark" cx="72" cy="92" r="13"/>' +
    '<circle class="f-iron" cx="28" cy="92" r="6"/><circle class="f-iron" cx="72" cy="92" r="6"/>' +
    '<rect class="f-cloth" x="44" y="70" width="14" height="6" rx="2"/>';

  S.turret =
    GROUND +
    '<path class="f-dark" d="M18 92h64l-6 14H24z"/>' +
    '<path class="f-steelD" d="M26 68h48l6 24H20z"/>' +
    '<path class="f-steel" d="M36 44h28l6 22H30z"/>' +
    '<rect class="f-iron" x="62" y="48" width="34" height="6" rx="3"/>' +
    '<rect class="f-iron" x="62" y="57" width="30" height="5" rx="2.5"/>' +
    '<circle class="f-glow" cx="50" cy="54" r="5"/>' +
    '<path class="f-cloth" d="M28 74h44v6H28z" opacity=".7"/>';

  S.mortar =
    GROUND +
    '<path class="f-dark" d="M14 96h72l-4 12H18z"/>' +
    '<rect class="f-iron" x="40" y="28" width="22" height="58" rx="8" transform="rotate(20 51 57)"/>' +
    '<path class="f-steel" d="M44 30h16l-2 10H46z" transform="rotate(20 51 35)"/>' +
    '<path class="f-steelD" d="M20 88h60l-6 10H26z"/>' +
    '<circle class="f-glow" cx="70" cy="24" r="8" opacity=".55"/>';

  S.airship =
    GROUND +
    '<ellipse class="f-cloth" cx="50" cy="36" rx="38" ry="20"/>' +
    '<path class="f-shade" d="M50 16a38 20 0 0 1 0 40z" opacity=".28"/>' +
    '<path class="f-lite" d="M26 26q14-8 30-4-16 0-26 8z" opacity=".4"/>' +
    '<path class="f-wood" d="M30 60h40l-6 20H36z"/>' +
    '<path class="f-dark" d="M30 60h40v4H30z"/>' +
    '<path class="f-gold" d="M36 66h28v3H36z"/>' +
    '<path class="f-iron" d="M34 56l-3-6h6zM66 56l3-6h-6z"/>';

  S.galleon =
    GROUND +
    '<path class="f-wood" d="M6 74h88l-14 26H20z"/>' +
    '<path class="f-dark" d="M6 74h88v5H6z"/>' +
    '<path class="f-gold" d="M14 84h72v4H14z"/>' +
    '<rect class="f-wood" x="47" y="10" width="6" height="64" rx="2"/>' +
    '<path class="f-cloth" d="M55 16q26 10 0 30z"/>' +
    '<path class="f-cloth" d="M45 22q-22 8 0 26z" opacity=".8"/>' +
    '<path class="f-shade" d="M55 16q26 10 0 30z" opacity=".18"/>' +
    '<circle class="f-glow" cx="50" cy="8" r="5"/>';

  S.hound =
    GROUND +
    '<path class="f-steelD" d="M20 62q10-18 30-18t30 18l-6 34H26z"/>' +
    '<path class="f-shade" d="M50 44q22 0 30 18l-6 34H50z" opacity=".26"/>' +
    '<path class="f-dark" d="M26 92h12v16H26zM62 92h12v16H62z"/>' +
    '<path class="f-skin" d="M70 40q18 0 22 14-8 10-24 8z"/>' +
    '<path class="f-bone" d="M66 34l-6-16 14 8zM82 36l8-16-2 18z"/>' +
    '<circle class="f-glow" cx="80" cy="48" r="3.6"/>' +
    '<path class="f-bone" d="M84 58l10-2-6 8z"/>' +
    '<path class="f-glow" d="M20 60q-12 6-14 18 10-6 18-6z" opacity=".55"/>';

  S.floatstone =
    GROUND +
    '<circle class="f-glow" cx="50" cy="50" r="34" opacity=".3"/>' +
    '<path class="f-stone" d="M50 18l26 18-10 32H34L24 36z"/>' +
    '<path class="f-shade" d="M50 18l26 18-10 32H50z" opacity=".26"/>' +
    '<path class="f-cloth" d="M50 34l12 10-5 16H43l-5-16z"/>' +
    '<circle class="f-lite" cx="44" cy="38" r="4" opacity=".5"/>';

  /* ── 거점 ── */
  S.st_spire =
    GROUND +
    '<path class="f-stone" d="M50 4l20 34-6 62H36l-6-62z"/>' +
    '<path class="f-shade" d="M50 4l20 34-6 62H50z" opacity=".28"/>' +
    '<path class="f-glow" d="M50 26l11 16-4 34h-14l-4-34z" opacity=".6"/>' +
    '<path class="f-cloth" d="M50 34l7 10-3 22h-8l-3-22z"/>' +
    '<path class="f-dark" d="M28 98h44l3 10H25z"/>' +
    '<path class="f-gold" d="M34 60h32v4H34z"/>';

  S.st_barracks =
    GROUND +
    '<path class="f-wood" d="M10 48L50 16l40 32v54H10z"/>' +
    '<path class="f-shade" d="M50 16l40 32v54H50z" opacity=".26"/>' +
    '<path class="f-dark" d="M6 50L50 14l44 36-4 6L50 24 10 56z"/>' +
    '<path class="f-dark" d="M38 68h24v34H38z"/>' +
    '<path class="f-glow" d="M42 72h16v26H42z" opacity=".5"/>' +
    '<rect class="f-iron" x="18" y="62" width="12" height="12" rx="2"/>' +
    '<rect class="f-iron" x="70" y="62" width="12" height="12" rx="2"/>' +
    '<path class="f-cloth" d="M46 26h8v18h-8z"/>';

  S.st_shrine =
    GROUND +
    '<path class="f-stone" d="M50 6l40 76H10z"/>' +
    '<path class="f-shade" d="M50 6l40 76H50z" opacity=".26"/>' +
    '<path class="f-glow" d="M50 34l22 42H28z" opacity=".55"/>' +
    '<path class="f-cloth" d="M50 46l13 26H37z"/>' +
    '<path class="f-dark" d="M6 82h88l3 12H3z"/>' +
    '<path class="f-gold" d="M46 20h8v14h-8z"/>';

  /* ── 주문 아이콘 ── */
  function spell(inner) { return '<circle class="f-glow" cx="50" cy="58" r="40" opacity=".18"/>' + inner; }

  S.sp_fire = spell(
    '<path class="f-cloth" d="M50 14q22 30 22 50a22 22 0 0 1-44 0q0-20 22-50z"/>' +
    '<path class="f-lite" d="M50 44q11 16 11 26a11 11 0 0 1-22 0q0-10 11-26z" opacity=".65"/>');

  S.sp_bolt = spell(
    '<path class="f-gold" d="M58 8L24 62h20l-6 46 36-56H52z"/>' +
    '<path class="f-lite" d="M55 22L38 56h10l-3 22 18-30H52z" opacity=".55"/>');

  S.sp_chain = spell(
    '<path class="f-gold" d="M40 8L14 54h16l-8 38 30-46H36z"/>' +
    '<path class="f-cloth" d="M76 24L54 62h14l-6 32 24-40H72z"/>');

  S.sp_heal = spell(
    '<path class="f-cloth" d="M50 100Q14 72 14 48a20 20 0 0 1 36-12 20 20 0 0 1 36 12q0 24-36 52z"/>' +
    '<path class="f-lite" d="M44 40h12v40H44zM30 54h40v12H30z" opacity=".8"/>');

  S.sp_buff = spell(
    '<path class="f-gold" d="M50 8l11 34 36 11-36 11-11 34-11-34-36-11 36-11z"/>' +
    '<circle class="f-cloth" cx="50" cy="53" r="12"/>' +
    '<circle class="f-lite" cx="46" cy="49" r="4" opacity=".6"/>');

  S.sp_draw = spell(
    '<rect class="f-steelD" x="12" y="30" width="42" height="58" rx="5" transform="rotate(-11 33 59)"/>' +
    '<rect class="f-cloth" x="46" y="22" width="42" height="58" rx="5" transform="rotate(10 67 51)"/>' +
    '<path class="f-lite" d="M52 32h28v5H52zM52 44h22v5H52z" opacity=".55"/>');

  S.sp_aoe = spell(
    '<circle class="f-cloth" cx="50" cy="56" r="14"/>' +
    '<circle class="f-gold" cx="50" cy="56" r="26" fill="none" stroke-width="5" opacity=".8"/>' +
    '<circle class="f-gold" cx="50" cy="56" r="38" fill="none" stroke-width="4" opacity=".4"/>' +
    '<path class="f-lite" d="M46 50a6 6 0 0 1 6-4" opacity=".7"/>');

  S.sp_crosshair = spell(
    '<circle class="f-steel" cx="50" cy="56" r="34" fill="none" stroke-width="7"/>' +
    '<path class="f-cloth" d="M47 12h6v26h-6zM47 74h6v26h-6zM6 53h26v6H6zM68 53h26v6H68z"/>' +
    '<circle class="f-cloth" cx="50" cy="56" r="8"/>');

  S.sp_flare = spell(
    '<circle class="f-cloth" cx="50" cy="34" r="18"/>' +
    '<circle class="f-lite" cx="44" cy="28" r="6" opacity=".6"/>' +
    '<path class="f-gold" d="M50 4v12M24 14l7 10M76 14l-7 10M12 36h12M76 36h12"/>' +
    '<path class="f-steelD" d="M42 54h16l8 48H34z" opacity=".85"/>');

  S.sp_trench = spell(
    '<rect class="f-leather" x="6" y="64" width="30" height="18" rx="8"/>' +
    '<rect class="f-leather" x="34" y="64" width="30" height="18" rx="8"/>' +
    '<rect class="f-leather" x="62" y="64" width="30" height="18" rx="8"/>' +
    '<rect class="f-cloth" x="20" y="44" width="30" height="18" rx="8"/>' +
    '<rect class="f-cloth" x="50" y="44" width="30" height="18" rx="8"/>' +
    '<path class="f-dark" d="M4 84h92l2 10H2z"/>');

  S.sp_horn = spell(
    '<path class="f-gold" d="M10 66q0-32 32-36l16-10-4 22q-26 2-32 30z"/>' +
    '<circle class="f-steelD" cx="22" cy="76" r="15"/>' +
    '<circle class="f-gold" cx="22" cy="76" r="8"/>' +
    '<path class="f-cloth" d="M76 40q14 12 0 26" fill="none" stroke-width="5"/>' +
    '<path class="f-cloth" d="M86 32q22 20 0 42" fill="none" stroke-width="4" opacity=".55"/>');

  S.sp_judgment = spell(
    '<path class="f-gold" d="M50 4l10 34h30l-24 20 9 34-25-21-25 21 9-34-24-20h30z"/>' +
    '<circle class="f-cloth" cx="50" cy="52" r="12"/>' +
    '<circle class="f-lite" cx="46" cy="48" r="4" opacity=".6"/>');

  S.sp_teleport = spell(
    '<ellipse class="f-cloth" cx="50" cy="56" rx="20" ry="44" fill="none" stroke-width="7"/>' +
    '<ellipse class="f-gold" cx="50" cy="56" rx="44" ry="20" fill="none" stroke-width="6" opacity=".8"/>' +
    '<circle class="f-lite" cx="50" cy="56" r="10" opacity=".85"/>');

  S.sp_pact = spell(
    '<path class="f-bone" d="M22 8h44l16 16v76H22z"/>' +
    '<path class="f-shade" d="M66 8l16 16H66z" opacity=".35"/>' +
    '<path class="f-cloth" d="M40 40l10-10 10 10-10 10z"/>' +
    '<path class="f-dark" d="M32 64h36v5H32zM32 76h26v5H32z"/>');

  S.sp_sacrifice = spell(
    '<path class="f-bone" d="M42 96h16V60h32V44H58V8H42v36H10v16h32z"/>' +
    '<circle class="f-cloth" cx="50" cy="52" r="14" opacity=".9"/>' +
    '<circle class="f-lite" cx="45" cy="47" r="4" opacity=".55"/>');

  S.sp_hellfire = spell(
    '<path class="f-cloth" d="M24 12q14 22 14 34a14 14 0 0 1-28 0q0-12 14-34z" opacity=".85"/>' +
    '<path class="f-cloth" d="M76 12q14 22 14 34a14 14 0 0 1-28 0q0-12 14-34z" opacity=".85"/>' +
    '<path class="f-cloth" d="M50 34q20 30 20 46a20 20 0 0 1-40 0q0-16 20-46z"/>' +
    '<path class="f-lite" d="M50 60q9 14 9 22a9 9 0 0 1-18 0q0-8 9-22z" opacity=".6"/>');

  S.sp_cataclysm = spell(
    '<path class="f-gold" d="M50 2l13 32 34 2-26 22 9 34-30-19-30 19 9-34L3 36l34-2z"/>' +
    '<circle class="f-cloth" cx="50" cy="48" r="16"/>' +
    '<circle class="f-lite" cx="44" cy="42" r="5" opacity=".55"/>');

  S.sp_coin = spell(
    '<circle class="f-gold" cx="50" cy="56" r="38"/>' +
    '<circle class="f-cloth" cx="50" cy="56" r="26"/>' +
    '<path class="f-gold" d="M50 36l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z"/>' +
    '<path class="f-lite" d="M32 40a24 24 0 0 1 16-10" fill="none" stroke-width="4" opacity=".6"/>');

  S.sp_rift = spell(
    '<path class="f-cloth" d="M46 4q-10 28 6 52t-2 48q14-26-4-50T46 4z"/>' +
    '<circle class="f-glow" cx="26" cy="38" r="7"/><circle class="f-glow" cx="74" cy="72" r="7"/>' +
    '<circle class="f-lite" cx="76" cy="30" r="4" opacity=".7"/>' +
    '<circle class="f-lite" cx="24" cy="80" r="4" opacity=".7"/>');

  /* 비인간형 매핑 */
  var NONFIG = {
    v_tank: 'tank', v_apc: 'apc', v_mgnest: 'turret', v_mortar: 'mortar',
    a_skiff: 'airship', a_galleon: 'galleon', a_floatstone: 'floatstone',
    d_hound: 'hound', d_leech: 'hound', d_charger: 'hound',
    v_drone: 'airship', n_jugger: 'apc',
    st_spire: 'st_spire', st_barracks: 'st_barracks', st_shrine: 'st_shrine',
    /* 주문 */
    n_regroup: 'sp_draw', n_coin: 'sp_coin',
    v_precision: 'sp_crosshair', v_barrage: 'sp_aoe', v_flare: 'sp_flare', v_trench: 'sp_trench',
    e_sanctuary: 'sp_buff', e_judgment: 'sp_judgment', e_warhorn: 'sp_horn',
    a_bolt: 'sp_bolt', a_rift: 'sp_rift', a_chain: 'sp_chain', a_cataclysm: 'sp_cataclysm',
    d_pact: 'sp_pact', d_sacrifice: 'sp_sacrifice', d_hellfire: 'sp_hellfire',
    v_railgun: 'turret', a_stormcall: 'sp_chain'
  };

  /* ═══════════════ 공개 API ═══════════════ */
  function inner(cardId) {
    if (NONFIG[cardId] && S[NONFIG[cardId]]) {
      var body = S[NONFIG[cardId]];
      /* 주문 아이콘은 지면 그림자를 두지 않는다 */
      return (NONFIG[cardId].indexOf('sp_') === 0) ? body : body;
    }
    if (FIGS[cardId]) return figure(FIGS[cardId]);
    return figure(mix(KNIGHT, { weapon: 'sword', off: 'shield' }));
  }

  /* 실루엣 한 겹을 뒤에 깔아 어두운 배경에서도 형태가 분리돼 보이게 한다 */
  function svg(cardId, cls) {
    var g = inner(cardId);
    return '<svg class="art-svg ' + (cls || '') + '" viewBox="0 0 100 124" ' +
      'xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<g class="l-sil" transform="translate(0,2.5)">' + g + '</g>' +
      '<g class="l-body">' + g + '</g>' +
      '</svg>';
  }

  function factionCrest(factionId) {
    var gen = { vanguard: 'gen_volkov', exile: 'gen_arden', arcane: 'gen_selene', demon: 'gen_karnak' };
    return svg(gen[factionId] || 'gen_arden', 'crest');
  }

  /* ═══════════════ AI 이미지 에셋 파이프라인 ═══════════════
     assets/units/<cardId>.png 이 있으면 이미지를, 없으면 SVG 아트를 쓴다.
     404 결과는 캐시해서 재시도하지 않는다. 파일만 넣으면 즉시 적용된다. */
  var imgKnown = {};
  function attachImg(host, id, kind) {
    if (!global.Image || !host) return;
    var src = 'assets/' + (kind || 'units') + '/' + id + '.png';
    if (imgKnown[src] === 'missing') return;
    var img = global.document.createElement('img');
    img.className = 'art-img';
    img.alt = '';
    img.draggable = false;
    img.onload = function () { imgKnown[src] = 'ok'; host.classList.add('has-img'); };
    img.onerror = function () { imgKnown[src] = 'missing'; img.remove(); };
    img.src = src;
    host.appendChild(img);
  }

  RG.Art = {
    svg: svg, inner: inner, factionCrest: factionCrest,
    attachImg: attachImg,
    injectDefs: injectDefs, DEFS: DEFS,
    PARTS: P, FIGS: FIGS, SYMBOLS: S, NONFIG: NONFIG,
    figure: figure
  };
})(typeof window !== 'undefined' ? window : global);

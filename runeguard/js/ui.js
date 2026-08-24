/* RUNEGUARD — UI / 상호작용 v0.2 */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};
  var D = RG.Data, E = RG.Engine;
  var CARDS = D.CARDS;

  /* 아트/사운드는 없어도 게임이 돌아가야 한다 — 안전한 대체를 둔다 */
  var Art = RG.Art || { svg: function () { return ''; }, factionCrest: function () { return ''; } };
  var sfx = function (n) { if (RG.Audio) RG.Audio.play(n); };

  var G = {
    state: null,
    config: { mode: 'ai', difficulty: 'normal', p1: 'exile', p2: 'demon' },
    sel: null,
    aiTimer: null
  };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* ═════════ 조회 헬퍼 ═════════ */
  function isOnline() { return G.config.mode === 'online'; }
  function netEmit(fn, args) {
    if (isOnline() && RG.Net && RG.Net.isOnline()) RG.Net.emit(fn, args);
  }
  function viewPlayer() {
    if (!G.state) return 'P1';
    if (isOnline()) return G.netRole || 'P1';       /* 온라인에선 내 손패만 본다 */
    return G.config.mode === 'local' ? G.state.current : 'P1';
  }
  function isHumanTurn() {
    var s = G.state;
    if (!s || s.winner) return false;
    if (isOnline()) return s.current === G.netRole; /* 내 차례에만 입력 허용 */
    return !s.players[s.current].isAI;
  }
  function clearSel() { G.sel = null; }

  /* ═════════ 시작 화면 ═════════ */
  function buildMenu() {
    $('arkNeedTxt').textContent = D.ARK_TURNS_TO_WIN;

    ['p1', 'p2'].forEach(function (side) {
      var host = $(side + 'Factions');
      host.innerHTML = '';
      D.FACTION_ORDER.forEach(function (fid) {
        var f = D.FACTIONS[fid];
        var b = el('button', 'fac');
        b.style.color = f.color;
        b.style.setProperty('--accent', f.color);
        b.dataset.faction = fid;
        b.innerHTML =
          '<span class="fic">' + Art.factionCrest(fid) + '</span>' +
          '<span class="fname">' + f.name + '</span>' +
          '<span class="ftag">' + f.tag + '</span>' +
          '<span class="fdesc">' + f.blurb + '</span>';
        if (G.config[side] === fid) b.classList.add('is-on');
        b.addEventListener('click', function () {
          G.config[side] = fid;
          host.querySelectorAll('.fac').forEach(function (x) { x.classList.remove('is-on'); });
          b.classList.add('is-on');
          sfx('select');
        });
        host.appendChild(b);
      });
    });

    $('modeRow').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-mode]');
      if (!b) return;
      G.config.mode = b.dataset.mode;
      $('modeRow').querySelectorAll('.opt').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
      $('diffBlock').hidden = (G.config.mode !== 'ai');
      $('onlineBlock').hidden = (G.config.mode !== 'online');
      $('p2Block').hidden = (G.config.mode === 'online');   /* 상대 진영은 상대가 고른다 */
      $('startBtn').hidden = (G.config.mode === 'online');
    });

    $('diffRow').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-diff]');
      if (!b) return;
      G.config.difficulty = b.dataset.diff;
      $('diffRow').querySelectorAll('.opt').forEach(function (x) { x.classList.remove('is-on'); });
      b.classList.add('is-on');
    });

    /* 사운드 토글 */
    renderSoundBtn();
    $('sndBtn').addEventListener('click', function () {
      if (RG.Audio) RG.Audio.toggle();
      renderSoundBtn();
      sfx('click');
    });
    $('bgmBtn').addEventListener('click', function () {
      if (RG.BGM) RG.BGM.toggle();
      renderSoundBtn();
      sfx('click');
    });

    /* 카드 도감 */
    buildCodexFilters();
    if (RG.Builder) RG.Builder.init();
    $('builderBtnMenu').addEventListener('click', function () {
      RG.Builder.open(G.config.p1);
    });
    $('codexBtnMenu').addEventListener('click', openCodex);
    $('codexBtn').addEventListener('click', openCodex);
    $('codexClose').addEventListener('click', closeCodex);
    /* ESC = 만능 탈출키 — 화면을 덮는 모든 것을 닫는다 */
    document.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Escape') return;
      if (!$('codex').hidden) { closeCodex(); return; }
      closeAllOverlays();
      clearSel();
      if (G.state && $('game') && !$('game').hidden) render();
    });

    $('startBtn').addEventListener('click', startGame);

    /* ── 온라인 친선전 ── */
    function netStatus(txt, isErr) {
      var el2 = $('netStatus');
      el2.textContent = txt || '';
      el2.classList.toggle('is-err', !!isErr);
    }
    var myDeck = function () { return RG.Builder ? RG.Builder.getDeckFor(G.config.p1) : null; };
    $('hostBtn').addEventListener('click', function () {
      netStatus('방을 만드는 중...');
      RG.Net.hostGame(G.config.p1, myDeck(), function (e) { netStatus(e, true); });
    });
    $('joinBtn').addEventListener('click', function () {
      var code = $('joinCode').value.trim();
      if (code.length !== 4) { netStatus('4자리 코드를 입력하세요.', true); return; }
      netStatus('방 ' + code.toUpperCase() + ' 에 참가하는 중...');
      RG.Net.joinGame(code, G.config.p1, myDeck(), function (e) { netStatus(e, true); });
    });

    if (RG.Net) RG.Net.bindUI({
      onRoomReady: function (code) {
        netStatus('방 코드: ' + code + ' — 상대에게 알려주세요. 대기 중...');
      },
      onStart: function (cfg, role) {
        G.netRole = role;
        G.config.mode = 'online';
        clearSel(); seenUids = {};
        G.fxBefore = null; G.fxAttacker = null;
        if ($('fxLayer')) $('fxLayer').innerHTML = '';
        G.state = E.createGame({
          seed: cfg.seed,
          p1Faction: cfg.p1Faction, p2Faction: cfg.p2Faction,
          p1Deck: cfg.p1Deck || null, p2Deck: cfg.p2Deck || null,
          p1Name: D.FACTIONS[cfg.p1Faction].name + (role === 'P1' ? ' (나)' : ' (상대)'),
          p2Name: D.FACTIONS[cfg.p2Faction].name + (role === 'P2' ? ' (나)' : ' (상대)'),
          p1AI: false, p2AI: false
        });
        closeAllOverlays();
        $('menu').hidden = true;
        $('game').hidden = false;
        sfx('turn');
        render();
      },
      beforeRemote: function (fn, args) {
        if (fn === 'playCard' && G.state) {
          /* 손패가 소모되기 전에 카드 id 를 캡처해 공개 연출 */
          var pid = args[0], hi2 = args[1];
          var cid = G.state.players[pid] && G.state.players[pid].hand[hi2];
          if (cid) {
            showCardReveal(cid);
            G._revealCid = cid;
          }
        }
        markFx(fn === 'attackWith' ? args[0] : null);
      },
      afterRemote: function (fn, args) {
        if (fn === 'attackWith') spawnSlash(args[1]);
        if (fn === 'playCard' && args[2]) {
          var rc = G._revealCid ? CARDS[G._revealCid] : null;
          G._revealCid = null;
          if (rc && rc.type === 'spell' && args[2].target != null) spawnSpellFx(args[2].target);
          if (rc && rc.type === 'unit' && args[2].cell != null) {
            var rf = D.FACTIONS[rc.faction];
            spawnSummonFx(args[2].cell, rf ? rf.color : null);
          }
        }
        sfx({ playCard: 'summon', moveUnit: 'move', attackWith: 'attack',
              useHeroPower: 'power', buildStructure: 'build',
              mulliganCard: 'draw', endTurn: 'turn' }[fn] || 'click');
        render();
        if (G.state && G.state.winner) showResult();
      },
      onSync: function () { render(); if (G.state && G.state.winner) showResult(); },
      onPeerLeft: function () {
        var b2 = $('banner');
        b2.textContent = '상대방이 나갔습니다 — 메뉴로 돌아가세요';
        b2.hidden = false;
      }
    }, function () { return G.state; }, function (st) { G.state = st; });
    $('againBtn').addEventListener('click', function () { $('overlay').hidden = true; startGame(); });
    $('menuBtn').addEventListener('click', backToMenu);
    $('quitBtn').addEventListener('click', backToMenu);
    $('endBtn').addEventListener('click', onEndTurn);
    $('powerBtn').addEventListener('click', onPower);
    $('buildBtn').addEventListener('click', onBuildClick);
    $('mullBtn').addEventListener('click', onMulligan);
  }

  /* ═════════ 사운드/BGM 토글 ═════════ */
  function renderSoundBtn() {
    var on = RG.Audio ? RG.Audio.isEnabled() : false;
    $('sndBtn').innerHTML = (on ? '♪ 효과음' : '✕ 효과음') + '<small>' + (on ? '켜짐' : '꺼짐') + '</small>';
    $('sndBtn').classList.toggle('is-off', !on);
    var bon = RG.BGM ? RG.BGM.isEnabled() : false;
    $('bgmBtn').innerHTML = (bon ? '♫ 음악' : '✕ 음악') + '<small>' + (bon ? '켜짐' : '꺼짐') + '</small>';
    $('bgmBtn').classList.toggle('is-off', !bon);
  }

  /* ═════════ 카드 도감 ═════════ */
  var codexFilter = { faction: 'all', type: 'all' };

  function codexPool() {
    var ids = Object.keys(CARDS).filter(function (id) {
      var c = CARDS[id];
      if (id === 'n_coin') return true;               /* 후공 보정 카드도 보여 준다 */
      return c.type === 'unit' || c.type === 'spell' ||
             c.type === 'general' || c.type === 'structure' || c.type === 'token';
    });
    return ids.filter(function (id) {
      var c = CARDS[id];
      if (codexFilter.faction !== 'all' && c.faction !== codexFilter.faction) return false;
      if (codexFilter.type === 'unit' && c.type !== 'unit') return false;
      if (codexFilter.type === 'spell' && c.type !== 'spell') return false;
      if (codexFilter.type === 'other' && ['general', 'structure', 'token'].indexOf(c.type) < 0) return false;
      if (codexFilter.type === 'all' && ['general', 'structure', 'token'].indexOf(c.type) >= 0
          && codexFilter.faction === 'all') return true;
      return true;
    }).sort(function (a, b) {
      var ca = CARDS[a], cb = CARDS[b];
      var order = { general: 0, unit: 1, spell: 2, structure: 3, token: 4 };
      if (order[ca.type] !== order[cb.type]) return order[ca.type] - order[cb.type];
      if (ca.cost !== cb.cost) return ca.cost - cb.cost;
      return ca.name.localeCompare(cb.name, 'ko');
    });
  }

  function buildCodexFilters() {
    var fh = $('codexFaction');
    fh.innerHTML = '';
    var facs = [['all', '전체']].concat(
      D.FACTION_ORDER.map(function (f) { return [f, D.FACTIONS[f].name]; }),
      [['neutral', '중립']]);
    facs.forEach(function (pair) {
      var b = el('button', 'chip' + (codexFilter.faction === pair[0] ? ' is-on' : ''), pair[1]);
      if (D.FACTIONS[pair[0]]) b.style.setProperty('--accent', D.FACTIONS[pair[0]].color);
      b.addEventListener('click', function () {
        codexFilter.faction = pair[0]; sfx('click'); buildCodexFilters(); renderCodex();
      });
      fh.appendChild(b);
    });

    var th = $('codexType');
    th.innerHTML = '';
    [['all', '전체'], ['unit', '유닛'], ['spell', '주문'], ['other', '장군·거점']].forEach(function (pair) {
      var b = el('button', 'chip' + (codexFilter.type === pair[0] ? ' is-on' : ''), pair[1]);
      b.addEventListener('click', function () {
        codexFilter.type = pair[0]; sfx('click'); buildCodexFilters(); renderCodex();
      });
      th.appendChild(b);
    });
  }

  var TYPE_LABEL = { unit: '유닛', spell: '주문', general: '장군', structure: '거점', token: '토큰' };

  function codexCard(id) {
    var c = CARDS[id];
    var fac = D.FACTIONS[c.faction];
    var node = el('div', 'cx-card cx-' + c.type + (c.hero ? ' is-hero' : ''));
    node.style.setProperty('--accent', fac ? fac.color : '#8e97b3');

    var head = el('div', 'cx-head');
    if (c.type !== 'general' && c.type !== 'token') {
      head.appendChild(el('div', 'cx-cost', c.cost));
    }
    head.appendChild(el('div', 'cx-tag', (fac ? fac.name : '중립') + ' · ' + TYPE_LABEL[c.type]));
    node.appendChild(head);

    var art = el('div', 'cx-art');
    art.innerHTML = Art.svg(id);
    Art.attachImg(art, id);
    node.appendChild(art);

    node.appendChild(el('div', 'cx-name', c.name));

    if (c.type === 'unit' || c.type === 'general' || c.type === 'token') {
      var st = el('div', 'cx-stats');
      st.innerHTML =
        '<span class="a">' + c.atk + '</span><span class="sep">공격</span>' +
        '<span class="h">' + c.hp + '</span><span class="sep">체력</span>' +
        '<span class="m">' + c.mv + '</span><span class="sep">기동</span>' +
        '<span class="r">' + c.rng + '</span><span class="sep">사거리</span>';
      node.appendChild(st);
    } else if (c.type === 'structure') {
      var st2 = el('div', 'cx-stats');
      st2.innerHTML = '<span class="h">' + c.hp + '</span><span class="sep">내구도</span>';
      node.appendChild(st2);
    }

    if (c.keywords && c.keywords.length) {
      var kw = el('div', 'cx-kws');
      c.keywords.forEach(function (k) { kw.appendChild(el('span', 'kwchip', k)); });
      node.appendChild(kw);
    }

    node.appendChild(el('div', 'cx-text', c.text || ''));

    /* 기본 덱에 몇 장 들어가는지 */
    if (c.type === 'unit' || c.type === 'spell') {
      var owner = (c.faction === 'neutral')
        ? D.FACTION_ORDER.filter(function (f) { return D.NEUTRAL_PICKS[f].indexOf(id) >= 0; })
        : (D.DEFAULT_UNIQUES[c.faction] && D.DEFAULT_UNIQUES[c.faction].indexOf(id) >= 0
            ? [c.faction] : []);
      var note = (id === 'n_coin')
        ? '후공 시작 손패에 1장 지급'
        : (owner.length
            ? owner.map(function (f) { return D.FACTIONS[f].name; }).join(' · ') + ' 기본 덱에 2장'
            : '기본 덱 미포함 — 덱 빌딩에서 추가');
      node.appendChild(el('div', 'cx-deck', note));
    }

    node.addEventListener('mouseenter', function () { sfx('click'); });
    return node;
  }

  function renderCodex() {
    var ids = codexPool();
    var body = $('codexBody');
    body.innerHTML = '';
    ids.forEach(function (id) { body.appendChild(codexCard(id)); });
    $('codexCount').textContent = ids.length + '종';
    body.scrollTop = 0;
  }

  function openCodex() {
    sfx('select');
    renderCodex();
    $('codex').hidden = false;
  }
  function closeCodex() {
    sfx('cancel');
    $('codex').hidden = true;
  }

  /* 화면을 덮는 요소들을 한 번에 정리한다.
     화면 전환마다 반드시 부른다 — 안 그러면 도감이 열린 채로 게임이 시작된다. */
  function closeAllOverlays() {
    $('codex').hidden = true;
    $('overlay').hidden = true;
    $('buildPicker').hidden = true;
    $('prompt').hidden = true;
  }

  function backToMenu() {
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }
    if (RG.Net) RG.Net.leave();
    if ($('netStatus')) $('netStatus').textContent = '';
    $('banner').hidden = true;
    closeAllOverlays();
    $('game').hidden = true;
    $('menu').hidden = false;
    if (RG.BGM) RG.BGM.setMood('menu');
  }

  function startGame() {
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }
    clearSel();
    seenUids = {};
    G.fxBefore = null; G.fxAttacker = null;
    if ($('fxLayer')) $('fxLayer').innerHTML = '';
    var vsAI = G.config.mode === 'ai';
    var deckOf = function (f) { return RG.Builder ? RG.Builder.getDeckFor(f) : null; };
    G.state = E.createGame({
      p1Faction: G.config.p1,
      p2Faction: G.config.p2,
      p1Deck: deckOf(G.config.p1),
      p2Deck: vsAI ? null : deckOf(G.config.p2),   /* AI 는 기본 덱 (평가 기준 유지) */
      p1Name: D.FACTIONS[G.config.p1].name + (vsAI ? '' : ' (P1)'),
      p2Name: D.FACTIONS[G.config.p2].name + (vsAI ? ' AI' : ' (P2)'),
      p1AI: false,
      p2AI: vsAI
    });
    closeAllOverlays();
    $('menu').hidden = true;
    $('game').hidden = false;
    if (RG.BGM) RG.BGM.setMood('battle');
    render();
    maybeRunAI();
  }

  /* ═══════════════════════════════════════════
     전투 연출 (FX)
     엔진을 건드리기 직전에 스냅샷을 찍어 두고, 렌더가 끝난 뒤
     HP 변화 · 사망을 비교해서 피해 숫자와 이펙트를 얹는다.
     ═══════════════════════════════════════════ */
  var seenUids = {};          /* 이미 등장한 적 있는 유닛 — 팝인 애니메이션 판별용 */

  function snapshot() {
    var m = {};
    for (var i = 0; i < E.SIZE; i++) {
      var e = G.state.board[i];
      if (e) m[e.uid] = { hp: e.hp, idx: i };
    }
    return m;
  }

  /* 엔진 호출 직전에 부른다. attackerIdx 를 주면 그 유닛이 돌진 모션을 취한다. */
  function markFx(attackerIdx) {
    if (!G.state) return;
    G.fxBefore = snapshot();
    var a = (attackerIdx != null) ? G.state.board[attackerIdx] : null;
    G.fxAttacker = a ? a.uid : null;
  }

  function cellCenter(idx) {
    var board = $('board');
    var c = board.children[idx];
    if (!c) return null;
    var wr = $('boardWrap').getBoundingClientRect();
    var cr = c.getBoundingClientRect();
    return { x: cr.left - wr.left + cr.width / 2, y: cr.top - wr.top + cr.height / 2 };
  }

  function unitNodeAt(idx) {
    var c = $('board').children[idx];
    return c ? c.querySelector('.unit') : null;
  }

  function spawnDmg(idx, amount, kind) {
    var p = cellCenter(idx);
    if (!p) return;
    var n = el('div', 'dmg ' + (kind === 'heal' ? 'dmg-heal' : 'dmg-hurt'),
      (kind === 'heal' ? '+' : '−') + amount);
    n.style.left = p.x + 'px';
    n.style.top = p.y + 'px';
    $('fxLayer').appendChild(n);
    setTimeout(function () { n.remove(); }, 1000);
  }

  function spawnSlash(idx) {
    var p = cellCenter(idx);
    if (!p) return;
    var layer = $('fxLayer');
    var s1 = el('div', 'fx-slash');
    s1.style.left = p.x + 'px'; s1.style.top = p.y + 'px';
    layer.appendChild(s1);
    var s2 = el('div', 'fx-slash fx-slash2');   /* 교차 이중 참격 */
    s2.style.left = p.x + 'px'; s2.style.top = p.y + 'px';
    layer.appendChild(s2);
    spawnSparks(idx, 5, '#ffe9b0');
    setTimeout(function () { s1.remove(); s2.remove(); }, 440);
  }

  /* 방향성 파편 — 여러 이펙트에서 재사용 */
  function spawnSparks(idx, count, color) {
    var p = cellCenter(idx);
    if (!p) return;
    var layer = $('fxLayer');
    for (var i = 0; i < count; i++) {
      var sp = el('div', 'spark');
      var ang = Math.random() * Math.PI * 2;
      var dist = 18 + Math.random() * 26;
      sp.style.left = p.x + 'px'; sp.style.top = p.y + 'px';
      if (color) { sp.style.background = color; sp.style.boxShadow = '0 0 8px ' + color; }
      sp.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      sp.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      layer.appendChild(sp);
      (function (node) { setTimeout(function () { node.remove(); }, 620); })(sp);
    }
  }

  /* 소환 마법진 — 링 + 솟는 빛기둥 */
  function spawnSummonFx(idx, color) {
    var p = cellCenter(idx);
    if (!p) return;
    var layer = $('fxLayer');
    var ring = el('div', 'fx-summon-ring');
    ring.style.left = p.x + 'px'; ring.style.top = p.y + 'px';
    if (color) ring.style.borderColor = color;
    layer.appendChild(ring);
    var beam = el('div', 'fx-summon-beam');
    beam.style.left = p.x + 'px'; beam.style.top = p.y + 'px';
    layer.appendChild(beam);
    spawnSparks(idx, 6, color || '#9fe4ff');
    setTimeout(function () { ring.remove(); beam.remove(); }, 700);
  }

  /* 회복 반짝임 */
  function spawnHealFx(idx) {
    var p = cellCenter(idx);
    if (!p) return;
    var layer = $('fxLayer');
    for (var i = 0; i < 4; i++) {
      var h = el('div', 'fx-healdot');
      h.style.left = (p.x - 16 + Math.random() * 32) + 'px';
      h.style.top = (p.y + 6 - Math.random() * 10) + 'px';
      h.style.animationDelay = (i * 0.07) + 's';
      layer.appendChild(h);
      (function (node) { setTimeout(function () { node.remove(); }, 900); })(h);
    }
  }

  function spawnImpact(idx) {
    var p = cellCenter(idx);
    if (!p) return;
    var im = el('div', 'fx-impact');
    im.style.left = p.x + 'px'; im.style.top = p.y + 'px';
    $('fxLayer').appendChild(im);
    setTimeout(function () { im.remove(); }, 420);
  }

  function spawnSpellFx(idx) {
    var p = cellCenter(idx);
    if (!p) return;
    var sp = el('div', 'fx-spell');
    sp.style.left = p.x + 'px'; sp.style.top = p.y + 'px';
    $('fxLayer').appendChild(sp);
    setTimeout(function () { sp.remove(); }, 650);
  }

  function shakeBoard() {
    var bw = $('boardWrap');
    if (!bw) return;
    bw.classList.remove('is-shake');
    void bw.offsetWidth;               /* 애니메이션 재시작 트릭 */
    bw.classList.add('is-shake');
  }

  function spawnBoom(idx) {
    var p = cellCenter(idx);
    if (!p) return;
    var layer = $('fxLayer');
    var b = el('div', 'boom');
    b.style.left = p.x + 'px'; b.style.top = p.y + 'px';
    layer.appendChild(b);
    setTimeout(function () { b.remove(); }, 520);

    for (var i = 0; i < 9; i++) {
      var s = el('div', 'spark');
      var ang = (Math.PI * 2 / 9) * i + Math.random() * 0.5;
      var dist = 24 + Math.random() * 22;
      s.style.left = p.x + 'px'; s.style.top = p.y + 'px';
      s.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
      s.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
      layer.appendChild(s);
      (function (node) { setTimeout(function () { node.remove(); }, 620); })(s);
    }
  }

  /* 이펙트가 비정상적으로 쌓이면 오래된 것부터 정리한다 (안전장치) */
  function capFxLayer() {
    var layer = $('fxLayer');
    if (!layer) return;
    while (layer.children.length > 120) layer.removeChild(layer.firstChild);
  }

  function flushFx() {
    capFxLayer();
    var before = G.fxBefore;
    if (!before) return;
    G.fxBefore = null;
    var attackerUid = G.fxAttacker;
    G.fxAttacker = null;

    var after = snapshot();

    var anyDeath = false;
    Object.keys(before).forEach(function (uid) {
      var b = before[uid], a = after[uid];
      if (!a) { spawnBoom(b.idx); anyDeath = true; return; }   /* 파괴 */
      if (a.hp < b.hp) {
        spawnDmg(a.idx, b.hp - a.hp, 'hurt');
        spawnImpact(a.idx);
        var n = unitNodeAt(a.idx);
        if (n) n.classList.add('is-hit');
      } else if (a.hp > b.hp) {
        spawnDmg(a.idx, a.hp - b.hp, 'heal');
        spawnHealFx(a.idx);
      }
    });
    if (anyDeath) shakeBoard();

    if (attackerUid) {
      var ai = E.findByUid(G.state, attackerUid);
      if (ai >= 0) {
        var an = unitNodeAt(ai);
        if (an) an.classList.add('is-attacking');
      }
    }
  }

  /* ═════════ 렌더링 ═════════ */
  function applyTheme() {
    if (!G.state) return;
    var t = D.THEMES[G.state.theme || 0];
    var id = t ? t.id : 'grass';
    $('game').dataset.theme = id;
    if (RG.Scene) RG.Scene.render(id);   /* 테마별 환경 아트 */
    var sl = $('sceneLayer');
    if (sl && sl.dataset.imgFor !== id) {
      sl.dataset.imgFor = id;
      sl.classList.remove('has-img');
      var old = sl.querySelector('.art-img');
      if (old) old.remove();
      Art.attachImg(sl, id, 'scenes');
    }
    buildWeather(id);                    /* 테마별 날씨 파티클 */
  }

  function render() {
    if (!G.state) return;
    applyTheme();
    renderTop();
    renderBoard();
    renderHand();
    renderControls();
    renderLog();
    renderPrompt();
    flushFx();
  }

  function hpBar(e) {
    var pct = Math.max(0, e.hp / e.maxHp * 100);
    var wrap = el('div', 'hpbar' + (pct <= 35 ? ' low' : ''));
    var lbl = el('div', 'lbl');
    lbl.appendChild(el('span', null, e.name));
    lbl.appendChild(el('span', null, e.hp + ' / ' + e.maxHp));
    var track = el('div', 'track');
    var fill = el('div', 'fill');
    fill.style.width = pct + '%';
    track.appendChild(fill);
    wrap.appendChild(lbl); wrap.appendChild(track);
    return wrap;
  }

  function manaPips(p) {
    var wrap = el('div', 'mana-pips');
    var shown = Math.max(p.maxMana, p.mana);
    for (var i = 0; i < shown; i++) {
      var pip = el('div', 'pip');
      if (i < p.mana) pip.classList.add(i >= p.maxMana ? 'bonus' : 'on');
      wrap.appendChild(pip);
    }
    return wrap;
  }

  function playerStrip(pid, host) {
    host.innerHTML = '';
    var st = G.state, p = st.players[pid];
    var g = E.findGeneral(st, pid);
    var f = D.FACTIONS[p.faction];

    /* 장군 초상 */
    var port = el('div', 'portrait');
    port.style.setProperty('--pcolor', f.color);
    port.style.setProperty('--accent', f.color);
    port.innerHTML = Art.svg(f.general);
    Art.attachImg(port, f.general);
    host.appendChild(port);

    var idbox = el('div');
    var nm = el('div', 'pname', p.name);
    nm.style.color = f.color;
    idbox.appendChild(nm);
    idbox.appendChild(el('div', 'pfaction', f.tag));
    host.appendChild(idbox);

    if (g) host.appendChild(hpBar(g.e));
    host.appendChild(manaPips(p));

    var counts = el('div', 'counts');
    counts.innerHTML = '손패 <b>' + p.hand.length + '</b>  덱 <b>' + p.deck.length + '</b>' +
      (p.fatigue ? '  탈진 <b>' + p.fatigue + '</b>' : '');
    host.appendChild(counts);
  }

  function renderTop() {
    var st = G.state;
    var me = viewPlayer();
    var foe = E.opponentOf(me);
    playerStrip(foe, $('foeStrip'));

    /* 아크 게이지 */
    var meter = $('arkMeter');
    meter.innerHTML = '';
    var holder = E.arkHolder(st);
    var contested = holder ? E.arkContested(st, holder) : false;
    meter.appendChild(el('span', 'ark-label' + (contested ? ' is-contested' : ''),
      contested ? 'ARK 경합!' : 'ARK'));
    ['P1', 'P2'].forEach(function (pid) {
      var side = el('div', 'ark-side');
      side.appendChild(el('span', 'who', pid));
      for (var i = 0; i < D.ARK_TURNS_TO_WIN; i++) {
        var d = el('div', 'ark-dot');
        if (i < st.players[pid].arkCount) d.classList.add(pid === 'P1' ? 'fill1' : 'fill2');
        side.appendChild(d);
      }
      meter.appendChild(side);
    });

    var badge = $('turnBadge');
    badge.className = 'turn-badge ' + (st.current === 'P1' ? 'p1' : 'p2');
    badge.textContent = '턴 ' + st.players[st.current].turnsTaken + ' · ' +
      (isHumanTurn() ? '내 차례'
        : isOnline() ? '상대 차례'
        : (st.players[st.current].isAI ? 'AI 사고 중…' : st.players[st.current].name));

    playerStrip(me, $('meStrip'));
  }

  /* 현재 선택 상태에서 하이라이트 집합을 만든다 */
  function highlights() {
    var h = { move: [], atk: [], deploy: [], target: [], sel: -1 };
    var s = G.sel;
    if (!s || !isHumanTurn()) return h;
    if (s.t === 'unit') { h.move = s.moves; h.atk = s.attacks; h.sel = s.idx; }
    else if (s.t === 'card') {
      if (s.stage === 'cell') h.deploy = s.cells;
      else if (s.stage === 'target') h.target = s.targets;
      else if (s.stage === 'target2') h.target = s.targets2;
    } else if (s.t === 'power') {
      h.target = (s.stage === 'target') ? s.targets : s.targets2;
    } else if (s.t === 'build') h.deploy = s.cells;
    return h;
  }

  function renderBoard() {
    var st = G.state;
    var board = $('board');
    board.innerHTML = '';
    var h = highlights();

    for (var i = 0; i < E.SIZE; i++) {
      var pos = E.rc(i);
      var cell = el('div', 'cell' + (((pos.r + pos.c) % 2) ? ' dark' : ''));
      if (i === E.ARK) cell.classList.add('ark');
      if (h.move.indexOf(i) >= 0) cell.classList.add('hl-move');
      if (h.atk.indexOf(i) >= 0) cell.classList.add('hl-atk');
      if (h.deploy.indexOf(i) >= 0) cell.classList.add('hl-deploy');
      if (h.target.indexOf(i) >= 0) cell.classList.add('hl-target');
      if (i === h.sel) cell.classList.add('selected');

      var e = st.board[i];
      if (e) {
        /* 바닥 그림자 — 기울어진 보드 평면에 그대로 눕는다 (빌보드 유닛과 분리) */
        var sh = el('div', 'ushadow' +
          (e.kind === 'general' ? ' big' : '') +
          (e.owner === 'P1' ? ' side1' : ' side2'));
        cell.appendChild(sh);
        cell.appendChild(unitNode(e, i));
        /* 유닛은 pointer-events:none — 클릭·호버 판정은 평평한 칸이 담당한다.
           기립 유닛이 위 칸을 가리며 클릭을 훔치던 버그의 근본 수정. */
        (function (ent, idx2) {
          cell.addEventListener('mouseenter', function () { inspectEntity(ent, idx2); });
        })(e, i);
      }

      (function (idx) {
        cell.addEventListener('click', function () { onCell(idx); });
      })(i);
      board.appendChild(cell);
    }
  }

  function unitNode(e, idx) {
    var st = G.state;
    var n = el('div', 'unit ' + (e.owner === 'P1' ? 'p1' : 'p2'));
    if (e.kind === 'general') n.classList.add('general');
    if (e.kind === 'structure') n.classList.add('structure');

    var eff = E.effectiveAtk(st, idx);
    var acts = e.owner === st.current &&
      (E.canMove(st, idx) || E.canAttack(st, idx));
    if (acts) n.classList.add('ready');
    else if (e.owner === st.current && e.kind !== 'structure') n.classList.add('spent');
    if (e.kind !== 'structure' && E.adjacentEnemyProvokers(st, idx).length > 0) n.classList.add('provoked');

    var fac = D.FACTIONS[CARDS[e.cardId].faction];
    n.style.setProperty('--accent', fac ? fac.color : '#9aa6c4');

    /* 처음 등장하는 유닛만 팝인.
       백그라운드 탭에서는 애니메이션 타임라인이 멈춰 fill-mode:both 가
       시작 상태(축소)를 붙잡아 두므로, 타이머로 반드시 해제한다. */
    if (!seenUids[e.uid]) {
      seenUids[e.uid] = true;
      n.classList.add('is-new');
      setTimeout(function () { n.classList.remove('is-new'); }, 400);
    }

    var art = el('div', 'art');
    art.innerHTML = Art.svg(e.cardId);
    Art.attachImg(art, e.cardId);
    /* 유닛마다 위아래 흔들림 위상을 어긋나게 해서 기계적으로 보이지 않게 한다 */
    art.style.animationDelay = (-(e.uid % 11) * 0.31).toFixed(2) + 's';
    n.appendChild(art);
    n.appendChild(el('div', 'uname', e.name));

    if (e.kind !== 'structure') {
      var stats = el('div', 'stats');
      var a = el('span', 'a' + (eff > e.baseAtk ? ' buffed' : ''), eff);
      var hp = el('span', 'h' + (e.hp < e.maxHp ? ' hurt' : ''), e.hp);
      stats.appendChild(a); stats.appendChild(hp);
      n.appendChild(stats);
    } else {
      var s2 = el('div', 'stats');
      s2.appendChild(el('span', null, ''));
      s2.appendChild(el('span', 'h' + (e.hp < e.maxHp ? ' hurt' : ''), e.hp));
      n.appendChild(s2);
    }

    if (e.keywords.length) {
      n.appendChild(el('div', 'kw', e.keywords.slice(0, 2).map(function (k) { return k[0]; }).join('')));
    }

    /* 하체 히트박스 — 유닛(회전된 스프라이트)의 발밑 62%가 클릭·호버를 받는다.
       "유닛을 클릭하면 그 유닛"이라는 직관과 일치하고,
       머리 위 영역은 통과시켜 뒤 칸을 가리지 않는다. */
    var hit = el('div', 'uhit');
    hit.addEventListener('click', function (ev) {
      ev.stopPropagation();
      onCell(idx);
    });
    hit.addEventListener('mouseenter', function () {
      inspectEntity(e, idx);
      showUnitTip(e, idx, hit);
    });
    hit.addEventListener('mouseleave', hideCardTip);
    n.appendChild(hit);
    return n;
  }

  function renderHand() {
    var st = G.state;
    var me = viewPlayer();
    var p = st.players[me];
    var host = $('hand');
    host.innerHTML = '';
    hideCardTip();

    p.hand.forEach(function (cardId, hi) {
      var c = CARDS[cardId];
      var node = el('div', 'card' + (c.type === 'spell' ? ' spell' : '') + (c.hero ? ' is-hero' : ''));
      var playable = isHumanTurn() && st.current === me && E.canPlayCard(st, me, hi);
      if (!playable) node.classList.add('unplayable');
      if (G.sel && G.sel.t === 'card' && G.sel.handIndex === hi) node.classList.add('is-sel');

      var cf = D.FACTIONS[c.faction];
      node.style.setProperty('--accent', cf ? cf.color : '#9aa6c4');
      node.appendChild(el('div', 'cost', c.cost));
      var cart = el('div', 'cart');
      cart.innerHTML = Art.svg(c.id);
      Art.attachImg(cart, c.id);
      node.appendChild(cart);
      node.appendChild(el('div', 'cname', c.name));
      node.appendChild(el('div', 'ctype', c.type === 'spell' ? '주문' : '유닛'));
      if (c.type === 'unit') {
        var s = el('div', 'cstats');
        s.appendChild(el('span', 'a', c.atk));
        s.appendChild(el('span', 'h', c.hp));
        node.appendChild(s);
      }

      node.addEventListener('click', function () { onCard(hi); });
      node.addEventListener('mouseenter', function () {
        inspectCard(cardId);
        showCardTip(cardId, node);
      });
      node.addEventListener('mouseleave', hideCardTip);
      host.appendChild(node);
    });
  }

  function renderControls() {
    var st = G.state;
    var me = viewPlayer();
    var p = st.players[me];
    var pw = D.FACTIONS[p.faction].power;
    var myTurn = isHumanTurn() && st.current === me;

    var pb = $('powerBtn');
    pb.innerHTML = '영웅 능력<small>「' + pw.name + '」 · ' + (pw.cost || D.HERO_POWER_COST) + ' 마나</small>';
    pb.disabled = !(myTurn && E.canUseHeroPower(st, me));
    pb.classList.toggle('is-sel', !!(G.sel && G.sel.t === 'power'));

    var bb = $('buildBtn');
    var wait = D.STRUCTURE_COOLDOWN - (p.turnsTaken - p.lastBuildTurn);
    bb.innerHTML = '거점 건설<small>' +
      (wait > 0 ? '재건설까지 ' + wait + '턴' : D.STRUCTURE_COST + ' 마나') + '</small>';
    bb.disabled = !(myTurn && E.canBuild(st, me));
    bb.classList.toggle('is-sel', !!(G.sel && G.sel.t === 'build'));

    var mb = $('mullBtn');
    mb.innerHTML = '카드 교환<small>' + (p.mulliganUsed ? '이번 턴 사용함' : '턴당 1회 · 무료') + '</small>';
    mb.disabled = !(myTurn && E.canMulligan(st, me));
    mb.classList.toggle('is-sel', !!(G.sel && G.sel.t === 'mull'));

    $('endBtn').disabled = !myTurn;
  }

  function renderLog() {
    var host = $('log');
    host.innerHTML = '';
    G.state.log.slice(-70).forEach(function (l) {
      var cls = l.side;
      if (l.text.indexOf('소환') >= 0 || l.text.indexOf('생산') >= 0) cls += ' log-summon';
      else if (l.text.indexOf('피해') >= 0 || l.text.indexOf('파괴') >= 0) cls += ' log-dmg';
      else if (l.text.indexOf('시전') >= 0 || l.text.indexOf('연성') >= 0) cls += ' log-spell';
      else if (l.text.indexOf('승리') >= 0 || l.text.indexOf('선공') >= 0) cls += ' log-key';
      host.appendChild(el('div', cls, l.text));
    });
    host.scrollTop = host.scrollHeight;
  }

  function renderPrompt() {
    var s = G.sel, box = $('prompt');
    var msg = null;
    if (s && isHumanTurn()) {
      if (s.t === 'card' && s.stage === 'cell') msg = '소환할 칸을 선택하세요';
      else if (s.t === 'card' && s.stage === 'target') msg = '「' + CARDS[s.cardId].name + '」 대상을 선택하세요';
      else if (s.t === 'card' && s.stage === 'target2') msg = '이동시킬 빈 칸을 선택하세요';
      else if (s.t === 'power' && s.stage === 'target') msg = '영웅 능력의 대상을 선택하세요';
      else if (s.t === 'power' && s.stage === 'target2') msg = '이동시킬 빈 칸을 선택하세요';
      else if (s.t === 'build') msg = '거점을 세울 칸을 선택하세요';
      else if (s.t === 'mull') msg = '덱과 교환할 카드를 선택하세요';
    }
    if (!msg) { box.hidden = true; return; }
    box.innerHTML = '';
    box.appendChild(el('span', null, msg));
    var c = el('button', 'cancel', '취소');
    c.addEventListener('click', function () { clearSel(); render(); });
    box.appendChild(c);
    box.hidden = false;
  }

  /* ═════════ 상대 카드 공개 연출 ═════════ */
  var revealTimer = null;
  function showCardReveal(cardId) {
    var box = $('cardReveal'), inner = $('crInner');
    if (!box || !inner) return;
    var c = CARDS[cardId];
    if (!c) return;
    var fac = D.FACTIONS[c.faction];
    inner.style.setProperty('--accent', fac ? fac.color : '#9aa6c4');
    inner.innerHTML =
      '<div class="cr-cost">' + c.cost + '</div>' +
      '<div class="cr-art">' + Art.svg(cardId) + '</div>' +
      '<div class="cr-name">' + c.name + '</div>' +
      (c.type === 'unit'
        ? '<div class="cr-stats"><span class="a">' + c.atk + '</span><span class="h">' + c.hp + '</span></div>'
        : '<div class="cr-type">주문</div>') +
      '<div class="cr-text">' + (c.text || '') + '</div>';
    box.hidden = false;
    box.classList.remove('is-out');
    Art.attachImg(inner.querySelector('.cr-art'), cardId);
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(function () {
      box.classList.add('is-out');
      revealTimer = setTimeout(function () { box.hidden = true; }, 300);
    }, 1200);
  }

  /* ═════════ 날씨 파티클 — 테마별 분위기 ═════════ */
  var WEATHER = {
    grass:   { type: 'firefly', count: 16 },
    desert:  { type: 'sand',    count: 14 },
    ice:     { type: 'snow',    count: 30 },
    volcano: { type: 'ember',   count: 22 },
    dusk:    { type: 'spore',   count: 18 }
  };

  function buildWeather(themeId) {
    var layer = $('weatherLayer');
    if (!layer) return;
    if (layer.dataset.w === themeId) return;
    layer.dataset.w = themeId;
    layer.innerHTML = '';
    var cfg = WEATHER[themeId] || WEATHER.grass;
    for (var i = 0; i < cfg.count; i++) {
      var p = el('div', 'wp wp-' + cfg.type);
      p.style.left = (Math.random() * 100) + '%';
      p.style.top = (Math.random() * 100) + '%';
      p.style.animationDelay = (-Math.random() * 14) + 's';
      p.style.animationDuration = (6 + Math.random() * 10) + 's';
      var sc = 0.6 + Math.random() * 0.9;
      p.style.setProperty('--ws', sc.toFixed(2));
      layer.appendChild(p);
    }
  }

  /* ═════════ 카드 툴팁 (손패 호버) ═════════ */
  function showCardTip(cardId, anchor) {
    var tip = $('cardTip');
    if (!tip) return;
    var c = CARDS[cardId];
    var fac = D.FACTIONS[c.faction];
    var kw = (c.keywords || []).map(function (k) {
      return '<div class="tip-kw"><b>' + k + '</b> ' + (D.KW_DESC[k] || '') + '</div>';
    }).join('');
    tip.innerHTML =
      '<div class="tip-head"><span class="tip-cost">' + c.cost + '</span>' +
      '<span class="tip-name" style="color:' + (fac ? fac.color : '#cfd6e8') + '">' + c.name + '</span>' +
      '<span class="tip-type">' + (c.hero ? '영웅 유닛' : (c.type === 'spell' ? '주문' : '유닛')) + '</span></div>' +
      (c.type === 'unit'
        ? '<div class="tip-stats">공격 <b>' + c.atk + '</b> · 체력 <b>' + c.hp +
          '</b> · 기동 <b>' + c.mv + '</b> · 사거리 <b>' + c.rng + '</b></div>'
        : '') +
      '<div class="tip-text">' + (c.text || '') + '</div>' + kw;
    tip.hidden = false;
    var r = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var y = Math.max(8, r.top - th - 10);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideCardTip() {
    var tip = $('cardTip');
    if (tip) tip.hidden = true;
  }

  /* 보드 위 유닛의 실시간 정보 툴팁 — 현재 HP·오라 보정 공격력 반영 */
  function showUnitTip(e, idx, anchor) {
    var tip = $('cardTip');
    if (!tip || !G.state) return;
    var c = CARDS[e.cardId];
    var fac = D.FACTIONS[c.faction];
    var eff = E.effectiveAtk(G.state, idx);
    var mine = G.state.current === e.owner;
    var status = '';
    if (e.kind !== 'structure' && mine) {
      var bits = [];
      if (e.summonSick) bits.push('소환 멀미');
      else {
        bits.push(E.canMove(G.state, idx) ? '이동 가능' : '이동 완료');
        bits.push(E.canAttack(G.state, idx) ? '공격 가능' : '공격 완료');
      }
      if (E.adjacentEnemyProvokers(G.state, idx).length) bits.push('도발에 묶임');
      status = '<div class="tip-status">' + bits.join(' · ') + '</div>';
    }
    var kw = (e.keywords || []).map(function (k) {
      return '<div class="tip-kw"><b>' + k + '</b> ' + (D.KW_DESC[k] || '') + '</div>';
    }).join('');
    tip.innerHTML =
      '<div class="tip-head">' +
      '<span class="tip-name" style="color:' + (fac ? fac.color : '#cfd6e8') + '">' + e.name + '</span>' +
      '<span class="tip-type">' + (e.owner === (G.netRole || 'P1') && G.config.mode !== 'local'
        ? '아군' : (G.config.mode === 'local' ? e.owner : '적군')) + '</span></div>' +
      (e.kind !== 'structure'
        ? '<div class="tip-stats">공격 <b>' + eff + (eff !== e.baseAtk ? ' (기본 ' + e.baseAtk + ')' : '') +
          '</b> · 체력 <b>' + e.hp + '/' + e.maxHp + '</b> · 기동 <b>' + e.mv +
          '</b> · 사거리 <b>' + e.rng + '</b></div>'
        : '<div class="tip-stats">내구도 <b>' + e.hp + '/' + e.maxHp + '</b></div>') +
      '<div class="tip-text">' + (c.text || '') + '</div>' + kw + status;
    tip.hidden = false;
    var r = anchor.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2));
    var y = r.top - th - 14;
    if (y < 8) y = r.bottom + 10;      /* 위 공간이 없으면 아래로 */
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  /* ═════════ 상세 정보 패널 ═════════ */
  function kwBlock(keywords) {
    if (!keywords || !keywords.length) return null;
    var box = el('div', 'insp-kw');
    keywords.forEach(function (k) {
      var d = el('div');
      d.innerHTML = '<b>' + k + '</b> — ' + (D.KW_DESC[k] || '');
      box.appendChild(d);
    });
    return box;
  }

  function inspectEntity(e, idx) {
    var c = CARDS[e.cardId];
    var host = $('inspector');
    host.innerHTML = '';
    var nm = el('div', 'insp-name', e.name);
    var fac = D.FACTIONS[c.faction];
    if (fac) nm.style.color = fac.color;
    host.appendChild(nm);
    host.appendChild(el('div', 'insp-sub',
      (fac ? fac.name + ' · ' : '중립 · ') +
      (e.kind === 'general' ? '장군' : e.kind === 'structure' ? '거점' : '유닛')));

    var stats = el('div', 'insp-stats');
    var eff = E.effectiveAtk(G.state, idx);
    if (e.kind !== 'structure') {
      stats.innerHTML =
        '<span>공격 <b>' + eff + (eff !== e.baseAtk ? ' (기본 ' + e.baseAtk + ')' : '') + '</b></span>' +
        '<span>체력 <b>' + e.hp + '/' + e.maxHp + '</b></span>' +
        '<span>기동 <b>' + e.mv + '</b></span>' +
        '<span>사거리 <b>' + e.rng + '</b></span>';
    } else {
      stats.innerHTML = '<span>내구도 <b>' + e.hp + '/' + e.maxHp + '</b></span>';
    }
    host.appendChild(stats);
    host.appendChild(el('div', 'insp-text', c.text || ''));
    var kb = kwBlock(e.keywords);
    if (kb) host.appendChild(kb);

    if (e.kind !== 'structure' && e.owner === G.state.current) {
      var status = [];
      if (e.summonSick) status.push('소환 멀미 — 이번 턴 행동 불가');
      else {
        status.push(E.canMove(G.state, idx) ? '이동 가능' : '이동 완료');
        status.push(E.canAttack(G.state, idx) ? '공격 가능 (' + e.attacksLeft + '회)' : '공격 완료');
      }
      if (E.adjacentEnemyProvokers(G.state, idx).length) status.push('도발에 묶임');
      host.appendChild(el('div', 'insp-text', '· ' + status.join(' / ')));
    }
  }

  function inspectCard(cardId) {
    var c = CARDS[cardId];
    var host = $('inspector');
    host.innerHTML = '';
    var nm = el('div', 'insp-name', c.name);
    var fac = D.FACTIONS[c.faction];
    if (fac) nm.style.color = fac.color;
    host.appendChild(nm);
    host.appendChild(el('div', 'insp-sub',
      (fac ? fac.name : '중립') + ' · ' + (c.type === 'spell' ? '주문' : '유닛') + ' · ' + c.cost + ' 마나'));

    if (c.type === 'unit') {
      var stats = el('div', 'insp-stats');
      stats.innerHTML =
        '<span>공격 <b>' + c.atk + '</b></span>' +
        '<span>체력 <b>' + c.hp + '</b></span>' +
        '<span>기동 <b>' + c.mv + '</b></span>' +
        '<span>사거리 <b>' + c.rng + '</b></span>';
      host.appendChild(stats);
    }
    host.appendChild(el('div', 'insp-text', c.text || ''));
    var kb = kwBlock(c.keywords);
    if (kb) host.appendChild(kb);
  }

  /* ═════════ 입력 처리 ═════════ */
  function selectUnit(idx) {
    var st = G.state;
    G.sel = {
      t: 'unit', idx: idx,
      moves: E.movesFor(st, idx),
      attacks: E.attacksFor(st, idx)
    };
  }

  function afterAction() {
    clearSel();
    render();
    if (G.state.winner) showResult();
  }

  /* ── 사운드 보조 ── */
  function boardCount() {
    var n = 0;
    for (var i = 0; i < E.SIZE; i++) if (G.state.board[i]) n++;
    return n;
  }
  /* 무언가 파괴됐으면 살짝 늦게 파괴음을 얹는다 */
  function sfxDeaths(before) {
    if (boardCount() < before) setTimeout(function () { sfx('death'); }, 110);
  }
  /* 공격 사운드 — 원거리면 다른 소리를 낸다 */
  function sfxAttack(fromIdx) {
    var a = G.state.board[fromIdx];
    sfx(a && a.rng > 1 ? 'ranged' : 'attack');
  }

  function onCell(idx) {
    if (!isHumanTurn()) return;
    var st = G.state, me = st.current, s = G.sel;

    if (s) {
      if (s.t === 'card') {
        var card = CARDS[s.cardId];
        if (s.stage === 'cell' && s.cells.indexOf(idx) >= 0) {
          if (card.target) {
            var tg = E.validTargets(st, me, card.target);
            if (!tg.length) { doPlay({ cell: idx }); return; }   /* 대상 없음 — 효과 불발, 소환은 진행 */
            s.cell = idx; s.stage = 'target';
            s.targets = tg;
            render(); return;
          }
          doPlay({ cell: idx }); return;
        }
        if (s.stage === 'target' && s.targets.indexOf(idx) >= 0) {
          if (card.target2 === 'emptyCell') {
            s.target = idx; s.stage = 'target2';
            s.targets2 = E.validTargets(st, me, 'emptyCell');
            render(); return;
          }
          doPlay({ cell: s.cell, target: idx }); return;
        }
        if (s.stage === 'target2' && s.targets2.indexOf(idx) >= 0) {
          doPlay({ cell: s.cell, target: s.target, target2: idx }); return;
        }
      }

      if (s.t === 'power') {
        var pw = D.FACTIONS[st.players[me].faction].power;
        if (s.stage === 'target' && s.targets.indexOf(idx) >= 0) {
          if (pw.target2 === 'emptyCell') {
            s.target = idx; s.stage = 'target2';
            s.targets2 = E.validTargets(st, me, 'emptyCell').filter(function (x) {
              return E.cheb(idx, x) <= pw.range;
            });
            render(); return;
          }
          var b1 = boardCount();
          markFx(null);
          if (E.useHeroPower(st, me, { target: idx })) netEmit('useHeroPower', [me, { target: idx }]);
          sfx('power'); sfxDeaths(b1);
          afterAction(); return;
        }
        if (s.stage === 'target2' && s.targets2.indexOf(idx) >= 0) {
          if (E.useHeroPower(st, me, { target: s.target, target2: idx })) netEmit('useHeroPower', [me, { target: s.target, target2: idx }]);
          sfx('power');
          afterAction(); return;
        }
      }

      if (s.t === 'build' && s.cells.indexOf(idx) >= 0) {
        markFx(null);
        if (E.buildStructure(st, me, s.structureId, idx)) netEmit('buildStructure', [me, s.structureId, idx]);
        sfx('build');
        afterAction(); return;
      }

      if (s.t === 'unit') {
        if (s.moves.indexOf(idx) >= 0) {
          markFx(null);
          if (E.moveUnit(st, s.idx, idx)) netEmit('moveUnit', [s.idx, idx]);
          sfx('move');
          selectUnit(idx);
          render(); return;
        }
        if (s.attacks.indexOf(idx) >= 0) {
          var b2 = boardCount();
          sfxAttack(s.idx);
          markFx(s.idx);
          spawnSlash(idx);
          if (E.attackWith(st, s.idx, idx)) netEmit('attackWith', [s.idx, idx]);
          sfxDeaths(b2);
          afterAction(); return;
        }
      }
    }

    /* 카드/대상 지정 중의 잘못된 클릭은 선택을 유지한다 — 취소는 취소 버튼/ESC/카드 재클릭 */
    if (s && s.t === 'card' && s.stage === 'cell') {
      sfx('error');
      return;
    }
    if (s && (s.stage === 'target' || s.stage === 'target2')) {
      sfx('error');
      return;
    }

    var e = st.board[idx];
    if (e && e.owner === me && e.kind !== 'structure') {
      selectUnit(idx); render(); return;
    }
    clearSel(); render();
  }

  function doPlay(opts) {
    var st = G.state;
    var cardId = G.sel.cardId;
    var before = boardCount();
    markFx(null);
    var hiPlay = G.sel.handIndex;
    var playedCard = CARDS[G.sel.cardId];
    var myFac = D.FACTIONS[st.players[st.current].faction];
    if (E.playCard(st, st.current, hiPlay, opts)) {
      netEmit('playCard', [viewPlayer(), hiPlay, opts]);
      if (playedCard.type === 'spell' && opts.target != null) spawnSpellFx(opts.target);
      if (playedCard.type === 'unit' && opts.cell != null) spawnSummonFx(opts.cell, myFac.color);
    }
    sfx(CARDS[cardId].type === 'unit' ? 'summon' : 'spell');
    sfxDeaths(before);
    afterAction();
  }

  function onCard(hi) {
    if (!isHumanTurn()) return;
    var st = G.state, me = st.current;
    /* 카드 교환 모드 — 클릭한 카드를 덱과 교환 */
    if (G.sel && G.sel.t === 'mull') {
      if (E.mulliganCard(st, me, hi)) { netEmit('mulliganCard', [me, hi]); sfx('draw'); afterAction(); }
      else sfx('error');
      return;
    }
    if (G.sel && G.sel.t === 'card' && G.sel.handIndex === hi) { clearSel(); sfx('cancel'); render(); return; }
    if (!E.canPlayCard(st, me, hi)) { sfx('error'); return; }
    sfx('select');

    var cardId = st.players[me].hand[hi];
    var card = CARDS[cardId];

    if (card.type === 'unit') {
      G.sel = { t: 'card', handIndex: hi, cardId: cardId, stage: 'cell',
                cells: E.deployCells(st, me), targets: [], targets2: [] };
    } else {
      var tk = E.cardTargetKind(card);
      if (tk === 'none') {
        G.sel = { t: 'card', handIndex: hi, cardId: cardId };
        doPlay({}); return;
      }
      G.sel = { t: 'card', handIndex: hi, cardId: cardId, stage: 'target',
                cells: [], targets: E.validTargets(st, me, tk), targets2: [] };
    }
    render();
  }

  function onPower() {
    if (!isHumanTurn()) return;
    var st = G.state, me = st.current;
    if (G.sel && G.sel.t === 'power') { clearSel(); sfx('cancel'); render(); return; }
    if (!E.canUseHeroPower(st, me)) { sfx('error'); return; }
    var pw = D.FACTIONS[st.players[me].faction].power;
    if (pw.target === 'none') { markFx(null); if (E.useHeroPower(st, me, {})) netEmit('useHeroPower', [me, {}]); sfx('power'); afterAction(); return; }
    sfx('select');
    G.sel = { t: 'power', stage: 'target', targets: E.validTargets(st, me, pw.target), targets2: [] };
    render();
  }

  function onMulligan() {
    if (!isHumanTurn()) return;
    var st = G.state, me = st.current;
    if (G.sel && G.sel.t === 'mull') { clearSel(); sfx('cancel'); render(); return; }
    if (!E.canMulligan(st, me)) { sfx('error'); return; }
    G.sel = { t: 'mull' };
    sfx('select');
    render();
  }

  function onBuildClick() {
    if (!isHumanTurn()) return;
    var st = G.state, me = st.current;
    if (!E.canBuild(st, me)) return;
    var picker = $('buildPicker');
    if (!picker.hidden) { picker.hidden = true; return; }
    picker.innerHTML = '';
    D.STRUCTURE_IDS.forEach(function (sid) {
      var c = CARDS[sid];
      var b = el('button', 'st');
      b.innerHTML = '<span class="sglyph">' + c.art + '</span>' +
        '<div class="sname">' + c.name + '</div>' +
        '<div class="stext">' + c.text + '</div>';
      b.addEventListener('click', function () {
        picker.hidden = true;
        G.sel = { t: 'build', structureId: sid, cells: E.deployCells(st, me) };
        render();
      });
      picker.appendChild(b);
    });
    picker.hidden = false;
  }

  function onEndTurn() {
    if (!isHumanTurn()) return;
    $('buildPicker').hidden = true;
    clearSel();
    var arkBefore = G.state.players[E.opponentOf(G.state.current)].arkCount;
    markFx(null);
    E.endTurn(G.state);
    netEmit('endTurn', []);
    sfx('turn');
    if (G.state.players[G.state.current].arkCount > arkBefore) setTimeout(function () { sfx('ark'); }, 220);
    render();
    if (G.state.winner) { showResult(); return; }
    maybeRunAI();
  }

  /* ═════════ AI 구동 ═════════ */
  function maybeRunAI() {
    var st = G.state;
    if (!st || st.winner) { if (st && st.winner) showResult(); return; }
    if (!st.players[st.current].isAI) return;

    G.aiTimer = setTimeout(function () {
      var act = RG.AI.nextAction(st, G.config.difficulty);
      if (!act) {
        var arkBefore = st.players[E.opponentOf(st.current)].arkCount;
        markFx(null);
        E.endTurn(st);
        sfx('turn');
        if (st.players[st.current].arkCount > arkBefore) setTimeout(function () { sfx('ark'); }, 220);
        render();
        if (st.winner) { showResult(); return; }
        maybeRunAI();
        return;
      }

      var before = boardCount();
      if (act.kind === 'attack') { sfxAttack(act.from); spawnSlash(act.target); }
      if (act.kind === 'play') {
        showCardReveal(act.cardId);              /* 상대가 낸 카드를 크게 보여준다 */
        var aiFac = D.FACTIONS[st.players[st.current].faction];
        if (CARDS[act.cardId].type === 'spell' && act.target != null) spawnSpellFx(act.target);
        if (CARDS[act.cardId].type === 'unit' && act.cell != null) spawnSummonFx(act.cell, aiFac.color);
      }
      markFx(act.kind === 'attack' ? act.from : null);
      E.applyAction(st, act);
      if (act.kind === 'play') sfx(CARDS[act.cardId].type === 'unit' ? 'summon' : 'spell');
      else if (act.kind === 'power') sfx('power');
      else if (act.kind === 'build') sfx('build');
      else if (act.kind === 'move') sfx('move');
      sfxDeaths(before);

      render();
      if (st.winner) { showResult(); return; }
      maybeRunAI();
    }, 380);
  }

  /* ═════════ 결과 ═════════ */
  function showResult() {
    if (G.aiTimer) { clearTimeout(G.aiTimer); G.aiTimer = null; }
    var st = G.state;
    var w = st.winner;
    var reason = st.winReason === 'ark' ? '아크 점령' : '장군 격파';
    var human = G.config.mode === 'ai'
      ? (w === 'P1' ? '승리' : '패배')
      : st.players[w].name + ' 승리';
    $('resultTitle').textContent = G.config.mode === 'ai' ? human : '전투 종료';
    $('resultText').textContent =
      st.players[w].name + ' 이(가) ' + reason + '(으)로 승리했습니다. (총 ' + st.turnCount + '턴)';
    $('overlay').hidden = false;
    sfx(G.config.mode === 'ai' ? (w === 'P1' ? 'win' : 'lose') : 'win');
  }

  RG.UI = { init: function () { buildMenu(); }, _G: G,
    showCardTip: showCardTip, hideCardTip: hideCardTip };
})(window);

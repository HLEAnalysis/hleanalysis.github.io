/* RUNEGUARD — 규칙 엔진 v0.2
   Duelyst식 보드 전술 + Hearthstone식 자원/영웅 능력.
   상태는 순수 데이터로 유지해 AI가 복제 후 시뮬레이션할 수 있게 한다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};
  var D = RG.Data;
  var COLS = D.COLS, ROWS = D.ROWS, KW = D.KW, CARDS = D.CARDS;
  var SIZE = COLS * ROWS;
  var ARK = D.ARK_INDEX;

  /* ═════════════ 시드 난수 (mulberry32) ═════════════
     게임 규칙에 관여하는 모든 무작위는 반드시 이 함수를 쓴다.
     양쪽 클라이언트가 같은 시드로 같은 결과를 얻어야 온라인 동기화가 성립한다. */
  function rngNext(state) {
    var t = state.rngState = (state.rngState + 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* ═════════════ 좌표 ═════════════ */
  function rc(i) { return { r: Math.floor(i / COLS), c: i % COLS }; }
  function toIdx(r, c) { return r * COLS + c; }
  function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function cheb(a, b) {
    var pa = rc(a), pb = rc(b);
    return Math.max(Math.abs(pa.r - pb.r), Math.abs(pa.c - pb.c));
  }
  function manhattan(a, b) {
    var pa = rc(a), pb = rc(b);
    return Math.abs(pa.r - pb.r) + Math.abs(pa.c - pb.c);
  }
  function opponentOf(p) { return p === 'P1' ? 'P2' : 'P1'; }

  function neighbors8(i) {
    var p = rc(i), out = [];
    for (var d = 0; d < D.DIR_ALL.length; d++) {
      var nr = p.r + D.DIR_ALL[d][0], nc = p.c + D.DIR_ALL[d][1];
      if (inBoard(nr, nc)) out.push(toIdx(nr, nc));
    }
    return out;
  }

  /* ═════════════ 빠른 상태 복제 (JSON보다 훨씬 빠름) ═════════════ */
  function cloneEntity(e) {
    if (!e) return null;
    return {
      uid: e.uid, cardId: e.cardId, name: e.name, art: e.art, kind: e.kind, owner: e.owner,
      atk: e.atk, baseAtk: e.baseAtk, hp: e.hp, maxHp: e.maxHp, mv: e.mv, rng: e.rng,
      keywords: e.keywords.slice(),
      hasMoved: e.hasMoved, attacksLeft: e.attacksLeft, hasAttacked: e.hasAttacked,
      summonSick: e.summonSick
    };
  }
  function clonePlayer(p) {
    return {
      name: p.name, faction: p.faction, isAI: p.isAI,
      mana: p.mana, maxMana: p.maxMana, bonusMana: p.bonusMana,
      deck: p.deck.slice(), hand: p.hand.slice(),
      fatigue: p.fatigue, heroPowerUsed: p.heroPowerUsed, mulliganUsed: p.mulliganUsed,
      turnsTaken: p.turnsTaken, lastBuildTurn: p.lastBuildTurn,
      arkCount: p.arkCount
    };
  }
  function cloneState(s) {
    var board = new Array(SIZE);
    for (var i = 0; i < SIZE; i++) board[i] = cloneEntity(s.board[i]);
    return {
      board: board,
      players: { P1: clonePlayer(s.players.P1), P2: clonePlayer(s.players.P2) },
      current: s.current, turnCount: s.turnCount,
      winner: s.winner, winReason: s.winReason,
      rngState: s.rngState, nextUid: s.nextUid, theme: s.theme,
      log: []                      /* 시뮬레이션에서는 로그를 버린다 */
    };
  }

  /* ═════════════ 로그 ═════════════ */
  function pushLog(state, text, side) {
    if (!state.log) return;
    state.log.push({ text: text, side: side || 'system' });
    if (state.log.length > 240) state.log.shift();
  }

  /* ═════════════ 엔티티 생성 ═════════════ */
  /* uid 는 반드시 상태에서 발급한다 — 전역 카운터를 쓰면 AI 시뮬레이션이나
     다른 게임 인스턴스가 카운터를 오염시켜 온라인 동기화가 깨진다. */
  function makeEntity(state, cardId, owner) {
    var c = CARDS[cardId];
    var kind = c.type === 'general' ? 'general' : (c.type === 'structure' ? 'structure' : 'unit');
    return {
      uid: state.nextUid++,
      cardId: cardId, name: c.name, art: c.art, kind: kind, owner: owner,
      atk: c.atk, baseAtk: c.atk, hp: c.hp, maxHp: c.hp,
      mv: c.mv, rng: c.rng,
      keywords: (c.keywords || []).slice(),
      hasMoved: false,
      attacksLeft: 0,
      hasAttacked: false,
      summonSick: (c.keywords || []).indexOf(KW.CHARGE) < 0
    };
  }

  function maxAttacks(e) { return e.keywords.indexOf(KW.SWIFT) >= 0 ? 2 : 1; }

  /* ═════════════ 게임 생성 ═════════════ */
  function shuffle(a, rand) {
    rand = rand || Math.random;
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* 유효하지 않은 덱은 조용히 기본 덱으로 대체한다 (온라인 수신 방어 포함) */
  function sanitizeDeck(factionId, list) {
    return (list && D.validateDeck(factionId, list).ok) ? list.slice() : D.buildDeck(factionId);
  }

  function makePlayer(name, factionId, isAI, deckList) {
    return {
      name: name, faction: factionId, isAI: !!isAI,
      mana: 0, maxMana: 0, bonusMana: 0,
      deck: sanitizeDeck(factionId, deckList), hand: [],   /* 셔플은 createGame 에서 시드 난수로 */
      fatigue: 0, heroPowerUsed: false, mulliganUsed: false,
      turnsTaken: 0, lastBuildTurn: -99,
      arkCount: 0
    };
  }

  function createGame(opts) {
    opts = opts || {};
    var f1 = opts.p1Faction || 'exile';
    var f2 = opts.p2Faction || 'demon';

    var state = {
      board: new Array(SIZE).fill(null),
      players: {
        P1: makePlayer(opts.p1Name || D.FACTIONS[f1].name + ' 진영', f1, !!opts.p1AI, opts.p1Deck),
        P2: makePlayer(opts.p2Name || D.FACTIONS[f2].name + ' 진영', f2, opts.p2AI !== false, opts.p2Deck)
      },
      current: 'P1', turnCount: 1, winner: null, winReason: null,
      rngState: (opts.seed != null ? opts.seed : Math.floor(Math.random() * 0x7fffffff)) | 0,
      nextUid: 1,
      log: []
    };
    var rng = function () { return rngNext(state); };

    /* 지형과 선공을 시드에서 결정 — 온라인에서 양쪽이 같은 결과를 본다 */
    state.theme = Math.floor(rngNext(state) * D.THEMES.length);
    var first = rngNext(state) < 0.5 ? 'P1' : 'P2';
    var second = opponentOf(first);
    state.current = first;

    shuffle(state.players.P1.deck, rng);
    shuffle(state.players.P2.deck, rng);

    state.board[toIdx(2, 0)] = makeEntity(state, D.FACTIONS[f1].general, 'P1');
    state.board[toIdx(2, COLS - 1)] = makeEntity(state, D.FACTIONS[f2].general, 'P2');

    drawCards(state, first, 3, true);        /* 선공 3장 */
    drawCards(state, second, 4, true);       /* 후공 4장 + 선제 보급 */
    state.players[second].hand.push('n_coin');

    pushLog(state, '전장 — ' + D.THEMES[state.theme].name, 'system');
    pushLog(state, '전투 개시 — ' + state.players.P1.name + ' vs ' + state.players.P2.name, 'system');
    pushLog(state, '동전 던지기 — ' + state.players[first].name + ' 선공!', 'system');
    startTurn(state);
    return state;
  }

  /* ═════════════ 조회 ═════════════ */
  function findGeneral(state, owner) {
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (e && e.owner === owner && e.kind === 'general') return { e: e, idx: i };
    }
    return null;
  }
  function entitiesOf(state, owner) {
    var out = [];
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (e && e.owner === owner) out.push({ e: e, idx: i });
    }
    return out;
  }
  function findByUid(state, uid) {
    for (var i = 0; i < SIZE; i++) if (state.board[i] && state.board[i].uid === uid) return i;
    return -1;
  }

  /* ═════════════ 오라 ═════════════ */
  function effectiveAtk(state, idx) {
    var e = state.board[idx];
    if (!e) return 0;
    var bonus = 0;
    var nb = neighbors8(idx);
    for (var i = 0; i < nb.length; i++) {
      var n = state.board[nb[i]];
      if (!n || n.owner !== e.owner) continue;
      var aura = CARDS[n.cardId].aura;
      if (aura && aura.atk) bonus += aura.atk;
    }
    return e.atk + bonus;
  }

  function spellPower(state, owner) {
    var bonus = 0;
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (!e || e.owner !== owner) continue;
      var aura = CARDS[e.cardId].aura;
      if (aura && aura.spellPower) bonus += aura.spellPower;
    }
    return bonus;
  }

  /* ═════════════ 도발 ═════════════ */
  function adjacentEnemyProvokers(state, idx) {
    var e = state.board[idx];
    if (!e) return [];
    var out = [];
    var nb = neighbors8(idx);
    for (var i = 0; i < nb.length; i++) {
      var n = state.board[nb[i]];
      if (n && n.owner !== e.owner && n.keywords.indexOf(KW.PROVOKE) >= 0) out.push(nb[i]);
    }
    return out;
  }

  /* ═════════════ 이동 / 공격 계산 ═════════════ */
  function canMove(state, idx) {
    var e = state.board[idx];
    if (!e || state.winner) return false;
    if (e.owner !== state.current) return false;
    if (e.kind === 'structure') return false;
    if (e.summonSick || e.hasMoved || e.hasAttacked) return false;
    if (e.mv <= 0) return false;
    return true;
  }

  function canAttack(state, idx) {
    var e = state.board[idx];
    if (!e || state.winner) return false;
    if (e.owner !== state.current) return false;
    if (e.kind === 'structure') return false;
    if (e.summonSick || e.attacksLeft <= 0) return false;
    if (e.rng <= 0) return false;
    return true;
  }

  function movesFor(state, idx) {
    if (!canMove(state, idx)) return [];
    var e = state.board[idx];
    if (adjacentEnemyProvokers(state, idx).length > 0) return [];   /* 도발에 묶임 */

    var out = [];
    if (e.keywords.indexOf(KW.LEAP) >= 0) {
      var p = rc(idx);
      for (var k = 0; k < D.LEAP_OFFSETS.length; k++) {
        var nr = p.r + D.LEAP_OFFSETS[k][0], nc = p.c + D.LEAP_OFFSETS[k][1];
        if (!inBoard(nr, nc)) continue;
        var ni = toIdx(nr, nc);
        if (!state.board[ni]) out.push(ni);
      }
      return out;
    }

    if (e.keywords.indexOf(KW.FLYING) >= 0) {
      for (var i = 0; i < SIZE; i++) {
        if (i === idx || state.board[i]) continue;
        if (manhattan(idx, i) <= e.mv) out.push(i);
      }
      return out;
    }

    /* 지상 유닛 — 빈 칸만 통과하는 BFS */
    var dist = new Array(SIZE).fill(-1);
    dist[idx] = 0;
    var queue = [idx];
    while (queue.length) {
      var cur = queue.shift();
      if (dist[cur] >= e.mv) continue;
      var pc = rc(cur);
      for (var d = 0; d < D.DIR_ORTHO.length; d++) {
        var r2 = pc.r + D.DIR_ORTHO[d][0], c2 = pc.c + D.DIR_ORTHO[d][1];
        if (!inBoard(r2, c2)) continue;
        var n2 = toIdx(r2, c2);
        if (dist[n2] !== -1) continue;
        var occ = state.board[n2];
        if (occ && occ.kind !== 'structure') continue;   /* 유닛은 막지만 거점은 통과 */
        dist[n2] = dist[cur] + 1;
        if (!occ) out.push(n2);                          /* 거점 칸에는 착지 불가 */
        queue.push(n2);
      }
    }
    return out;
  }

  function attacksFor(state, idx) {
    if (!canAttack(state, idx)) return [];
    var e = state.board[idx];
    var provokers = adjacentEnemyProvokers(state, idx);
    var out = [];
    for (var i = 0; i < SIZE; i++) {
      var t = state.board[i];
      if (!t || t.owner === e.owner) continue;
      if (cheb(idx, i) > e.rng) continue;
      out.push(i);
    }
    if (provokers.length > 0) {
      out = out.filter(function (i) { return provokers.indexOf(i) >= 0; });
    }
    return out;
  }

  /* ═════════════ 피해 / 사망 ═════════════ */
  function applyDamage(state, idx, amount, ignoreBulwark) {
    var e = state.board[idx];
    if (!e || amount <= 0) return 0;
    var dmg = amount;
    if (!ignoreBulwark && e.keywords.indexOf(KW.BULWARK) >= 0) dmg = Math.max(0, dmg - 1);
    e.hp -= dmg;
    return dmg;
  }

  function healEntity(state, idx, amount) {
    var e = state.board[idx];
    if (!e) return 0;
    var before = e.hp;
    e.hp = Math.min(e.maxHp, e.hp + amount);
    return e.hp - before;
  }

  /* 사망 처리 — 유언 발동 포함. 연쇄를 대비해 반복한다. */
  function cleanupDeaths(state) {
    var guard = 0;
    while (guard++ < 8) {
      var deadIdx = -1;
      for (var i = 0; i < SIZE; i++) {
        if (state.board[i] && state.board[i].hp <= 0) { deadIdx = i; break; }
      }
      if (deadIdx < 0) return;

      var e = state.board[deadIdx];
      state.board[deadIdx] = null;
      pushLog(state, e.name + ' 파괴됨.', e.owner);

      if (e.kind === 'general') {
        if (!state.winner) {
          state.winner = opponentOf(e.owner);
          state.winReason = 'general';
          pushLog(state, state.players[state.winner].name + ' 승리! (장군 격파)', 'system');
        }
        return;
      }
      var card = CARDS[e.cardId];
      if (card.onDeath) {
        resolveEffect(state, { owner: e.owner, sourceIdx: deadIdx, targetIdx: null }, card.onDeath);
      }
    }
  }

  /* ═════════════ 전투 ═════════════ */
  function resolveAttack(state, ai, di) {
    var a = state.board[ai], d = state.board[di];
    if (!a || !d) return false;

    var aAtk = effectiveAtk(state, ai);
    var dAtk = effectiveAtk(state, di);
    var dealt = applyDamage(state, di, aAtk, false);
    pushLog(state, a.name + ' → ' + d.name + ' 에 ' + dealt + ' 피해', a.owner);

    if (a.keywords.indexOf(KW.LIFESTEAL) >= 0 && dealt > 0) {
      var g = findGeneral(state, a.owner);
      if (g) {
        var got = healEntity(state, g.idx, dealt);
        if (got > 0) pushLog(state, '흡혈 — ' + g.e.name + ' HP +' + got, a.owner);
      }
    }

    /* 반격 — 동시 교환: 방어자가 죽어도 함께 칼을 맞댄 것으로 보고 반격 피해가 들어간다.
       예외 1) '선제공격' 공격자가 방어자를 죽이면 반격 없음
       예외 2) 구조물이거나, 공격자가 방어자 사거리 밖이면 반격 없음 */
    var firstStrike = a.keywords.indexOf(KW.FIRST) >= 0;
    var defenderDied = d.hp <= 0;
    if (d.kind !== 'structure' && d.rng > 0 && cheb(ai, di) <= d.rng &&
        !(firstStrike && defenderDied)) {
      var back = applyDamage(state, ai, dAtk, false);
      if (back > 0) pushLog(state, d.name + ' 반격 — ' + a.name + ' 에 ' + back + ' 피해', d.owner);
    } else if (firstStrike && defenderDied) {
      pushLog(state, a.name + ' 선제공격 — 반격을 허용하지 않는다!', a.owner);
    }

    a.hasAttacked = true;
    a.attacksLeft -= 1;
    a.hasMoved = true;          /* 공격하면 그 턴에는 더 이상 움직일 수 없다 */

    cleanupDeaths(state);
    return true;
  }

  /* ═════════════ 드로우 ═════════════ */
  function drawCards(state, player, n, silent) {
    var p = state.players[player];
    for (var i = 0; i < n; i++) {
      if (p.deck.length === 0) {
        p.fatigue += 1;
        var g = findGeneral(state, player);
        if (g) {
          applyDamage(state, g.idx, p.fatigue, true);
          pushLog(state, p.name + ' 탈진 — 장군이 ' + p.fatigue + ' 피해', player);
          cleanupDeaths(state);
        }
        continue;
      }
      if (p.hand.length >= D.HAND_LIMIT) {
        p.deck.pop();
        if (!silent) pushLog(state, p.name + ' 손패 초과로 카드 소실', player);
        continue;
      }
      p.hand.push(p.deck.pop());
    }
  }

  /* ═════════════ 소환 위치 ═════════════ */
  /* 아군 엔티티(유닛·장군·구조물)에 인접한 빈 칸 */
  function deployCells(state, owner) {
    var set = {};
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (!e || e.owner !== owner) continue;
      var nb = neighbors8(i);
      for (var k = 0; k < nb.length; k++) if (!state.board[nb[k]]) set[nb[k]] = true;
    }
    return Object.keys(set).map(Number);
  }

  function adjacentEmpty(state, idx) {
    return neighbors8(idx).filter(function (i) { return !state.board[i]; });
  }

  function placeEntity(state, cardId, owner, idx) {
    if (state.board[idx]) return null;
    var e = makeEntity(state, cardId, owner);
    e.attacksLeft = e.summonSick ? 0 : maxAttacks(e);
    state.board[idx] = e;
    return e;
  }

  /* ═════════════ 효과 처리 ═════════════ */
  /* ctx = { owner, sourceIdx, targetIdx, target2Idx, isSpell } */
  function resolveEffect(state, ctx, eff) {
    if (!eff) return;
    var owner = ctx.owner;
    var sp = ctx.isSpell ? spellPower(state, owner) : 0;

    switch (eff.k) {
      case 'seq':
        for (var s = 0; s < eff.list.length; s++) resolveEffect(state, ctx, eff.list[s]);
        return;

      case 'damage': {
        var amt = eff.amount + sp;
        var targets = [];
        if (eff.scope === 'target') {
          if (ctx.targetIdx != null && state.board[ctx.targetIdx]) targets = [ctx.targetIdx];
        } else if (eff.scope === 'aoe1') {
          /* 대상 칸 + 인접 8칸에 있는 모든 엔티티 (장군 포함, 아군도 맞는다) */
          if (ctx.targetIdx != null) {
            targets = [ctx.targetIdx].concat(neighbors8(ctx.targetIdx))
              .filter(function (i) { return !!state.board[i]; });
          }
        } else if (eff.scope === 'allEnemies') {
          for (var i = 0; i < SIZE; i++) {
            var e1 = state.board[i];
            if (e1 && e1.owner !== owner && e1.kind !== 'general') targets.push(i);
          }
        } else if (eff.scope === 'allUnits') {
          for (var j = 0; j < SIZE; j++) {
            var e2 = state.board[j];
            if (e2 && e2.kind !== 'general') targets.push(j);
          }
        }
        for (var t = 0; t < targets.length; t++) {
          var dealt = applyDamage(state, targets[t], amt, false);
          if (dealt > 0 && state.board[targets[t]]) {
            pushLog(state, state.board[targets[t]].name + ' 에 ' + dealt + ' 피해', owner);
          }
        }
        cleanupDeaths(state);
        return;
      }

      case 'multiDamage': {
        var amt2 = eff.amount + sp;
        var pool = [];
        for (var m = 0; m < SIZE; m++) {
          var em = state.board[m];
          if (em && em.owner !== owner && em.kind !== 'general') pool.push(m);
        }
        shuffle(pool, function () { return rngNext(state); });
        pool.slice(0, eff.count).forEach(function (i) { applyDamage(state, i, amt2, false); });
        cleanupDeaths(state);
        return;
      }

      case 'heal': {
        var hIdx = eff.scope === 'myGeneral'
          ? (findGeneral(state, owner) || {}).idx
          : ctx.targetIdx;
        if (hIdx != null && state.board[hIdx]) {
          var got = healEntity(state, hIdx, eff.amount);
          if (got > 0) pushLog(state, state.board[hIdx].name + ' HP +' + got, owner);
        }
        return;
      }

      case 'buff': {
        var bIdx = ctx.targetIdx;
        if (bIdx == null || !state.board[bIdx]) return;
        var b = state.board[bIdx];
        b.atk += (eff.atk || 0);
        b.baseAtk += (eff.atk || 0);
        b.maxHp += (eff.hp || 0);
        b.hp += (eff.hp || 0);
        pushLog(state, b.name + ' +' + (eff.atk || 0) + '/+' + (eff.hp || 0), owner);
        return;
      }

      case 'grantKeyword': {
        var gIdx = ctx.targetIdx;
        if (gIdx == null || !state.board[gIdx]) return;
        if (state.board[gIdx].keywords.indexOf(eff.kw) < 0) state.board[gIdx].keywords.push(eff.kw);
        return;
      }

      case 'draw':
        drawCards(state, owner, eff.amount);
        return;

      case 'gainMana':
        state.players[owner].mana += eff.amount;
        pushLog(state, '마나 +' + eff.amount, owner);
        return;

      case 'selfDamage': {
        var mg = findGeneral(state, owner);
        if (mg) {
          applyDamage(state, mg.idx, eff.amount, true);
          pushLog(state, mg.e.name + ' 이(가) ' + eff.amount + ' 피해를 감수한다.', owner);
          cleanupDeaths(state);
        }
        return;
      }

      case 'destroy': {
        if (ctx.targetIdx != null && state.board[ctx.targetIdx]) {
          state.board[ctx.targetIdx].hp = 0;
          cleanupDeaths(state);
        }
        return;
      }

      case 'summonToken': {
        var origin = ctx.sourceIdx != null ? ctx.sourceIdx : (findGeneral(state, owner) || {}).idx;
        if (origin == null) return;
        var spots = adjacentEmpty(state, origin);
        for (var q = 0; q < eff.count && q < spots.length; q++) {
          placeEntity(state, eff.token, owner, spots[q]);
          pushLog(state, CARDS[eff.token].name + ' 소환.', owner);
        }
        return;
      }

      case 'teleport': {
        if (ctx.targetIdx == null || ctx.target2Idx == null) return;
        var mover = state.board[ctx.targetIdx];
        if (!mover || state.board[ctx.target2Idx]) return;
        state.board[ctx.target2Idx] = mover;
        state.board[ctx.targetIdx] = null;
        pushLog(state, mover.name + ' 이(가) 공간을 건넜다.', owner);
        return;
      }

      case 'refresh': {
        entitiesOf(state, owner).forEach(function (x) {
          if (x.e.kind === 'structure') return;
          x.e.hasMoved = false;
          x.e.hasAttacked = false;
          x.e.attacksLeft = maxAttacks(x.e);
          x.e.summonSick = false;
        });
        pushLog(state, '전군 재정비!', owner);
        return;
      }
    }
  }

  /* ═════════════ 대상 유효성 ═════════════ */
  function validTargets(state, owner, targetKind, opts) {
    var out = [];
    opts = opts || {};
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (targetKind === 'emptyCell') { if (!e) out.push(i); continue; }
      if (!e) continue;
      if (targetKind === 'enemyUnit' && e.owner !== owner && e.kind !== 'general') out.push(i);
      else if (targetKind === 'enemyAny' && e.owner !== owner) out.push(i);
      else if (targetKind === 'allyUnit' && e.owner === owner && e.kind !== 'general') out.push(i);
      else if (targetKind === 'anyUnit' && e.kind !== 'general') out.push(i);
    }
    if (opts.range != null && opts.from != null) {
      out = out.filter(function (i) { return cheb(opts.from, i) <= opts.range; });
    }
    return out;
  }

  /* 카드가 요구하는 대상 종류 */
  function cardTargetKind(card) { return card.target || 'none'; }

  /* ═════════════ 카드 플레이 ═════════════ */
  function canPlayCard(state, player, handIndex) {
    if (state.winner || state.current !== player) return false;
    var p = state.players[player];
    var cardId = p.hand[handIndex];
    if (!cardId) return false;
    var card = CARDS[cardId];
    if (p.mana < card.cost) return false;

    if (card.type === 'unit') return deployCells(state, player).length > 0;
    /* 주문 */
    var tk = cardTargetKind(card);
    if (tk === 'none') return true;
    return validTargets(state, player, tk).length > 0;
  }

  /* opts = { cell, target, target2 } */
  function playCard(state, player, handIndex, opts) {
    opts = opts || {};
    if (!canPlayCard(state, player, handIndex)) return false;
    var p = state.players[player];
    var cardId = p.hand[handIndex];
    var card = CARDS[cardId];

    if (card.type === 'unit') {
      var cell = opts.cell;
      if (deployCells(state, player).indexOf(cell) < 0) return false;
      p.mana -= card.cost;
      p.hand.splice(handIndex, 1);
      placeEntity(state, cardId, player, cell);
      pushLog(state, p.name + ' — ' + card.name + ' 소환', player);
      if (card.onSummon) {
        resolveEffect(state, {
          owner: player, sourceIdx: cell,
          targetIdx: opts.target != null ? opts.target : null,
          isSpell: false
        }, card.onSummon);
      }
      cleanupDeaths(state);
      return true;
    }

    /* 주문 */
    var tk = cardTargetKind(card);
    if (tk !== 'none') {
      if (validTargets(state, player, tk).indexOf(opts.target) < 0) return false;
      if (card.target2 === 'emptyCell' && (opts.target2 == null || state.board[opts.target2])) return false;
    }
    p.mana -= card.cost;
    p.hand.splice(handIndex, 1);
    pushLog(state, p.name + ' — ' + card.name + ' 시전', player);
    resolveEffect(state, {
      owner: player, sourceIdx: null,
      targetIdx: opts.target != null ? opts.target : null,
      target2Idx: opts.target2 != null ? opts.target2 : null,
      isSpell: true
    }, card.spell);
    cleanupDeaths(state);

    /* 주문 성장 — 내가 주문을 시전할 때마다 커지는 아군 유닛 */
    for (var gi = 0; gi < SIZE; gi++) {
      var ge = state.board[gi];
      if (!ge || ge.owner !== player) continue;
      var grow = CARDS[ge.cardId].growOnSpell;
      if (!grow) continue;
      ge.atk += grow.atk; ge.baseAtk += grow.atk;
      ge.hp += grow.hp; ge.maxHp += grow.hp;
      pushLog(state, ge.name + ' 이(가) 주문의 힘을 흡수한다! (+' + grow.atk + '/+' + grow.hp + ')', player);
    }
    return true;
  }

  /* ═════════════ 카드 교환 (턴당 1회 멀리건) ═════════════ */
  function canMulligan(state, player) {
    if (state.winner || state.current !== player) return false;
    var p = state.players[player];
    return !p.mulliganUsed && p.hand.length > 0 && p.deck.length > 0;
  }

  /* 손패 1장을 덱의 무작위 위치로 돌려보내고 새 카드를 뽑는다. 무료. */
  function mulliganCard(state, player, handIndex) {
    if (!canMulligan(state, player)) return false;
    var p = state.players[player];
    var old = p.hand[handIndex];
    if (!old) return false;
    var drawn = p.deck.pop();                 /* 먼저 뽑아서 같은 카드를 되뽑지 않게 */
    p.hand[handIndex] = drawn;
    p.deck.splice(Math.floor(rngNext(state) * (p.deck.length + 1)), 0, old);
    p.mulliganUsed = true;
    pushLog(state, p.name + ' — 「' + CARDS[old].name + '」 을(를) 덱과 교환', player);
    return true;
  }

  /* ═════════════ 영웅 능력 ═════════════ */
  function canUseHeroPower(state, player) {
    if (state.winner || state.current !== player) return false;
    var p = state.players[player];
    if (p.heroPowerUsed) return false;
    var pwCost = D.FACTIONS[p.faction].power.cost || D.HERO_POWER_COST;
    if (p.mana < pwCost) return false;
    var pw = D.FACTIONS[p.faction].power;
    if (pw.target === 'none') {
      if (pw.id === 'conscript') {
        var g = findGeneral(state, player);
        return !!g && adjacentEmpty(state, g.idx).length > 0;
      }
      if (pw.id === 'conjure') return p.hand.length < D.HAND_LIMIT;
      return true;
    }
    var g2 = findGeneral(state, player);
    var opts = pw.range != null && g2 ? { range: 99 } : {};
    return validTargets(state, player, pw.target, opts).length > 0;
  }

  function useHeroPower(state, player, opts) {
    opts = opts || {};
    if (!canUseHeroPower(state, player)) return false;
    var p = state.players[player];
    var pw = D.FACTIONS[p.faction].power;
    var g = findGeneral(state, player);

    if (pw.target !== 'none') {
      if (validTargets(state, player, pw.target).indexOf(opts.target) < 0) return false;
    }
    if (pw.target2 === 'emptyCell') {
      if (opts.target2 == null || state.board[opts.target2]) return false;
      if (cheb(opts.target, opts.target2) > pw.range) return false;
    }

    p.mana -= (pw.cost || D.HERO_POWER_COST);
    p.heroPowerUsed = true;
    pushLog(state, p.name + ' — 영웅 능력 「' + pw.name + '」', player);

    if (pw.id === 'aimedShot') {
      applyDamage(state, opts.target, 2, false);
      cleanupDeaths(state);
    } else if (pw.id === 'conscript') {
      var spot = adjacentEmpty(state, g.idx)[0];
      if (spot != null) placeEntity(state, 'e_squire', player, spot);
    } else if (pw.id === 'conjure') {
      /* 대마법(5코 광역)은 연성 풀에서 제외 — 매 턴 2마나로 나오면 게임이 부서진다 */
      var pool = D.factionCardIds('arcane').filter(function (id) {
        return CARDS[id].type === 'spell' && id !== 'a_cataclysm';
      });
      var pick = pool[Math.floor(rngNext(state) * pool.length)];
      p.hand.push(pick);
      pushLog(state, '「' + CARDS[pick].name + '」 을(를) 연성했다.', player);
    } else if (pw.id === 'hellbrand') {
      applyDamage(state, g.idx, 1, true);
      applyDamage(state, opts.target, 3, false);
      cleanupDeaths(state);
    }
    return true;
  }

  /* ═════════════ 거점 건설 ═════════════ */
  function canBuild(state, player) {
    if (state.winner || state.current !== player) return false;
    var p = state.players[player];
    if (p.mana < D.STRUCTURE_COST) return false;
    if (p.turnsTaken - p.lastBuildTurn < D.STRUCTURE_COOLDOWN) return false;
    return deployCells(state, player).length > 0;
  }

  function buildStructure(state, player, structureId, cell) {
    if (!canBuild(state, player)) return false;
    if (D.STRUCTURE_IDS.indexOf(structureId) < 0) return false;
    if (deployCells(state, player).indexOf(cell) < 0) return false;
    var p = state.players[player];
    p.mana -= D.STRUCTURE_COST;
    p.lastBuildTurn = p.turnsTaken;
    placeEntity(state, structureId, player, cell);
    pushLog(state, p.name + ' — ' + CARDS[structureId].name + ' 건설', player);
    return true;
  }

  /* ═════════════ 유닛 행동 ═════════════ */
  function moveUnit(state, from, to) {
    if (movesFor(state, from).indexOf(to) < 0) return false;
    var e = state.board[from];
    state.board[to] = e;
    state.board[from] = null;
    e.hasMoved = true;
    return true;
  }

  function attackWith(state, from, target) {
    if (attacksFor(state, from).indexOf(target) < 0) return false;
    return resolveAttack(state, from, target);
  }

  /* ═════════════ 아크 ═════════════ */
  function arkHolder(state) {
    var e = state.board[ARK];
    return e ? e.owner : null;
  }

  /* 아크 경합 — 점거자의 적 병력(유닛·장군)이 아크 주변 1칸에 있으면
     점령 스택이 오르지 않는다. 선점 후 버티기의 카운터플레이. */
  function arkContested(state, holder) {
    var foe = opponentOf(holder);
    var nb = neighbors8(ARK);
    for (var i = 0; i < nb.length; i++) {
      var e = state.board[nb[i]];
      if (e && e.owner === foe && e.kind !== 'structure') return true;
    }
    return false;
  }

  function resolveArk(state) {
    var holder = arkHolder(state);
    var contested = holder ? arkContested(state, holder) : false;
    ['P1', 'P2'].forEach(function (pid) {
      if (holder === pid) {
        if (state.current === pid) {
          if (contested) {
            pushLog(state, '아크 경합 중 — 적이 인접해 점령이 저지된다!', pid);
          } else {
            state.players[pid].arkCount += 1;
          }
        }
      } else {
        state.players[pid].arkCount = 0;
      }
    });
    var cur = state.players[state.current];
    if (cur.arkCount > 0) {
      pushLog(state, '아크 점령 ' + cur.arkCount + ' / ' + D.ARK_TURNS_TO_WIN, state.current);
    }
    if (cur.arkCount >= D.ARK_TURNS_TO_WIN && !state.winner) {
      state.winner = state.current;
      state.winReason = 'ark';
      pushLog(state, cur.name + ' 승리! (아크 점령)', 'system');
    }
  }

  /* ═════════════ 턴 진행 ═════════════ */
  function startTurn(state) {
    if (state.winner) return;
    var pid = state.current;
    var p = state.players[pid];
    p.turnsTaken += 1;
    p.maxMana = Math.min(D.MAX_MANA, p.maxMana + 1);
    p.mana = p.maxMana;
    p.heroPowerUsed = false;
    p.mulliganUsed = false;

    /* 유닛 행동력 회복 */
    entitiesOf(state, pid).forEach(function (x) {
      if (x.e.kind === 'structure') return;
      x.e.summonSick = false;
      x.e.hasMoved = false;
      x.e.hasAttacked = false;
      x.e.attacksLeft = maxAttacks(x.e);
    });

    /* 구조물 효과 */
    entitiesOf(state, pid).forEach(function (x) {
      if (x.e.kind !== 'structure') return;
      if (x.e.cardId === 'st_spire') {
        p.mana += 1;
        pushLog(state, '마나 첨탑 — 마나 +1', pid);
      } else if (x.e.cardId === 'st_barracks') {
        var spot = adjacentEmpty(state, x.idx)[0];
        if (spot != null) {
          placeEntity(state, 'tk_soldier', pid, spot);
          pushLog(state, '병영 — 병사 생산', pid);
        }
      }
    });

    resolveArk(state);
    if (state.winner) return;

    drawCards(state, pid, 1);
    if (state.winner) return;

    pushLog(state, '── ' + p.name + ' 턴 ' + p.turnsTaken + ' (마나 ' + p.mana + ') ──', pid);
  }

  function endTurn(state) {
    if (state.winner) return;
    entitiesOf(state, state.current).forEach(function (x) {
      x.e.hasMoved = true;
      x.e.attacksLeft = 0;
    });
    state.current = opponentOf(state.current);
    state.turnCount += 1;
    startTurn(state);
  }

  /* ═════════════ AI용 자동 대상 선택 ═════════════ */
  function autoTargetFor(state, owner, cardId) {
    var card = CARDS[cardId];
    var tk = cardTargetKind(card);
    if (tk === 'none') return null;
    var cands = validTargets(state, owner, tk);
    if (!cands.length) return null;
    var eff = card.onSummon || card.spell || {};
    var amount = eff.amount || (eff.list && eff.list[0] && eff.list[0].amount) || 0;

    if (tk === 'enemyUnit' || tk === 'enemyAny') {
      /* 장군 확정 처치(=승리)가 최우선, 다음 유닛 확정 처치, 다음 고공격력 유닛 */
      var genKill = cands.filter(function (i) {
        return state.board[i].kind === 'general' && state.board[i].hp <= amount;
      });
      if (genKill.length) return genKill[0];
      var kill = cands.filter(function (i) {
        return state.board[i].kind !== 'general' && state.board[i].hp <= amount;
      });
      var units = cands.filter(function (i) { return state.board[i].kind !== 'general'; });
      var pool = kill.length ? kill : (units.length ? units : cands);
      return pool.sort(function (a, b) {
        return effectiveAtk(state, b) - effectiveAtk(state, a);
      })[0];
    }
    if (tk === 'allyUnit') {
      if (eff.k === 'heal' || (eff.list && eff.list[0] && eff.list[0].k === 'heal')) {
        return cands.sort(function (a, b) {
          return (state.board[b].maxHp - state.board[b].hp) - (state.board[a].maxHp - state.board[a].hp);
        })[0];
      }
      if (eff.k === 'destroy' || (eff.list && eff.list[0] && eff.list[0].k === 'destroy')) {
        return cands.sort(function (a, b) {
          return (CARDS[state.board[a].cardId].cost) - (CARDS[state.board[b].cardId].cost);
        })[0];
      }
      /* 버프 — 가장 강한 아군에게 */
      return cands.sort(function (a, b) {
        return effectiveAtk(state, b) - effectiveAtk(state, a);
      })[0];
    }
    return cands[0];
  }

  /* ═════════════ 합법 행동 열거 ═════════════ */
  /* forAI=true 면 조합 폭발을 막기 위해 일부 선택지를 휴리스틱으로 축약한다. */
  function legalActions(state, forAI) {
    var out = [];
    if (state.winner) return out;
    var pid = state.current;
    var p = state.players[pid];

    /* 카드 */
    var seen = {};
    for (var h = 0; h < p.hand.length; h++) {
      var cardId = p.hand[h];
      if (seen[cardId]) continue;
      if (!canPlayCard(state, pid, h)) continue;
      seen[cardId] = true;
      var card = CARDS[cardId];

      if (card.type === 'unit') {
        var cells = deployCells(state, pid);
        if (forAI) cells = pruneCells(state, pid, cells, 10);
        var autoT = card.target ? autoTargetFor(state, pid, cardId) : null;
        for (var ci = 0; ci < cells.length; ci++) {
          out.push({ kind: 'play', handIndex: h, cardId: cardId, cell: cells[ci], target: autoT });
        }
      } else {
        var tk = cardTargetKind(card);
        if (tk === 'none') {
          out.push({ kind: 'play', handIndex: h, cardId: cardId, target: null });
        } else {
          var tgts = validTargets(state, pid, tk);
          for (var ti = 0; ti < tgts.length; ti++) {
            if (card.target2 === 'emptyCell') {
              var dests = forAI ? pruneCells(state, pid, validTargets(state, pid, 'emptyCell'), 6)
                                : validTargets(state, pid, 'emptyCell');
              for (var di = 0; di < dests.length; di++) {
                out.push({ kind: 'play', handIndex: h, cardId: cardId, target: tgts[ti], target2: dests[di] });
              }
            } else {
              out.push({ kind: 'play', handIndex: h, cardId: cardId, target: tgts[ti] });
            }
          }
        }
      }
    }

    /* 영웅 능력 */
    if (canUseHeroPower(state, pid)) {
      var pw = D.FACTIONS[p.faction].power;
      if (pw.target === 'none') {
        out.push({ kind: 'power', target: null });
      } else {
        var pts = validTargets(state, pid, pw.target);
        for (var pi = 0; pi < pts.length; pi++) {
          if (pw.target2 === 'emptyCell') {
            var pdest = validTargets(state, pid, 'emptyCell')
              .filter(function (x) { return cheb(pts[pi], x) <= pw.range; });
            if (forAI) pdest = pruneCells(state, pid, pdest, 4);
            for (var pdi = 0; pdi < pdest.length; pdi++) {
              out.push({ kind: 'power', target: pts[pi], target2: pdest[pdi] });
            }
          } else {
            out.push({ kind: 'power', target: pts[pi] });
          }
        }
      }
    }

    /* 거점 건설 */
    if (canBuild(state, pid)) {
      var bcells = deployCells(state, pid);
      if (forAI) bcells = pruneCells(state, pid, bcells, 4);
      for (var si = 0; si < D.STRUCTURE_IDS.length; si++) {
        for (var bi = 0; bi < bcells.length; bi++) {
          out.push({ kind: 'build', structureId: D.STRUCTURE_IDS[si], cell: bcells[bi] });
        }
      }
    }

    /* 카드 교환 — AI 는 '지금 마나로 한참 못 내는 가장 비싼 카드' 하나만 후보로 */
    if (forAI && canMulligan(state, pid)) {
      var worst = -1, worstCost = -1;
      for (var mh = 0; mh < p.hand.length; mh++) {
        var mcost = CARDS[p.hand[mh]].cost;
        if (mcost > p.maxMana + 2 && mcost > worstCost) { worst = mh; worstCost = mcost; }
      }
      if (worst >= 0) out.push({ kind: 'mulligan', handIndex: worst });
    }

    /* 유닛 이동 / 공격 */
    for (var i = 0; i < SIZE; i++) {
      var e = state.board[i];
      if (!e || e.owner !== pid) continue;
      var mv = movesFor(state, i);
      for (var mi = 0; mi < mv.length; mi++) out.push({ kind: 'move', from: i, to: mv[mi] });
      var at = attacksFor(state, i);
      for (var aidx = 0; aidx < at.length; aidx++) out.push({ kind: 'attack', from: i, target: at[aidx] });
    }

    return out;
  }

  /* 소환/건설 후보 칸을 의미 있는 것 위주로 줄인다 (AI 전용) */
  function pruneCells(state, owner, cells, limit) {
    if (cells.length <= limit) return cells;
    var foe = findGeneral(state, opponentOf(owner));
    var scored = cells.map(function (i) {
      var s = 0;
      s -= cheb(i, ARK) * 1.2;                      /* 아크에 가까울수록 좋다 */
      if (foe) s -= cheb(i, foe.idx) * 0.6;
      var nb = neighbors8(i);
      for (var k = 0; k < nb.length; k++) {
        var n = state.board[nb[k]];
        if (n && n.owner !== owner) s += 1.5;        /* 적과 붙는 자리에 가산 */
      }
      return { i: i, s: s };
    });
    scored.sort(function (a, b) { return b.s - a.s; });
    return scored.slice(0, limit).map(function (x) { return x.i; });
  }

  function applyAction(state, a) {
    switch (a.kind) {
      case 'play':
        return playCard(state, state.current, a.handIndex,
          { cell: a.cell, target: a.target, target2: a.target2 });
      case 'power':
        return useHeroPower(state, state.current, { target: a.target, target2: a.target2 });
      case 'build':
        return buildStructure(state, state.current, a.structureId, a.cell);
      case 'mulligan':
        return mulliganCard(state, state.current, a.handIndex);
      case 'move':
        return moveUnit(state, a.from, a.to);
      case 'attack':
        return attackWith(state, a.from, a.target);
      case 'end':
        endTurn(state); return true;
    }
    return false;
  }

  RG.Engine = {
    SIZE: SIZE, ARK: ARK,
    rc: rc, toIdx: toIdx, inBoard: inBoard, cheb: cheb, manhattan: manhattan,
    neighbors8: neighbors8, opponentOf: opponentOf,
    createGame: createGame, cloneState: cloneState,
    findGeneral: findGeneral, entitiesOf: entitiesOf, findByUid: findByUid,
    effectiveAtk: effectiveAtk, spellPower: spellPower,
    adjacentEnemyProvokers: adjacentEnemyProvokers,
    canMove: canMove, canAttack: canAttack, movesFor: movesFor, attacksFor: attacksFor,
    deployCells: deployCells, adjacentEmpty: adjacentEmpty,
    placeEntity: placeEntity, makeEntity: makeEntity,   /* 테스트·시나리오 배치용 */
    resolveEffect: resolveEffect, applyDamage: applyDamage, cleanupDeaths: cleanupDeaths,
    validTargets: validTargets, cardTargetKind: cardTargetKind,
    canPlayCard: canPlayCard, playCard: playCard,
    canUseHeroPower: canUseHeroPower, useHeroPower: useHeroPower,
    canBuild: canBuild, buildStructure: buildStructure,
    canMulligan: canMulligan, mulliganCard: mulliganCard,
    moveUnit: moveUnit, attackWith: attackWith,
    drawCards: drawCards, startTurn: startTurn, endTurn: endTurn,
    arkHolder: arkHolder, arkContested: arkContested,
    legalActions: legalActions, applyAction: applyAction,
    rngNext: rngNext,
    autoTargetFor: autoTargetFor,
    pushLog: pushLog
  };
})(typeof window !== 'undefined' ? window : global);

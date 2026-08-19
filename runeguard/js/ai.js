/* RUNEGUARD — AI 지휘관 v0.2
   한 수씩 반환(nextAction). UI가 일정 간격으로 호출해 수를 두게 한다.
   평가 = 정적 평가(물량·아크·장군) - 상대 즉시 반격 위협 */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};
  var D = RG.Data, E = RG.Engine;
  var CARDS = D.CARDS, KW = D.KW;
  var ARK = D.ARK_INDEX;

  var DIFFICULTY = {
    easy:   { noise: 14.0, threat: 0.15, stopMargin: 10.0 },
    normal: { noise: 4.0,  threat: 0.55, stopMargin: 3.0 },
    hard:   { noise: 0.5,  threat: 0.95, stopMargin: 0.0 }
  };

  /* ── 엔티티 가치 ──
     atkOverride 를 넘기면 오라가 반영된 실제 공격력으로 계산한다. */
  function entityValue(e, atkOverride) {
    var atk = (atkOverride != null) ? atkOverride : e.atk;
    if (e.kind === 'general') return 260 + e.hp * 11;
    if (e.kind === 'structure') {
      /* 마나 첨탑은 누적 마나 이득이라 정적 평가로는 과소평가되기 쉬워 보정한다 */
      var base = e.cardId === 'st_spire' ? 34 : (e.cardId === 'st_barracks' ? 40 : 34);
      return base + e.hp * 1.2;
    }
    var cost = CARDS[e.cardId].cost;
    return 5 + cost * 2.2 + atk * 2.0 + e.hp * 1.5;
  }

  function effDamage(atk, defender) {
    if (defender.keywords.indexOf(KW.BULWARK) >= 0) return Math.max(0, atk - 1);
    return atk;
  }

  /* ── 정적 평가 ── */
  function staticEval(state, me) {
    var foe = E.opponentOf(me);
    if (state.winner === me) return 1e6;
    if (state.winner === foe) return -1e6;

    var myGen = E.findGeneral(state, me);
    var foeGen = E.findGeneral(state, foe);
    var score = 0;

    for (var i = 0; i < E.SIZE; i++) {
      var e = state.board[i];
      if (!e) continue;
      /* 오라가 반영된 실제 공격력으로 평가해야 오라 제공자의 가치가 보인다 */
      var v = entityValue(e, E.effectiveAtk(state, i));
      var mine = e.owner === me;

      if (e.kind === 'unit') {
        /* 아크 접근 + 적 장군 압박 */
        v += (5 - E.cheb(i, ARK)) * 2.6;
        var enemyGen = mine ? foeGen : myGen;
        if (enemyGen) v += (6 - E.cheb(i, enemyGen.idx)) * 1.1;
        if (e.keywords.indexOf(KW.PROVOKE) >= 0) v += 4;
      }
      score += (mine ? 1 : -1) * v;
    }

    /* 아크 점령 진행도 — 승리 조건이므로 크게 잡는다 */
    var holder = E.arkHolder(state);
    var mp = state.players[me], op = state.players[foe];
    var contested = holder ? E.arkContested(state, holder) : false;
    /* 경합 중이면 점거 가치가 급감 — AI 가 경합 유닛을 붙이고/떼어내게 유도 */
    if (holder === me) score += contested ? 8 : 34 + mp.arkCount * 70;
    else if (holder === foe) score -= contested ? 8 : 34 + op.arkCount * 70;
    score += (mp.arkCount - op.arkCount) * 20;

    /* 자원 */
    score += (mp.hand.length - op.hand.length) * 2.4;
    score -= mp.mana * 1.1;                 /* 마나를 남기면 손해 */
    return score;
  }

  /* ── 상대가 다음 턴에 즉시 뽑아낼 수 있는 최대 이득 ── */
  function opponentThreat(state, me) {
    var foe = E.opponentOf(me);
    var best = 0;
    for (var i = 0; i < E.SIZE; i++) {
      var a = state.board[i];
      if (!a || a.owner !== foe || a.kind === 'structure' || a.rng <= 0) continue;
      var aAtk = E.effectiveAtk(state, i);
      for (var j = 0; j < E.SIZE; j++) {
        var d = state.board[j];
        if (!d || d.owner === foe) continue;      /* 내 엔티티만 위협 대상 */
        if (E.cheb(i, j) > a.rng) continue;
        var dmg = effDamage(aAtk, d);
        var killed = dmg >= d.hp;
        var gain = killed ? entityValue(d) : dmg * 2.2;
        if (!killed && d.kind !== 'structure' && d.rng > 0 && E.cheb(i, j) <= d.rng) {
          var back = effDamage(E.effectiveAtk(state, j), a);
          gain -= (back >= a.hp) ? entityValue(a) : back * 2.2;
        }
        if (gain > best) best = gain;
      }
    }
    return best;
  }

  function scoreState(state, me, cfg) {
    return staticEval(state, me) - cfg.threat * opponentThreat(state, me);
  }

  /* ── 다음 한 수. null 이면 턴 종료 ── */
  function nextAction(state, level) {
    var cfg = DIFFICULTY[level] || DIFFICULTY.normal;
    if (state.winner) return null;

    var me = state.current;
    var actions = E.legalActions(state, true);
    if (!actions.length) return null;

    var base = scoreState(state, me, cfg);
    var best = null, bestScore = -Infinity;

    for (var i = 0; i < actions.length; i++) {
      var sim = E.cloneState(state);
      if (!E.applyAction(sim, actions[i])) continue;
      var sc = scoreState(sim, me, cfg) + (Math.random() - 0.5) * cfg.noise;
      if (sc > bestScore) { bestScore = sc; best = actions[i]; }
    }

    if (!best) return null;
    if (bestScore < base - cfg.stopMargin) return null;
    return best;
  }

  RG.AI = {
    nextAction: nextAction,
    entityValue: entityValue,
    staticEval: staticEval,
    DIFFICULTY: DIFFICULTY
  };
})(typeof window !== 'undefined' ? window : global);

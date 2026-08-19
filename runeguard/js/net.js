/* RUNEGUARD — 온라인 친선전 (Supabase Realtime 브로드캐스트 중계)
   ─────────────────────────────────────────────────────────────
   원리: 엔진이 시드 난수로 결정적이므로, 양쪽이 같은 시드로 게임을 만들고
   "행동"만 주고받으면 두 화면이 항상 같은 상태가 된다 (락스텝).

   · 호스트 = P1, 게스트 = P2
   · 매 행동마다 적용 후 상태 해시를 함께 보내 어긋남을 감지하고,
     어긋나면 호스트의 전체 상태로 재동기화한다
   · DB/테이블은 전혀 쓰지 않는다 — 브로드캐스트 채널은 순수 메시지 중계

   구조: createPeer() 는 전송·UI 비의존 순수 프로토콜 (Node 테스트 가능).
         하단의 브라우저 연결부만 Supabase / RG.UI 에 붙는다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};
  var E = RG.Engine;

  var SUPABASE_URL = 'https://bglyqtosmwqccjfussjo.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_NBjMpkKT3NjQXDXpNXd0_Q_RoGOXdHb';
  var SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';

  /* ═════════════ 상태 해시 — 어긋남 감지용 ═════════════ */
  function hashState(st) {
    var h = st.rngState | 0;
    h = (h * 31 + st.turnCount) | 0;
    h = (h * 31 + (st.current === 'P1' ? 1 : 2)) | 0;
    for (var i = 0; i < st.board.length; i++) {
      var e = st.board[i];
      if (!e) continue;
      h = (h * 31 + i) | 0;
      h = (h * 31 + e.uid) | 0;
      h = (h * 31 + e.hp) | 0;
      h = (h * 31 + e.atk) | 0;
    }
    ['P1', 'P2'].forEach(function (p) {
      h = (h * 31 + st.players[p].hand.length) | 0;
      h = (h * 31 + st.players[p].deck.length) | 0;
      h = (h * 31 + st.players[p].mana) | 0;
      h = (h * 31 + st.players[p].arkCount) | 0;
    });
    return h;
  }

  /* 원격 행동을 엔진 호출로 되돌리는 사상 */
  var APPLY = {
    playCard:       function (st, a) { return E.playCard(st, a[0], a[1], a[2]); },
    moveUnit:       function (st, a) { return E.moveUnit(st, a[0], a[1]); },
    attackWith:     function (st, a) { return E.attackWith(st, a[0], a[1]); },
    useHeroPower:   function (st, a) { return E.useHeroPower(st, a[0], a[1]); },
    buildStructure: function (st, a) { return E.buildStructure(st, a[0], a[1], a[2]); },
    mulliganCard:   function (st, a) { return E.mulliganCard(st, a[0], a[1]); },
    endTurn:        function (st, a) { E.endTurn(st); return true; }
  };

  /* ═════════════ 순수 프로토콜 피어 ═════════════
     opts = {
       send(payload)          : 상대에게 메시지 전송
       getState() / setState(st) : 게임 상태 접근
       ui: { onStatus(txt), onStart(cfg), beforeRemote(fn,args),
             afterRemote(fn,args), onSync(), onPeerLeft() }
     } */
  function createPeer(opts) {
    var P = {
      role: null,            /* 'P1'(호스트) | 'P2'(게스트) */
      started: false,
      myFaction: null,
      applyingRemote: false
    };
    var ui = opts.ui || {};
    function call(name) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (ui[name]) ui[name].apply(null, args);
    }

    P.startHost = function (faction, deck) {
      P.role = 'P1';
      P.myFaction = faction;
      P.myDeck = deck || null;
      call('onStatus', 'waiting');
    };

    P.startJoin = function (faction, deck) {
      P.role = 'P2';
      P.myFaction = faction;
      opts.send({ t: 'join', faction: faction, deck: deck || null });
      call('onStatus', 'joining');
    };

    /* 내 행동을 로컬 적용 "후" 호출 — 상대에게 중계 */
    P.emit = function (fn, args) {
      if (!P.started || P.applyingRemote) return;
      opts.send({ t: 'act', fn: fn, args: args, h: hashState(opts.getState()) });
    };

    P.leave = function () { try { opts.send({ t: 'bye' }); } catch (e) {} };

    /* 호스트가 주기적으로 호출 — 상태 해시를 흘려보낸다 */
    P.ping = function () {
      if (!P.started || P.role !== 'P1') return;
      var st = opts.getState();
      if (st) opts.send({ t: 'ping', h: hashState(st) });
    };

    P.handleMessage = function (msg) {
      if (!msg || !msg.t) return;

      if (msg.t === 'join' && P.role === 'P1' && !P.started) {
        var seed = Math.floor(Math.random() * 0x7fffffff);
        /* 게스트 덱 검증 — 이상하면 기본 덱으로 (양쪽 동일하게 적용됨) */
        var guestDeck = (msg.deck && RG.Data.validateDeck(msg.faction, msg.deck).ok) ? msg.deck : null;
        var cfg = { seed: seed, p1Faction: P.myFaction, p2Faction: msg.faction,
                    p1Deck: P.myDeck, p2Deck: guestDeck };
        opts.send({ t: 'start', cfg: cfg });
        P.started = true;
        call('onStart', cfg, 'P1');
        return;
      }

      if (msg.t === 'start' && P.role === 'P2' && !P.started) {
        P.started = true;
        call('onStart', msg.cfg, 'P2');
        return;
      }

      if (msg.t === 'act' && P.started) {
        var st = opts.getState();
        if (!st) return;
        /* 자기 턴 위장 방지 — 지금 차례인 쪽의 행동만 적용한다 */
        if (st.current !== P.role) {
          call('beforeRemote', msg.fn, msg.args);
          P.applyingRemote = true;
          try { if (APPLY[msg.fn]) APPLY[msg.fn](st, msg.args); }
          finally { P.applyingRemote = false; }
          call('afterRemote', msg.fn, msg.args);
        }
        /* 적용 여부와 무관하게 해시를 비교한다 — 어긋났으면 게스트가 호스트 상태로 맞춘다 */
        if (msg.h !== undefined && hashState(st) !== msg.h && P.role === 'P2') {
          opts.send({ t: 'syncreq' });
        }
        return;
      }

      /* 하트비트 — 유실된 메시지(특히 턴 종료)로 인한 교착을 감지해 복구한다 */
      if (msg.t === 'ping' && P.started && P.role === 'P2') {
        var st2 = opts.getState();
        if (st2 && msg.h !== undefined && hashState(st2) !== msg.h) {
          opts.send({ t: 'syncreq' });
        }
        return;
      }

      if (msg.t === 'syncreq' && P.role === 'P1' && P.started) {
        opts.send({ t: 'sync', state: JSON.stringify(opts.getState()) });
        return;
      }

      if (msg.t === 'sync' && P.role === 'P2') {
        opts.setState(JSON.parse(msg.state));
        call('onSync');
        return;
      }

      if (msg.t === 'bye') { call('onPeerLeft'); }
    };

    return P;
  }

  /* ═════════════ 브라우저 연결부 (Supabase) ═════════════ */
  var S = { peer: null, channel: null, client: null, code: null, ui: {}, pingTimer: null };

  function loadSdk(cb, err) {
    if (global.supabase) return cb();
    if (!global.document) return err('브라우저 환경이 아님');
    var sc = global.document.createElement('script');
    sc.src = SDK_URL;
    sc.onload = function () { cb(); };
    sc.onerror = function () { err('온라인 모듈 로드 실패 — 인터넷 연결을 확인하세요.'); };
    global.document.head.appendChild(sc);
  }

  function makeCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* 헷갈리는 문자 제외 */
    var out = '';
    for (var i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  function connect(code, onReady, onError) {
    loadSdk(function () {
      if (!S.client) S.client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      S.code = code;
      S.channel = S.client.channel('runeguard-' + code, {
        config: { broadcast: { self: false } }
      });
      S.channel.on('broadcast', { event: 'msg' }, function (ev) {
        if (S.peer) S.peer.handleMessage(ev.payload);
      });
      S.channel.subscribe(function (status) {
        if (status === 'SUBSCRIBED') onReady();
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          onError('연결 실패 (' + status + ') — 잠시 후 다시 시도하세요.');
        }
      });
    }, onError);
  }

  function send(payload) {
    if (!S.channel) return;
    S.channel.send({ type: 'broadcast', event: 'msg', payload: payload });
  }

  function makeBrowserPeer(getState, setState) {
    return createPeer({
      send: send,
      getState: getState,
      setState: setState,
      ui: S.ui
    });
  }

  RG.Net = {
    /* ui.js 가 시작 시 훅과 상태 접근자를 등록한다 */
    bindUI: function (hooks, getState, setState) {
      S.ui = hooks || {};
      S.getState = getState;
      S.setState = setState;
    },

    hostGame: function (faction, deck, onError) {
      var code = makeCode();
      connect(code, function () {
        S.peer = makeBrowserPeer(S.getState, S.setState);
        S.peer.startHost(faction, deck);
        if (S.ui.onRoomReady) S.ui.onRoomReady(code);
        /* 하트비트 — 5초마다 상태 해시 송신 (유실 복구) */
        if (S.pingTimer) clearInterval(S.pingTimer);
        S.pingTimer = setInterval(function () { if (S.peer) S.peer.ping(); }, 5000);
      }, onError);
    },

    joinGame: function (code, faction, deck, onError) {
      connect(String(code).toUpperCase().trim(), function () {
        S.peer = makeBrowserPeer(S.getState, S.setState);
        S.peer.startJoin(faction, deck);
      }, onError);
    },

    emit: function (fn, args) { if (S.peer) S.peer.emit(fn, args); },

    leave: function () {
      if (S.pingTimer) { clearInterval(S.pingTimer); S.pingTimer = null; }
      if (S.peer) S.peer.leave();
      if (S.channel) { try { S.channel.unsubscribe(); } catch (e) {} }
      S.peer = null; S.channel = null; S.code = null;
    },

    isOnline: function () { return !!(S.peer && S.peer.started); },
    role: function () { return S.peer ? S.peer.role : null; },
    roomCode: function () { return S.code; },

    /* 테스트용 노출 */
    createPeer: createPeer,
    hashState: hashState
  };
})(typeof window !== 'undefined' ? window : global);

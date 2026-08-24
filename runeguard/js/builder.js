/* RUNEGUARD — 덱 빌더
   진영별 커스텀 덱 1개를 localStorage 에 저장한다.
   규칙: 30장, 같은 카드 최대 2장, 자기 진영 + 중립 카드만. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};
  var D = RG.Data;
  var Art = RG.Art || { svg: function () { return ''; } };

  var KEY = 'runeguard.deck.v1.';

  var cur = { faction: 'vanguard', counts: {} };   /* counts: cardId -> 0|1|2 */
  var sfx = function (n) { if (RG.Audio) RG.Audio.play(n); };

  function $(id) { return global.document.getElementById(id); }
  function el(tag, cls, txt) {
    var n = global.document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }

  /* ═════════ 저장/불러오기 ═════════ */
  function savedDeck(faction) {
    try {
      var raw = global.localStorage.getItem(KEY + faction);
      if (!raw) return null;
      var list = JSON.parse(raw);
      return D.validateDeck(faction, list).ok ? list : null;
    } catch (e) { return null; }
  }

  /* 게임 시작 시 호출 — 저장된 유효한 덱이 있으면 그걸, 없으면 null(기본 덱) */
  function getDeckFor(faction) { return savedDeck(faction); }

  function countsToList(counts) {
    var out = [];
    Object.keys(counts).forEach(function (id) {
      for (var i = 0; i < counts[id]; i++) out.push(id);
    });
    return out;
  }

  function listToCounts(list) {
    var out = {};
    list.forEach(function (id) { out[id] = (out[id] || 0) + 1; });
    return out;
  }

  function total() {
    var t = 0;
    Object.keys(cur.counts).forEach(function (id) { t += cur.counts[id]; });
    return t;
  }

  /* ═════════ 편집 ═════════ */
  function loadFaction(faction) {
    cur.faction = faction;
    var saved = savedDeck(faction);
    cur.counts = listToCounts(saved || D.buildDeck(faction));
  }

  function addCard(id) {
    var c = D.CARDS[id];
    if (!c) return;
    if ((cur.counts[id] || 0) >= 2) { sfx('error'); return; }
    if (total() >= D.DECK_SIZE) { sfx('error'); status(D.DECK_SIZE + '장이 가득 찼습니다 — 먼저 빼세요.', true); return; }
    cur.counts[id] = (cur.counts[id] || 0) + 1;
    sfx('click');
    render();
  }

  function removeCard(id) {
    if (!cur.counts[id]) return;
    cur.counts[id] -= 1;
    if (cur.counts[id] === 0) delete cur.counts[id];
    sfx('cancel');
    render();
  }

  function save() {
    var list = countsToList(cur.counts);
    var v = D.validateDeck(cur.faction, list);
    if (!v.ok) { status('저장 불가: ' + v.error, true); sfx('error'); return; }
    try { global.localStorage.setItem(KEY + cur.faction, JSON.stringify(list)); } catch (e) {}
    status('저장 완료 — 이제 ' + D.FACTIONS[cur.faction].name + ' 로 시작하면 이 덱을 씁니다.');
    sfx('power');
    render();
  }

  function resetDefault() {
    cur.counts = listToCounts(D.buildDeck(cur.faction));
    try { global.localStorage.removeItem(KEY + cur.faction); } catch (e) {}
    status('기본 덱으로 되돌렸습니다.');
    sfx('draw');
    render();
  }

  function status(txt, isErr) {
    var n = $('bStatus');
    if (!n) return;
    n.textContent = txt || '';
    n.classList.toggle('is-err', !!isErr);
  }

  /* ═════════ 렌더 ═════════ */
  function poolIds() {
    return Object.keys(D.CARDS).filter(function (id) {
      var c = D.CARDS[id];
      if (c.type !== 'unit' && c.type !== 'spell') return false;
      if (id === 'n_coin') return false;
      return c.faction === cur.faction || c.faction === 'neutral';
    }).sort(function (a, b) {
      var ca = D.CARDS[a], cb = D.CARDS[b];
      if ((ca.faction === 'neutral') !== (cb.faction === 'neutral')) return ca.faction === 'neutral' ? 1 : -1;
      if (ca.cost !== cb.cost) return ca.cost - cb.cost;
      return ca.name.localeCompare(cb.name, 'ko');
    });
  }

  function tipOn(node, id) {
    node.addEventListener('mouseenter', function () {
      if (RG.UI && RG.UI.showCardTip) RG.UI.showCardTip(id, node);
    });
    node.addEventListener('mouseleave', hideTip);
  }
  function hideTip() {
    if (RG.UI && RG.UI.hideCardTip) RG.UI.hideCardTip();
  }

  function render() {
    var doc = global.document;
    if (!doc || $('builder').hidden) return;
    hideTip();

    /* 진영 탭 */
    var fh = $('bFactions');
    fh.innerHTML = '';
    D.FACTION_ORDER.forEach(function (fid) {
      var f = D.FACTIONS[fid];
      var b = el('button', 'chip' + (cur.faction === fid ? ' is-on' : ''),
        f.name + (savedDeck(fid) ? ' ●' : ''));
      b.style.setProperty('--accent', f.color);
      b.addEventListener('click', function () {
        loadFaction(fid); sfx('select'); status(''); render();
      });
      fh.appendChild(b);
    });

    /* 카운터 */
    var t = total();
    $('bCount').textContent = t + ' / ' + D.DECK_SIZE + '장';
    $('bCount').classList.toggle('is-ok', t === D.DECK_SIZE);

    /* 카드 풀 */
    var pool = $('bPool');
    pool.innerHTML = '';
    poolIds().forEach(function (id) {
      var c = D.CARDS[id];
      var fac = D.FACTIONS[c.faction];
      var have = cur.counts[id] || 0;
      var node = el('div', 'bp-card' + (have >= 2 ? ' is-max' : ''));
      node.style.setProperty('--accent', fac ? fac.color : '#8e97b3');
      node.innerHTML =
        '<div class="bp-cost">' + c.cost + '</div>' +
        '<div class="bp-art">' + Art.svg(id) + '</div>' +
        '<div class="bp-name">' + c.name + '</div>' +
        (c.type === 'unit'
          ? '<div class="bp-stats">' + c.atk + ' / ' + c.hp + '</div>'
          : '<div class="bp-stats bp-spell">주문</div>') +
        '<div class="bp-have">' + (have ? '×' + have : '') + '</div>';
      if (Art.attachImg) Art.attachImg(node.querySelector('.bp-art'), id);
      tipOn(node, id);
      node.addEventListener('click', function () { addCard(id); });
      node.addEventListener('contextmenu', function (ev) { ev.preventDefault(); removeCard(id); });
      pool.appendChild(node);
    });

    /* 내 덱 목록 */
    var dk = $('bDeck');
    dk.innerHTML = '';
    Object.keys(cur.counts).sort(function (a, b) {
      var ca = D.CARDS[a], cb = D.CARDS[b];
      if (ca.cost !== cb.cost) return ca.cost - cb.cost;
      return ca.name.localeCompare(cb.name, 'ko');
    }).forEach(function (id) {
      var c = D.CARDS[id];
      var row = el('div', 'bd-row');
      row.innerHTML =
        '<span class="bd-cost">' + c.cost + '</span>' +
        '<span class="bd-name">' + c.name + '</span>' +
        '<span class="bd-n">×' + cur.counts[id] + '</span>';
      row.addEventListener('click', function () { removeCard(id); });
      tipOn(row, id);
      dk.appendChild(row);
    });
  }

  /* ═════════ 열기/닫기 ═════════ */
  function open(faction) {
    loadFaction(faction || cur.faction);
    status('카드를 클릭해 넣고, 오른쪽 목록을 클릭해 뺍니다. (풀에서 우클릭도 빼기)');
    $('builder').hidden = false;
    sfx('select');
    render();
  }
  function close() {
    hideTip();
    $('builder').hidden = true;
    sfx('cancel');
  }

  function init() {
    if (!global.document) return;
    $('builderClose').addEventListener('click', close);
    $('bSave').addEventListener('click', save);
    $('bReset').addEventListener('click', resetDefault);
    global.document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('builder').hidden) close();
    });
  }

  RG.Builder = { open: open, close: close, init: init, getDeckFor: getDeckFor };
})(typeof window !== 'undefined' ? window : global);

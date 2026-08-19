/* RUNEGUARD — 카드 / 진영 / 상수 데이터  (v0.2)
   전역 RG.Data 로 노출. 모듈 없이 file:// 로도 실행되게 유지한다. */
(function (global) {
  'use strict';

  var RG = global.RG = global.RG || {};

  /* ═══════════════ 보드 상수 ═══════════════ */
  var COLS = 9;
  var ROWS = 5;
  var ARK_INDEX = 2 * COLS + 4;      /* (r2, c4) 정중앙 */
  var ARK_TURNS_TO_WIN = 4;          /* 아크를 이 횟수만큼 자기 턴 시작에 점거하면 승리 */
  var MAX_MANA = 10;
  var HAND_LIMIT = 8;
  var DECK_SIZE = 30;
  var HERO_POWER_COST = 2;
  var STRUCTURE_COST = 3;
  var STRUCTURE_COOLDOWN = 4;        /* 건설 후 재건설까지 대기 턴 */
  var STRUCTURE_HP = 6;

  /* ═══════════════ 키워드 ═══════════════ */
  var KW = {
    CHARGE: '돌진',
    SWIFT: '질주',
    PROVOKE: '도발',
    BULWARK: '방벽',
    FLYING: '비행',
    LEAP: '도약',
    LIFESTEAL: '흡혈',
    FIRST: '선제공격'
  };

  var KW_DESC = {
    '돌진': '소환된 턴에 즉시 행동할 수 있다.',
    '질주': '턴당 공격을 2회 할 수 있다.',
    '도발': '인접한 적은 이동할 수 없고, 이 유닛만 공격할 수 있다.',
    '방벽': '받는 피해가 1 줄어든다.',
    '비행': '이동할 때 다른 유닛을 넘어간다.',
    '도약': 'L자로 도약해 이동한다.',
    '흡혈': '입힌 피해만큼 아군 장군의 HP를 회복시킨다.',
    '선제공격': '공격해서 상대를 죽이면 반격 피해를 받지 않는다.'
  };

  /* ═══════════════ 진영 ═══════════════ */
  var FACTIONS = {
    vanguard: {
      id: 'vanguard', name: '밴가드', tag: 'VANGUARD', icon: '⌖',
      color: '#f5b942',
      blurb: '소총과 전차. 사거리 밖에서 일방적으로 두들긴다.',
      general: 'gen_volkov',
      power: { id: 'aimedShot', name: '조준 사격', target: 'enemyUnit',
               text: '적 유닛 1체에 2 피해를 준다.' }
    },
    exile: {
      id: 'exile', name: '엑자일', tag: 'EXILE', icon: '✚',
      color: '#58a8ff',
      blurb: '기사단의 방벽과 버프. 라인을 세우고 밀어붙인다.',
      general: 'gen_arden',
      power: { id: 'conscript', name: '징집', target: 'none',
               text: '장군 인접 빈 칸에 견습 기사(2/1)를 소환한다.' }
    },
    arcane: {
      id: 'arcane', name: '아케인', tag: 'ARCANE', icon: '✦',
      color: '#c084ff',
      blurb: '비행선과 주문. 진형을 무시하고 아크를 노린다.',
      general: 'gen_selene',
      power: { id: 'conjure', name: '주문 연성', target: 'none', cost: 3,
               text: '무작위 아케인 주문 1장을 손에 넣는다.' }
    },
    demon: {
      id: 'demon', name: '데몬', tag: 'DEMON', icon: '⏣',
      color: '#ff6b5e',
      blurb: '압도적 체급과 자해의 대가. 하이 리스크 하이 리턴.',
      general: 'gen_karnak',
      power: { id: 'hellbrand', name: '지옥불', target: 'enemyUnit',
               text: '내 장군이 1 피해를 받고, 적 유닛 1체에 3 피해를 준다.' }
    }
  };

  var FACTION_ORDER = ['vanguard', 'exile', 'arcane', 'demon'];

  /* 전장 지형 — 게임 시작 시 시드로 랜덤 결정 (온라인 양측 동일) */
  var THEMES = [
    { id: 'grass',   name: '초원' },
    { id: 'desert',  name: '사막' },
    { id: 'ice',     name: '빙원' },
    { id: 'volcano', name: '화산지대' },
    { id: 'dusk',    name: '황혼 습지' }
  ];

  /* ═══════════════ 카드 정의 ═══════════════
     type   : 'general' | 'unit' | 'spell' | 'token' | 'structure'
     mv     : 기동력(직교 이동 칸 수)   rng : 공격 사거리(체비셰프)
     target : 플레이 시 지정할 대상 — none | enemyUnit | allyUnit | anyUnit
     target2: 2차 대상 (emptyCell)
     onSummon / onDeath / spell : 효과 객체
     aura   : { atk:n } 인접 아군 공격력 보너스 / { spellPower:n } 주문 피해 보너스   */
  var CARDS = {};

  function card(def) { CARDS[def.id] = def; return def; }

  /* ── 장군 ── */
  card({ id: 'gen_volkov', name: '사령관', faction: 'vanguard', type: 'general',
         cost: 0, atk: 2, hp: 25, mv: 1, rng: 1, keywords: [], art: '⌖',
         text: '밴가드의 장군. 쓰러지면 패배한다.' });
  card({ id: 'gen_arden', name: '성왕', faction: 'exile', type: 'general',
         cost: 0, atk: 3, hp: 25, mv: 1, rng: 1, keywords: [], art: '✚',
         text: '엑자일의 장군. 쓰러지면 패배한다.' });
  card({ id: 'gen_selene', name: '대현자', faction: 'arcane', type: 'general',
         cost: 0, atk: 2, hp: 24, mv: 1, rng: 1, keywords: [], art: '✦',
         text: '아케인의 장군. 쓰러지면 패배한다.' });
  card({ id: 'gen_karnak', name: '마왕', faction: 'demon', type: 'general',
         cost: 0, atk: 3, hp: 26, mv: 1, rng: 1, keywords: [], art: '⏣',
         text: '데몬의 장군. 쓰러지면 패배한다.' });

  /* ── 구조물 ── */
  card({ id: 'st_spire', name: '마나 첨탑', faction: 'neutral', type: 'structure',
         cost: STRUCTURE_COST, atk: 0, hp: STRUCTURE_HP, mv: 0, rng: 0, keywords: [], art: '◆',
         text: '내 턴 시작 시 마나를 1 얻는다. (상한 무시, 그 턴 한정)' });
  card({ id: 'st_barracks', name: '병영', faction: 'neutral', type: 'structure',
         cost: STRUCTURE_COST, atk: 0, hp: STRUCTURE_HP, mv: 0, rng: 0, keywords: [], art: '⌂',
         text: '내 턴 시작 시 인접 빈 칸에 병사(1/1)를 소환한다.' });
  card({ id: 'st_shrine', name: '전투 신단', faction: 'neutral', type: 'structure',
         cost: STRUCTURE_COST, atk: 0, hp: STRUCTURE_HP, mv: 0, rng: 0, keywords: [], art: '▲',
         aura: { atk: 1 },
         text: '인접한 아군 유닛의 공격력이 1 증가한다.' });

  var STRUCTURE_IDS = ['st_spire', 'st_barracks', 'st_shrine'];

  /* ── 토큰 ── */
  card({ id: 'tk_soldier', name: '병사', faction: 'neutral', type: 'token',
         cost: 0, atk: 1, hp: 1, mv: 2, rng: 1, keywords: [], art: '▪',
         text: '병영이 생산한 병사.' });

  /* ═══════════════ 중립 카드 (8종) ═══════════════ */
  card({ id: 'n_scout', name: '척후병', faction: 'neutral', type: 'unit',
         cost: 1, atk: 1, hp: 2, mv: 2, rng: 1, keywords: [KW.CHARGE], art: '⚑',
         text: '돌진.' });
  card({ id: 'n_bulwark', name: '방벽병', faction: 'neutral', type: 'unit',
         cost: 2, atk: 1, hp: 4, mv: 1, rng: 1, keywords: [KW.PROVOKE], art: '▮',
         text: '도발.' });
  card({ id: 'n_merc', name: '용병 검사', faction: 'neutral', type: 'unit',
         cost: 3, atk: 3, hp: 3, mv: 2, rng: 1, keywords: [], art: '†',
         text: '군더더기 없는 전열 병력.' });
  card({ id: 'n_medic', name: '야전 의무병', faction: 'neutral', type: 'unit',
         cost: 3, atk: 2, hp: 2, mv: 2, rng: 1, keywords: [], art: '✜',
         target: 'allyUnit',
         onSummon: { k: 'heal', amount: 3, scope: 'target' },
         text: '개시: 아군 유닛 1체의 HP를 3 회복시킨다.' });
  card({ id: 'n_looter', name: '노획꾼', faction: 'neutral', type: 'unit',
         cost: 4, atk: 3, hp: 4, mv: 2, rng: 1, keywords: [], art: '⚒',
         onDeath: { k: 'draw', amount: 1 },
         text: '유언: 카드를 1장 뽑는다.' });
  card({ id: 'n_golem', name: '강철 골렘', faction: 'neutral', type: 'unit',
         cost: 5, atk: 5, hp: 5, mv: 1, rng: 1, keywords: [KW.BULWARK], art: '⬢',
         text: '방벽.' });
  card({ id: 'n_warlord', name: '전선 지휘관', faction: 'neutral', type: 'unit',
         cost: 5, atk: 3, hp: 5, mv: 2, rng: 1, keywords: [], art: '⚐',
         aura: { atk: 1 },
         text: '오라: 인접한 아군의 공격력 +1.' });
  card({ id: 'n_regroup', name: '전술 재편', faction: 'neutral', type: 'spell',
         cost: 2, art: '❖', target: 'none',
         spell: { k: 'draw', amount: 2 },
         text: '카드를 2장 뽑는다.' });

  /* 후공 보정 — 덱에 들어가지 않고 게임 시작 시 후공 손패에만 지급된다 */
  card({ id: 'n_coin', name: '선제 보급', faction: 'neutral', type: 'spell',
         cost: 0, art: '◉', target: 'none',
         spell: { k: 'gainMana', amount: 1 },
         text: '이번 턴에 마나를 1 얻는다.' });

  /* ═══════════════ 밴가드 (12종) ═══════════════ */
  card({ id: 'v_rifleman', name: '소총병', faction: 'vanguard', type: 'unit',
         cost: 2, atk: 2, hp: 2, mv: 2, rng: 2, keywords: [], art: '⌐',
         text: '사거리 2. 멀리서 쏘면 반격을 받지 않는다.' });
  card({ id: 'v_sapper', name: '공병', faction: 'vanguard', type: 'unit',
         cost: 2, atk: 1, hp: 3, mv: 2, rng: 1, keywords: [], art: '⚙',
         onSummon: { k: 'draw', amount: 1 },
         text: '개시: 카드를 1장 뽑는다.' });
  card({ id: 'v_sniper', name: '저격수', faction: 'vanguard', type: 'unit',
         cost: 3, atk: 2, hp: 2, mv: 1, rng: 3, keywords: [], art: '↟',
         text: '사거리 3.' });
  card({ id: 'v_shock', name: '강습병', faction: 'vanguard', type: 'unit',
         cost: 3, atk: 3, hp: 2, mv: 2, rng: 1, keywords: [KW.CHARGE], art: '➤',
         text: '돌진.' });
  card({ id: 'v_precision', name: '정밀 사격', faction: 'vanguard', type: 'spell',
         cost: 3, art: '✜', target: 'enemyAny',
         spell: { k: 'damage', amount: 4, scope: 'target' },
         text: '적 1체에 4 피해를 준다. (장군 가능)' });
  card({ id: 'v_mgnest', name: '기관총 진지', faction: 'vanguard', type: 'unit',
         cost: 4, atk: 3, hp: 5, mv: 1, rng: 2, keywords: [KW.PROVOKE], art: '⊟',
         text: '도발. 사거리 2.' });
  card({ id: 'v_barrage', name: '포격 요청', faction: 'vanguard', type: 'spell',
         cost: 4, art: '✺', target: 'enemyUnit',
         spell: { k: 'damage', amount: 3, scope: 'aoe1' },
         text: '대상과 인접한 모든 유닛에 3 피해를 준다.' });
  card({ id: 'v_flare', name: '조명탄', faction: 'vanguard', type: 'spell',
         cost: 1, art: '☀', target: 'enemyAny',
         spell: { k: 'seq', list: [ { k: 'damage', amount: 1, scope: 'target' },
                                    { k: 'draw', amount: 1 } ] },
         text: '적 1체에 1 피해를 주고 카드를 1장 뽑는다. (장군 가능)' });
  card({ id: 'v_trench', name: '참호 구축', faction: 'vanguard', type: 'spell',
         cost: 2, art: '⌷', target: 'allyUnit',
         spell: { k: 'seq', list: [ { k: 'buff', atk: 0, hp: 3, scope: 'target' },
                                    { k: 'grantKeyword', kw: '도발', scope: 'target' } ] },
         text: '아군 유닛 1체에 +0/+3 과 도발을 부여한다.' });
  card({ id: 'v_mortar', name: '박격포반', faction: 'vanguard', type: 'unit',
         cost: 5, atk: 2, hp: 4, mv: 1, rng: 3, keywords: [], art: '⌂',
         text: '사거리 3.' });
  card({ id: 'v_apc', name: '장갑차', faction: 'vanguard', type: 'unit',
         cost: 5, atk: 4, hp: 5, mv: 3, rng: 1, keywords: [], art: '▤',
         text: '기동력 3.' });
  card({ id: 'v_tank', name: '주력 전차', faction: 'vanguard', type: 'unit',
         cost: 7, atk: 6, hp: 7, mv: 2, rng: 2, keywords: [], art: '▰',
         text: '사거리 2. 전장의 지배자.' });

  /* ── 신규 (v0.6, 기본 덱 미포함 — 덱 빌딩용) ── */
  card({ id: 'v_grenadier', name: '척탄병', faction: 'vanguard', type: 'unit',
         cost: 3, atk: 2, hp: 3, mv: 2, rng: 1, keywords: [], art: '⊕',
         target: 'enemyUnit',
         onSummon: { k: 'damage', amount: 2, scope: 'aoe1' },
         text: '개시: 적 유닛 1체와 그 주변 모두에게 2 피해. (아군도 휘말린다)' });
  card({ id: 'v_railgun', name: '레일건 포대', faction: 'vanguard', type: 'unit',
         cost: 6, atk: 4, hp: 4, mv: 1, rng: 4, keywords: [], art: '⌁',
         text: '사거리 4 — 전장 최장 사거리.' });

  /* ═══════════════ 엑자일 (12종) ═══════════════ */
  card({ id: 'e_squire', name: '견습 기사', faction: 'exile', type: 'unit',
         cost: 1, atk: 2, hp: 2, mv: 2, rng: 1, keywords: [], art: '⚔',
         text: '엑자일의 기본 병력.' });
  card({ id: 'e_shield', name: '방패 기사', faction: 'exile', type: 'unit',
         cost: 2, atk: 2, hp: 5, mv: 1, rng: 1, keywords: [KW.PROVOKE], art: '⛨',
         text: '도발.' });
  card({ id: 'e_retainer', name: '종자', faction: 'exile', type: 'unit',
         cost: 2, atk: 2, hp: 2, mv: 2, rng: 1, keywords: [], art: '⚑',
         onDeath: { k: 'summonToken', token: 'e_squire', count: 1, where: 'adjacentSelf' },
         text: '유언: 견습 기사를 소환한다.' });
  card({ id: 'e_sanctuary', name: '성역', faction: 'exile', type: 'spell',
         cost: 2, art: '✧', target: 'allyUnit',
         spell: { k: 'buff', atk: 2, hp: 2, scope: 'target' },
         text: '아군 유닛 1체에 +2/+2 를 부여한다.' });
  card({ id: 'e_templar', name: '성전 기사', faction: 'exile', type: 'unit',
         cost: 3, atk: 3, hp: 4, mv: 3, rng: 1, keywords: [], art: '✞',
         onSummon: { k: 'heal', amount: 2, scope: 'myGeneral' },
         text: '개시: 아군 장군의 HP를 2 회복시킨다.' });
  card({ id: 'e_judgment', name: '심판', faction: 'exile', type: 'spell',
         cost: 3, art: '⚡', target: 'enemyAny',
         spell: { k: 'seq', list: [ { k: 'damage', amount: 4, scope: 'target' },
                                    { k: 'heal', amount: 2, scope: 'myGeneral' } ] },
         text: '적 1체에 4 피해를 주고 아군 장군의 HP를 2 회복시킨다. (장군 가능)' });
  card({ id: 'e_warhorn', name: '진격 나팔', faction: 'exile', type: 'spell',
         cost: 3, art: '♪', target: 'none',
         spell: { k: 'refresh' },
         text: '내 모든 유닛이 이번 턴 행동을 다시 할 수 있다.' });
  card({ id: 'e_lancer', name: '창기병', faction: 'exile', type: 'unit',
         cost: 4, atk: 4, hp: 3, mv: 3, rng: 1, keywords: [KW.CHARGE, KW.FIRST], art: '↑',
         text: '돌진, 선제공격. 기동력 3.' });
  card({ id: 'e_gale', name: '질풍 기사', faction: 'exile', type: 'unit',
         cost: 4, atk: 4, hp: 5, mv: 1, rng: 1, keywords: [KW.LEAP], art: '♞',
         text: '도약: 체스 나이트처럼 L자로 뛴다.' });
  card({ id: 'e_paladin', name: '수호 성기사', faction: 'exile', type: 'unit',
         cost: 5, atk: 4, hp: 6, mv: 3, rng: 1, keywords: [KW.PROVOKE, KW.BULWARK], art: '⛊',
         text: '도발, 방벽.' });
  card({ id: 'e_marshal', name: '대장군', faction: 'exile', type: 'unit',
         cost: 6, atk: 4, hp: 7, mv: 2, rng: 1, keywords: [], art: '★',
         aura: { atk: 2 },
         text: '오라: 인접한 아군의 공격력 +2.' });
  card({ id: 'e_grandmaster', name: '성기사단장', faction: 'exile', type: 'unit',
         cost: 7, atk: 6, hp: 7, mv: 3, rng: 1, keywords: [], art: '✠',
         onSummon: { k: 'summonToken', token: 'e_squire', count: 2, where: 'adjacentSelf' },
         text: '개시: 인접 빈 칸에 견습 기사 2체를 소환한다.' });

  /* ── 신규 (v0.6) ── */
  card({ id: 'e_banneret', name: '기수', faction: 'exile', type: 'unit',
         cost: 3, atk: 2, hp: 4, mv: 2, rng: 1, keywords: [], art: '⚑',
         aura: { atk: 1 },
         text: '오라: 인접한 아군의 공격력 +1.' });
  card({ id: 'e_vindicator', name: '복수자', faction: 'exile', type: 'unit',
         cost: 5, atk: 5, hp: 4, mv: 2, rng: 1, keywords: [KW.FIRST], art: '✠',
         text: '선제공격.' });

  /* ═══════════════ 아케인 (12종) ═══════════════ */
  card({ id: 'a_apprentice', name: '견습 마법사', faction: 'arcane', type: 'unit',
         cost: 1, atk: 1, hp: 3, mv: 2, rng: 2, keywords: [], art: '✧',
         growOnSpell: { atk: 1, hp: 1 },
         text: '사거리 2. 내가 주문을 시전할 때마다 +1/+1.' });
  card({ id: 'a_bolt', name: '마력탄', faction: 'arcane', type: 'spell',
         cost: 1, art: '✹', target: 'enemyAny',
         spell: { k: 'damage', amount: 2, scope: 'target' },
         text: '적 1체에 2 피해를 준다. (장군 가능)' });
  card({ id: 'a_floatstone', name: '부유석', faction: 'arcane', type: 'unit',
         cost: 2, atk: 2, hp: 3, mv: 3, rng: 1, keywords: [KW.FLYING], art: '◇',
         text: '비행. 기동력 3.' });
  card({ id: 'a_rift', name: '차원 균열', faction: 'arcane', type: 'spell',
         cost: 2, art: '◎', target: 'allyUnit', target2: 'emptyCell',
         spell: { k: 'teleport', range: 99 },
         text: '아군 유닛 1체를 보드의 빈 칸 아무 곳으로나 옮긴다.' });
  card({ id: 'a_elementalist', name: '원소술사', faction: 'arcane', type: 'unit',
         cost: 3, atk: 3, hp: 3, mv: 2, rng: 1, keywords: [], art: '❉',
         target: 'enemyAny',
         onSummon: { k: 'damage', amount: 2, scope: 'target' },
         text: '개시: 적 1체에 2 피해를 준다. (장군 가능)' });
  card({ id: 'a_skiff', name: '비행정', faction: 'arcane', type: 'unit',
         cost: 4, atk: 4, hp: 4, mv: 3, rng: 1, keywords: [KW.FLYING], art: '⛵',
         text: '비행. 기동력 3.' });
  card({ id: 'a_chrono', name: '시간 술사', faction: 'arcane', type: 'unit',
         cost: 4, atk: 2, hp: 4, mv: 2, rng: 1, keywords: [], art: '⧗',
         onSummon: { k: 'draw', amount: 2 },
         text: '개시: 카드를 2장 뽑는다.' });
  card({ id: 'a_chain', name: '연쇄 번개', faction: 'arcane', type: 'spell',
         cost: 4, art: '⚡', target: 'none',
         spell: { k: 'multiDamage', amount: 2, count: 3 },
         text: '무작위 적 유닛 3체에 각각 2 피해를 준다.' });
  card({ id: 'a_guard', name: '비전 수호자', faction: 'arcane', type: 'unit',
         cost: 5, atk: 3, hp: 6, mv: 2, rng: 1, keywords: [KW.PROVOKE, KW.FLYING], art: '⬡',
         text: '도발, 비행.' });
  card({ id: 'a_cataclysm', name: '대마법', faction: 'arcane', type: 'spell',
         cost: 5, art: '✷', target: 'none',
         spell: { k: 'damage', amount: 3, scope: 'allEnemies' },
         text: '적의 모든 유닛에 3 피해를 준다. (장군 제외)' });
  card({ id: 'a_sage', name: '아르카나 현자', faction: 'arcane', type: 'unit',
         cost: 6, atk: 3, hp: 5, mv: 2, rng: 1, keywords: [], art: '☾',
         aura: { spellPower: 1 },
         text: '오라: 내 주문의 피해가 1 증가한다.' });
  card({ id: 'a_galleon', name: '폭풍 갈레온', faction: 'arcane', type: 'unit',
         cost: 7, atk: 5, hp: 7, mv: 3, rng: 2, keywords: [KW.FLYING], art: '⛴',
         text: '비행. 기동력 3, 사거리 2.' });

  /* ── 신규 (v0.6) ── */
  card({ id: 'a_archivist', name: '비전 기록자', faction: 'arcane', type: 'unit',
         cost: 4, atk: 2, hp: 5, mv: 2, rng: 2, keywords: [], art: '☍',
         growOnSpell: { atk: 1, hp: 0 },
         text: '사거리 2. 내가 주문을 시전할 때마다 +1/+0.' });
  card({ id: 'a_stormcall', name: '폭풍 부름', faction: 'arcane', type: 'spell',
         cost: 3, art: '≋', target: 'none',
         spell: { k: 'multiDamage', amount: 1, count: 4 },
         text: '무작위 적 유닛 4체에 각각 1 피해를 준다.' });

  /* ═══════════════ 데몬 (12종) ═══════════════ */
  card({ id: 'd_imp', name: '임프', faction: 'demon', type: 'unit',
         cost: 1, atk: 2, hp: 1, mv: 2, rng: 1, keywords: [KW.CHARGE], art: '෴',
         text: '돌진.' });
  card({ id: 'd_pact', name: '악마의 계약', faction: 'demon', type: 'spell',
         cost: 1, art: '☠', target: 'allyUnit',
         spell: { k: 'buff', atk: 3, hp: 0, scope: 'target' },
         text: '아군 유닛 1체에 +3/+0 을 부여한다.' });
  card({ id: 'd_hound', name: '지옥견', faction: 'demon', type: 'unit',
         cost: 2, atk: 3, hp: 1, mv: 3, rng: 1, keywords: [KW.FIRST], art: '⨂',
         text: '선제공격. 기동력 3.' });
  card({ id: 'd_sacrifice', name: '제물', faction: 'demon', type: 'spell',
         cost: 2, art: '⌁', target: 'allyUnit',
         spell: { k: 'seq', list: [ { k: 'destroy', scope: 'target' },
                                    { k: 'draw', amount: 2 } ] },
         text: '아군 유닛 1체를 파괴하고 카드를 2장 뽑는다.' });
  card({ id: 'd_tormentor', name: '고문관', faction: 'demon', type: 'unit',
         cost: 3, atk: 2, hp: 4, mv: 2, rng: 1, keywords: [], art: '⛧',
         onSummon: { k: 'seq', list: [ { k: 'selfDamage', amount: 2 },
                                       { k: 'draw', amount: 2 } ] },
         text: '개시: 내 장군이 2 피해를 받고 카드를 2장 뽑는다.' });
  card({ id: 'd_bones', name: '뼈 수집가', faction: 'demon', type: 'unit',
         cost: 3, atk: 2, hp: 3, mv: 2, rng: 1, keywords: [], art: '☣',
         onDeath: { k: 'summonToken', token: 'd_imp', count: 2, where: 'adjacentSelf' },
         text: '유언: 임프 2체를 소환한다.' });
  card({ id: 'd_ravager', name: '파괴자', faction: 'demon', type: 'unit',
         cost: 4, atk: 5, hp: 3, mv: 3, rng: 1, keywords: [], art: '⚔',
         text: '공격력 5. 유리 대포.' });
  card({ id: 'd_soul', name: '영혼 포식자', faction: 'demon', type: 'unit',
         cost: 4, atk: 4, hp: 4, mv: 3, rng: 1, keywords: [KW.LIFESTEAL], art: '❦',
         text: '흡혈.' });
  card({ id: 'd_hellfire', name: '지옥불', faction: 'demon', type: 'spell',
         cost: 4, art: '🔥', target: 'none',
         spell: { k: 'damage', amount: 3, scope: 'allUnits' },
         text: '아군을 포함한 모든 유닛에 3 피해를 준다. (장군 제외)' });
  card({ id: 'd_abyss', name: '심연의 수호자', faction: 'demon', type: 'unit',
         cost: 5, atk: 3, hp: 7, mv: 2, rng: 1, keywords: [KW.PROVOKE], art: '⬣',
         text: '도발.' });
  card({ id: 'd_riftlord', name: '균열의 군주', faction: 'demon', type: 'unit',
         cost: 6, atk: 4, hp: 6, mv: 2, rng: 1, keywords: [], art: '⏥',
         target: 'enemyAny',
         onSummon: { k: 'damage', amount: 4, scope: 'target' },
         text: '개시: 적 1체에 4 피해를 준다. (장군 가능)' });
  card({ id: 'd_valgar', name: '대공 발가르', faction: 'demon', type: 'unit',
         cost: 8, atk: 7, hp: 7, mv: 3, rng: 1, keywords: [KW.CHARGE], art: '⛥',
         text: '돌진. 전장에 강림하는 순간 모든 것이 무너진다.' });

  /* ── 신규 (v0.6): 데몬 ── */
  card({ id: 'd_glutton', name: '탐식귀', faction: 'demon', type: 'unit',
         cost: 3, atk: 3, hp: 3, mv: 2, rng: 1, keywords: [KW.LIFESTEAL], art: 'ᛥ',
         text: '흡혈.' });
  card({ id: 'd_warfiend', name: '전쟁마귀', faction: 'demon', type: 'unit',
         cost: 6, atk: 4, hp: 5, mv: 2, rng: 1, keywords: [KW.SWIFT], art: '⍟',
         text: '질주 — 턴당 두 번 공격한다.' });

  /* ── 신규 (v0.6): 중립 ── */
  card({ id: 'n_duelist', name: '결투가', faction: 'neutral', type: 'unit',
         cost: 3, atk: 3, hp: 2, mv: 2, rng: 1, keywords: [KW.FIRST], art: '✗',
         text: '선제공격.' });
  card({ id: 'n_windrider', name: '바람 기수', faction: 'neutral', type: 'unit',
         cost: 4, atk: 3, hp: 3, mv: 2, rng: 1, keywords: [KW.FLYING], art: '≫',
         text: '비행.' });

  /* ═══════════════ 기본 덱 (진영 12종 x2 + 중립 3종 x2 = 30장) ═══════════════ */
  var NEUTRAL_PICKS = {
    vanguard: ['n_merc', 'n_medic', 'n_regroup'],
    exile:      ['n_bulwark', 'n_merc', 'n_warlord'],
    arcane:     ['n_merc', 'n_looter', 'n_regroup'],
    demon:      ['n_scout', 'n_merc', 'n_golem']
  };

  function factionCardIds(factionId) {
    return Object.keys(CARDS).filter(function (id) {
      var c = CARDS[id];
      return c.faction === factionId && (c.type === 'unit' || c.type === 'spell');
    });
  }

  /* 기본 덱의 고유 12종 — 신규 카드는 여기 없고 덱 빌딩으로만 넣는다 */
  var DEFAULT_UNIQUES = {
    vanguard: ['v_rifleman', 'v_sapper', 'v_sniper', 'v_shock', 'v_precision', 'v_mgnest',
               'v_barrage', 'v_flare', 'v_trench', 'v_mortar', 'v_apc', 'v_tank'],
    exile:    ['e_squire', 'e_shield', 'e_retainer', 'e_sanctuary', 'e_templar', 'e_judgment',
               'e_warhorn', 'e_lancer', 'e_gale', 'e_paladin', 'e_marshal', 'e_grandmaster'],
    arcane:   ['a_apprentice', 'a_bolt', 'a_floatstone', 'a_rift', 'a_elementalist', 'a_skiff',
               'a_chrono', 'a_chain', 'a_guard', 'a_cataclysm', 'a_sage', 'a_galleon'],
    demon:    ['d_imp', 'd_pact', 'd_hound', 'd_sacrifice', 'd_tormentor', 'd_bones',
               'd_ravager', 'd_soul', 'd_hellfire', 'd_abyss', 'd_riftlord', 'd_valgar']
  };

  function buildDeck(factionId) {
    var deck = [];
    DEFAULT_UNIQUES[factionId].forEach(function (id) { deck.push(id, id); });
    NEUTRAL_PICKS[factionId].forEach(function (id) { deck.push(id, id); });
    return deck;
  }

  /* 덱 유효성 — 덱 빌딩과 온라인 수신 양쪽에서 쓴다 */
  function validateDeck(factionId, list) {
    if (!Array.isArray(list)) return { ok: false, error: '형식 오류' };
    if (list.length !== DECK_SIZE) return { ok: false, error: DECK_SIZE + '장이 아닙니다 (' + list.length + '장)' };
    var counts = {};
    for (var i = 0; i < list.length; i++) {
      var c = CARDS[list[i]];
      if (!c) return { ok: false, error: '없는 카드: ' + list[i] };
      if (c.type !== 'unit' && c.type !== 'spell') return { ok: false, error: '덱에 넣을 수 없음: ' + c.name };
      if (c.faction !== factionId && c.faction !== 'neutral') return { ok: false, error: '타 진영 카드: ' + c.name };
      if (c.id === 'n_coin') return { ok: false, error: '선제 보급은 덱에 넣을 수 없습니다' };
      counts[list[i]] = (counts[list[i]] || 0) + 1;
      if (counts[list[i]] > 2) return { ok: false, error: '2장 초과: ' + c.name };
    }
    return { ok: true };
  }

  /* ═══════════════ 방향 벡터 ═══════════════ */
  var DIR_ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  var DIR_ALL = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var LEAP_OFFSETS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

  RG.Data = {
    COLS: COLS, ROWS: ROWS,
    ARK_INDEX: ARK_INDEX, ARK_TURNS_TO_WIN: ARK_TURNS_TO_WIN,
    MAX_MANA: MAX_MANA, HAND_LIMIT: HAND_LIMIT, DECK_SIZE: DECK_SIZE,
    HERO_POWER_COST: HERO_POWER_COST,
    STRUCTURE_COST: STRUCTURE_COST, STRUCTURE_COOLDOWN: STRUCTURE_COOLDOWN,
    STRUCTURE_HP: STRUCTURE_HP, STRUCTURE_IDS: STRUCTURE_IDS,
    KW: KW, KW_DESC: KW_DESC,
    FACTIONS: FACTIONS, FACTION_ORDER: FACTION_ORDER,
    THEMES: THEMES,
    CARDS: CARDS,
    NEUTRAL_PICKS: NEUTRAL_PICKS,
    factionCardIds: factionCardIds,
    buildDeck: buildDeck,
    DEFAULT_UNIQUES: DEFAULT_UNIQUES,
    validateDeck: validateDeck,
    DIR_ORTHO: DIR_ORTHO, DIR_ALL: DIR_ALL, LEAP_OFFSETS: LEAP_OFFSETS
  };
})(typeof window !== 'undefined' ? window : global);

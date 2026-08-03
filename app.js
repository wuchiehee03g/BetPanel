/**
 * BetPanel - 包廂熱場投注系統
 * 核心引擎 (Core Engine)
 * 包含所有業務邏輯、賠率計算、注單驗證與報表產出
 * 不包含任何 DOM 操作，可供玩家端與幹部端共用
 */

const DB_PATH = 'betpanel';
const DEFAULT_ODDS = 2;
const DEFAULT_PRIOR_K = 20000;
const DEFAULT_MAX_BET = 10000;
const MAX_AUTO_ODDS = 50;
const MIN_AUTO_ODDS = 1.01;
const QUICK_AMOUNTS = [500, 1000, 5000, 10000];
const DEFAULT_RAKE = 0.05; // 預設 5% 抽水

const CATEGORIES = [
  { key: 'duel', label: '1v1 對決', hint: '兩人對決，押誰贏' },
  { key: 'multi', label: '多選一', hint: '多個選項，押誰勝出' },
  { key: 'custom', label: '自訂盤口', hint: '自由設定選項與賠率' },
];

/* =========================================
 * 1. 基礎工具 (Utility)
 * ========================================= */

// 防止 XSS 攻擊
function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// 數字格式化 (含千分位)
function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-US');
}

// 產生隨機 ID
function uid() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

/* =========================================
 * 2. 包廂管理 (Room Management)
 * ========================================= */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字母
  let res = '';
  for (let i = 0; i < 6; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

function generateRoomPin() {
  let res = '';
  for (let i = 0; i < 4; i++) {
    res += Math.floor(Math.random() * 10).toString();
  }
  return res;
}

function createRoom(hostName, rakePercent = DEFAULT_RAKE, maxBet = DEFAULT_MAX_BET) {
  return {
    code: generateRoomCode(),
    hostName: hostName || '包廂主人',
    hostPin: generateRoomPin(),
    rakePercent: Number(rakePercent),
    createdAt: Date.now(),
    maxBet: Number(maxBet),
    markets: {},
    bets: {}
  };
}

function roomDbPath(roomCode) {
  return `${DB_PATH}/rooms/${roomCode.toUpperCase()}`;
}

/* =========================================
 * 3. 資料正規化 (Data Normalization)
 * ========================================= */

function normalize(raw) {
  if (!raw) return { markets: [], bets: [] };
  
  const config = raw.config || {};
  const state = {
    hostName: config.hostName || raw.hostName || '包廂主人',
    hostPin: config.pin || raw.hostPin || '',
    rakePercent: typeof config.rake === 'number' ? (config.rake / 100) : (typeof raw.rakePercent === 'number' ? raw.rakePercent : DEFAULT_RAKE),
    createdAt: config.createdAt || raw.createdAt || Date.now(),
    maxBet: typeof config.maxBet === 'number' ? config.maxBet : (typeof raw.maxBet === 'number' ? raw.maxBet : DEFAULT_MAX_BET),
    markets: [],
    bets: []
  };

  // 處理 markets
  if (raw.markets) {
    state.markets = Object.keys(raw.markets).map(mId => {
      const m = raw.markets[mId];
      const options = m.options 
        ? Object.keys(m.options).map(oId => ({ ...m.options[oId], id: oId })).sort((a, b) => (a.order || 0) - (b.order || 0))
        : [];
      return { ...m, id: mId, options };
    });
    state.markets.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  // 處理 bets
  if (raw.bets) {
    state.bets = Object.keys(raw.bets).map(bId => {
      return { ...raw.bets[bId], id: bId };
    });
    state.bets.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }

  return state;
}

/* =========================================
 * 4. 資金池計算 (Pool Calculations)
 * ========================================= */

function buildPools(state) {
  const pools = {};
  if (!state || !state.bets) return pools;
  
  for (const bet of state.bets) {
    if (!pools[bet.marketId]) pools[bet.marketId] = {};
    if (!pools[bet.marketId][bet.optionId]) pools[bet.marketId][bet.optionId] = 0;
    pools[bet.marketId][bet.optionId] += Number(bet.amount);
  }
  return pools;
}

function poolOf(pools, marketId, optId) {
  if (!pools[marketId]) return 0;
  return pools[marketId][optId] || 0;
}

function marketTotal(pools, market) {
  if (!market || !pools[market.id]) return 0;
  return Object.values(pools[market.id]).reduce((a, b) => a + b, 0);
}

/* =========================================
 * 5. 賠率引擎 (Odds Engine)
 * ========================================= */

// 計算莊家抽水比例 (Overround)
function bookOverround(market) {
  let sum = 0;
  for (const opt of market.options) {
    sum += 1 / (opt.odds || DEFAULT_ODDS);
  }
  return sum;
}

// 計算莊家利潤率 (Margin)
function bookMargin(market) {
  return bookOverround(market) - 1;
}

// 貝氏自動調盤演算法 (Bayesian Auto-Adjusting Odds)
function autoOdds(pools, market, optId) {
  const O = bookOverround(market);
  const K = typeof market.priorK === 'number' ? market.priorK : DEFAULT_PRIOR_K;
  const S = marketTotal(pools, market);
  const s_i = poolOf(pools, market.id, optId);
  
  const opt = market.options.find(o => o.id === optId);
  if (!opt) return DEFAULT_ODDS;
  
  const initialOdds = opt.odds || DEFAULT_ODDS;
  const q_i = (1 / initialOdds) / O; // 先驗機率 (真實機率，已扣除抽水)
  
  // 新賠率公式: (K + S) / (O * (K*q_i + s_i))
  let rawOdds = (K + S) / (O * (K * q_i + s_i));
  
  // 限制極端值
  rawOdds = Math.max(MIN_AUTO_ODDS, Math.min(MAX_AUTO_ODDS, rawOdds));
  return Number(rawOdds.toFixed(2));
}

// 取得當前有效賠率 (浮動或固定)
function liveOdds(pools, market, optId) {
  const opt = market.options.find(o => o.id === optId);
  if (!opt) return { value: DEFAULT_ODDS, auto: false, opening: DEFAULT_ODDS };
  
  const auto = market.autoPrice !== false; // 預設開啟自動調盤
  const opening = opt.odds || DEFAULT_ODDS;
  const value = auto ? autoOdds(pools, market, optId) : opening;
  
  return { value, auto, opening };
}

// 評估最大注額對賠率的衝擊
function maxBetImpact(priorK, maxBet, optionCount) {
  const O = 1.05; // 假設 5% 抽水
  const q_i = 1 / optionCount;
  const oldOdds = (priorK + 0) / (O * (priorK * q_i + 0));
  const newOdds = (priorK + maxBet) / (O * (priorK * q_i + maxBet));
  const dropPercent = (oldOdds - newOdds) / oldOdds;
  return dropPercent;
}

// 建議 K 值以達到目標降幅
function suggestPriorK(maxBet, optionCount, targetDrop = 0.1) {
  // 根據模擬與推導，K值可粗估為注額與選項數的函數
  // 此處提供一個簡化的經驗公式
  let k = maxBet * (1 - targetDrop) / (targetDrop * optionCount);
  return Math.max(1000, Math.round(k / 1000) * 1000);
}

/* =========================================
 * 6. 盤口建立 (Market Creation)
 * ========================================= */

function buildDuelMarket(opts) {
  const { nameA, nameB, rakePercent, priorK, maxBet, maxPerBettor, maxLiability } = opts;
  const rake = typeof rakePercent === 'number' ? rakePercent : DEFAULT_RAKE;
  const impliedProb = 0.5;
  const initialOdds = 1 / (impliedProb * (1 + rake));
  
  return {
    title: `${nameA} vs ${nameB}`,
    desc: '1v1 對決',
    category: 'duel',
    rakePercent: rake,
    autoPrice: true,
    priorK: priorK || DEFAULT_PRIOR_K,
    maxBet: maxBet || null,
    maxPerBettor: maxPerBettor || null,
    maxLiability: maxLiability || null,
    locked: false,
    settled: false,
    winnerId: null,
    order: Date.now(),
    options: [
      { id: 'optA', label: nameA, order: 1, odds: Number(initialOdds.toFixed(2)) },
      { id: 'optB', label: nameB, order: 2, odds: Number(initialOdds.toFixed(2)) }
    ]
  };
}

function buildMultiMarket(opts) {
  const { title, desc, options, rakePercent, priorK, maxBet, maxPerBettor, maxLiability } = opts;
  const rake = typeof rakePercent === 'number' ? rakePercent : DEFAULT_RAKE;
  const count = options.length;
  const impliedProb = 1 / count;
  const initialOdds = 1 / (impliedProb * (1 + rake));
  
  const mOptions = options.map((optLabel, idx) => ({
    id: `opt${idx}`,
    label: optLabel,
    order: idx,
    odds: Number(initialOdds.toFixed(2))
  }));
  
  return {
    title,
    desc,
    category: 'multi',
    rakePercent: rake,
    autoPrice: true,
    priorK: priorK || DEFAULT_PRIOR_K,
    maxBet: maxBet || null,
    maxPerBettor: maxPerBettor || null,
    maxLiability: maxLiability || null,
    locked: false,
    settled: false,
    winnerId: null,
    order: Date.now(),
    options: mOptions
  };
}

function buildCustomMarket(opts) {
  const { title, desc, options, rakePercent, autoPrice, priorK, maxBet, maxPerBettor, maxLiability } = opts;
  
  const mOptions = options.map((opt, idx) => ({
    id: `opt${idx}`,
    label: opt.label,
    order: idx,
    odds: Number(opt.odds || 2)
  }));
  
  return {
    title,
    desc,
    category: 'custom',
    rakePercent: typeof rakePercent === 'number' ? rakePercent : DEFAULT_RAKE,
    autoPrice: autoPrice !== false,
    priorK: priorK || DEFAULT_PRIOR_K,
    maxBet: maxBet || null,
    maxPerBettor: maxPerBettor || null,
    maxLiability: maxLiability || null,
    locked: false,
    settled: false,
    winnerId: null,
    order: Date.now(),
    options: mOptions
  };
}

/* =========================================
 * 7. 風險與結算 (Risk & Settlement)
 * ========================================= */

// 獲取注單鎖定的賠率 (若無則取 1.0)
function betOdds(bet) {
  return Number(bet.oddsAtBet) || 1.0;
}

// 計算若某選項獲勝，莊家的淨損益
function bankerNetIfWins(state, pools, market, winOptId) {
  if (!market) return 0;
  
  const total = marketTotal(pools, market);
  let payout = 0;
  
  for (const bet of state.bets) {
    if (bet.marketId === market.id && bet.optionId === winOptId) {
      payout += bet.amount * betOdds(bet);
    }
  }
  
  return total - payout;
}

// 計算莊家最差情況 (最大潛在虧損)
function worstCase(state, pools, market) {
  if (!market || !market.options || market.options.length === 0) return 0;
  
  let worst = Infinity;
  for (const opt of market.options) {
    const net = bankerNetIfWins(state, pools, market, opt.id);
    if (net < worst) {
      worst = net;
    }
  }
  return worst;
}

// 結算詳細資訊 (包含抽水計算)
function settleInfo(state, pools, market) {
  if (!market) return null;
  
  const total = marketTotal(pools, market);
  if (total === 0) {
    return { total: 0, payoutTotal: 0, bankerNet: 0, rakeEarned: 0, winPool: 0, empty: true };
  }
  
  if (!market.winnerId) return null; // 尚未結算
  
  let payoutTotal = 0;
  for (const bet of state.bets) {
    if (bet.marketId === market.id && bet.optionId === market.winnerId) {
      payoutTotal += bet.amount * betOdds(bet);
    }
  }
  
  const bankerNet = total - payoutTotal;
  const winPool = poolOf(pools, market.id, market.winnerId);
  const rakeEarned = total * (market.rakePercent || 0); // 理論抽水值
  
  return {
    total,
    payoutTotal,
    bankerNet,
    rakeEarned,
    winPool,
    empty: false
  };
}

// 單一注單結果
function betOutcome(state, pools, bet) {
  const market = state.markets.find(m => m.id === bet.marketId);
  if (!market || !market.settled || !market.winnerId) {
    return { status: 'pending', profit: 0, payout: 0 };
  }
  
  if (bet.optionId === market.winnerId) {
    const payout = bet.amount * betOdds(bet);
    return { status: 'win', profit: payout - bet.amount, payout };
  } else {
    return { status: 'lose', profit: -bet.amount, payout: 0 };
  }
}

/* =========================================
 * 8. 驗證邏輯 (Validation)
 * ========================================= */

// 有效最大注額 (取包廂或盤口設定的較小值)
function effectiveMaxBet(state, market) {
  if (market && market.maxBet !== null) return market.maxBet;
  return state.maxBet || DEFAULT_MAX_BET;
}

function validateBetAmount(rawAmount, maxBet) {
  const amount = Number(rawAmount);
  if (isNaN(amount) || amount <= 0) return '無效的下注金額';
  if (!Number.isInteger(amount)) return '金額必須為整數';
  if (amount > maxBet) return `單注金額不能超過 ${fmt(maxBet)}`;
  return null;
}

// 模擬下注後的莊家負債
function liabilityIfBetPlaced(state, pools, market, optId, amount, oddsAtBet) {
  const currentWorst = worstCase(state, pools, market);
  const total = marketTotal(pools, market) + amount;
  
  let newWorst = Infinity;
  for (const opt of market.options) {
    let payout = 0;
    // 原本的賠付
    for (const bet of state.bets) {
      if (bet.marketId === market.id && bet.optionId === opt.id) {
        payout += bet.amount * betOdds(bet);
      }
    }
    // 加入新注單的賠付 (如果贏了)
    if (opt.id === optId) {
      payout += amount * oddsAtBet;
    }
    
    const net = total - payout;
    if (net < newWorst) {
      newWorst = net;
    }
  }
  
  return { currentWorst, newWorst, diff: newWorst - currentWorst };
}

function checkLiability(state, pools, market, optId, amount, oddsAtBet) {
  if (!market.maxLiability) return null; // 無限制
  
  const { newWorst } = liabilityIfBetPlaced(state, pools, market, optId, amount, oddsAtBet);
  
  if (newWorst < 0 && Math.abs(newWorst) > market.maxLiability) {
    return `此注會使莊家風險超過設定上限 (上限 ${fmt(market.maxLiability)})`;
  }
  return null;
}

// 計算單一玩家在該盤口的已下注總額
function bettorStakeOn(state, marketId, bettorId, name) {
  let sum = 0;
  for (const bet of state.bets) {
    if (bet.marketId === marketId && (bet.bettorId === bettorId || bet.name === name)) {
      sum += bet.amount;
    }
  }
  return sum;
}

function checkPerBettor(state, market, bettorId, name, amount) {
  if (!market.maxPerBettor) return null;
  const staked = bettorStakeOn(state, market.id, bettorId, name);
  if (staked + amount > market.maxPerBettor) {
    return `每人此盤口最高限額為 ${fmt(market.maxPerBettor)}，您已下注 ${fmt(staked)}`;
  }
  return null;
}

function liabilityUsage(state, pools, market) {
  if (!market.maxLiability) return 0;
  const worst = worstCase(state, pools, market);
  if (worst >= 0) return 0;
  return Math.abs(worst) / market.maxLiability;
}

function isHostBanned(market, name) {
  // 簡單限制：名稱為"包廂主人"無法下注
  return name === '包廂主人' || name === '幹部';
}

/* =========================================
 * 9. 報表產出 (Reports)
 * ========================================= */

function reportByBettor(state, pools) {
  const map = {};
  
  for (const bet of state.bets) {
    const key = bet.name || bet.bettorId;
    if (!map[key]) {
      map[key] = { name: key, totalStaked: 0, winCount: 0, loseCount: 0, pendingCount: 0, profit: 0 };
    }
    
    map[key].totalStaked += bet.amount;
    
    const outcome = betOutcome(state, pools, bet);
    if (outcome.status === 'win') {
      map[key].winCount++;
      map[key].profit += outcome.profit;
    } else if (outcome.status === 'lose') {
      map[key].loseCount++;
      map[key].profit += outcome.profit;
    } else {
      map[key].pendingCount++;
    }
  }
  
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}

function reportByCategory(state, pools) {
  const map = {};
  
  for (const m of state.markets) {
    const cat = m.category || 'custom';
    if (!map[cat]) {
      map[cat] = { category: cat, marketCount: 0, totalPool: 0, bankerNet: 0 };
    }
    map[cat].marketCount++;
    map[cat].totalPool += marketTotal(pools, m);
    
    if (m.settled && m.winnerId) {
      const info = settleInfo(state, pools, m);
      if (info) {
        map[cat].bankerNet += info.bankerNet;
      }
    }
  }
  
  return Object.values(map);
}

function reportByTime(state, bucketMinutes = 60) {
  const map = {};
  const ms = bucketMinutes * 60000;
  
  for (const bet of state.bets) {
    const bucket = Math.floor(bet.ts / ms) * ms;
    if (!map[bucket]) {
      map[bucket] = { time: bucket, betCount: 0, volume: 0 };
    }
    map[bucket].betCount++;
    map[bucket].volume += bet.amount;
  }
  
  return Object.values(map).sort((a, b) => a.time - b.time);
}

function bankerExposure(state, pools) {
  let activeWorst = 0;
  let settledNet = 0;
  let totalVolume = 0;
  
  for (const m of state.markets) {
    totalVolume += marketTotal(pools, m);
    if (m.settled) {
      const info = settleInfo(state, pools, m);
      if (info) settledNet += info.bankerNet;
    } else {
      const worst = worstCase(state, pools, m);
      if (worst < 0) activeWorst += worst; // 累加潛在虧損
    }
  }
  
  return { activeWorst, settledNet, totalVolume };
}

// 產生包廂結算帳單 (Room Bill)
function roomSettlement(state, pools) {
  const playersMap = {};
  let hostNet = 0;
  let hostRake = 0;
  let totalPool = 0;

  for (const m of state.markets) {
    if (!m.settled) continue;
    
    const info = settleInfo(state, pools, m);
    if (!info) continue;
    
    hostNet += info.bankerNet;
    hostRake += info.rakeEarned;
    totalPool += info.total;
  }

  const bettors = reportByBettor(state, pools);
  for (const b of bettors) {
    if (b.name === state.hostName) continue; // 排除莊家自己
    playersMap[b.name] = {
      name: b.name,
      staked: b.totalStaked,
      profit: b.profit,
      bets: b.winCount + b.loseCount + b.pendingCount
    };
  }

  return {
    players: Object.values(playersMap).sort((a, b) => b.profit - a.profit),
    hostRake,
    hostNet,
    totalPool
  };
}

/* =========================================
 * 10. 標籤與輔助 (Label Helpers)
 * ========================================= */

function optionLabel(state, market, optId) {
  if (!market || !market.options) return optId;
  const opt = market.options.find(o => o.id === optId);
  return opt ? opt.label : optId;
}

function categoryLabel(key) {
  const c = CATEGORIES.find(x => x.key === key);
  return c ? c.label : key;
}

/* =========================================
 * 11. 模組匯出 (Module Export)
 * ========================================= */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DB_PATH,
    DEFAULT_ODDS,
    DEFAULT_PRIOR_K,
    DEFAULT_MAX_BET,
    MAX_AUTO_ODDS,
    MIN_AUTO_ODDS,
    QUICK_AMOUNTS,
    DEFAULT_RAKE,
    CATEGORIES,
    esc,
    fmt,
    uid,
    generateRoomCode,
    generateRoomPin,
    createRoom,
    roomDbPath,
    normalize,
    buildPools,
    poolOf,
    marketTotal,
    bookOverround,
    bookMargin,
    autoOdds,
    liveOdds,
    maxBetImpact,
    suggestPriorK,
    buildDuelMarket,
    buildMultiMarket,
    buildCustomMarket,
    betOdds,
    bankerNetIfWins,
    worstCase,
    settleInfo,
    betOutcome,
    effectiveMaxBet,
    validateBetAmount,
    liabilityIfBetPlaced,
    checkLiability,
    bettorStakeOn,
    checkPerBettor,
    liabilityUsage,
    isHostBanned,
    reportByBettor,
    reportByCategory,
    reportByTime,
    bankerExposure,
    roomSettlement,
    optionLabel,
    categoryLabel
  };
}

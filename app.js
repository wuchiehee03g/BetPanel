/**
 * BetPanel · 包廂熱場投注系統
 * 核心引擎 (Core Engine v3.0 - Commercial Edition)
 * 包含：業務邏輯、賠率引擎、點數錢包、兌換碼儲值、推薦分潤模組、極簡帳單與 Web Audio 音效
 */

const firebaseConfig = {
  apiKey: "AIzaSyDfMIkPI9fdeYg5sVuL4fLHcbSxxtfVgPM",
  authDomain: "betpanel-249dc.firebaseapp.com",
  databaseURL: "https://betpanel-249dc-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "betpanel-249dc",
  appId: "1:833468168241:web:f8267242dd2ab7c1277d10",
  messagingSenderId: "833468168241",
};

const DB_PATH = 'betpanel';
const DEFAULT_ODDS = 2;
const DEFAULT_PRIOR_K = 20000;
const DEFAULT_MAX_BET = 10000;
const MAX_AUTO_ODDS = 50;
const MIN_AUTO_ODDS = 1.01;
const QUICK_AMOUNTS = [100, 500, 1000, 5000];
const DEFAULT_RAKE = 0.05; // 預設 5% 抽水
const ROOM_CREATION_COST = 100; // 建立一次包廂消耗 100 點數
const REFERRAL_REBATE_PERCENT = 0.20; // 下線儲值/消費 20% 返利給上線幹部

const RAKE_OPTIONS = [0, 0.03, 0.05, 0.10]; // 0%, 3%, 5%, 10%

const CATEGORIES = [
  { key: 'duel', label: '1v1 對決', hint: '兩人對決，押誰贏' },
  { key: 'multi', label: '多選一', hint: '多個選項，押誰勝出' },
  { key: 'custom', label: '自訂盤口', hint: '自由設定選項與賠率' },
];

// 夜店/包廂熱門預設盤口
const NIGHTLIFE_PRESETS = [
  { id:'dice_duel', group:'dice', title:'吹牛對決 (1v1)', desc:'輪流喊數並可質疑，依現場約定判定勝負', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'niuniu', group:'dice', title:'妞妞（牛牛）', desc:'常見五張牌玩法：三張湊十的倍數，剩兩張比牛數；牌型依現場規則', category:'duel', options:[{label:'玩家勝',odds:2.00},{label:'莊家勝',odds:2.00}] },
  { id:'sicbo', group:'dice', title:'骰寶', desc:'三顆骰子開盅；總和 4–10 為小、11–17 為大，圍骰另計', category:'custom', options:[{label:'大 (11-17)',odds:2.00},{label:'小 (4-10)',odds:2.00},{label:'圍骰／豹子 (三同數)',odds:5.00}] },
  { id:'blackjack', group:'dice', title:'21 點', desc:'目標接近 21 且不爆牌；玩家、莊家或和局，採事前約定的補牌規則', category:'multi', options:[{label:'玩家勝',odds:2.00},{label:'莊家勝',odds:2.00},{label:'和局',odds:8.00}] },
  { id:'eighteen', group:'dice', title:'十八啦', desc:'常見四骰玩法會依配對與剩餘點數計分；骰子數與特殊牌型請於盤口說明' , category:'duel', options:[{label:'玩家／閒家勝',odds:2.00},{label:'莊家勝',odds:2.00}] },







  { id:'singapore_punch', group:'punch', title:'新加坡拳', desc:'常見為拍手、猜拳決定攻守，再比上下左右；同向續攻、不同向換攻', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'punch_5_10_15', group:'punch', title:'5／10／15 划拳', desc:'雙手以 0／5 出拳並喊總數；連續猜中者依現場規則勝出，不是局數', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'seaweed_punch', group:'punch', title:'海帶拳', desc:'常見口訣為「海帶呀海帶」，依手勢相同與否輪流攻守；各店口訣可不同', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'drink_speed', group:'challenge', title:'喝酒速度挑戰', desc:'同樣份量，預測誰先完成；可替換無酒精飲品', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'drink_volume', group:'challenge', title:'限時飲用量挑戰', desc:'同樣時間，預測誰完成更多；可替換無酒精飲品', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'drink_target', group:'challenge', title:'指定杯數挑戰', desc:'預測誰先完成指定杯數；可替換無酒精飲品', category:'duel', options:[{label:'選手 A',odds:2.00},{label:'選手 B',odds:2.00}] },
  { id:'ktv_score', group:'challenge', title:'KTV 歡唱評分對決', desc:'下一首歌是否突破 90 分', category:'custom', options:[{label:'高分突破 (>=90)',odds:2.10},{label:'未達標準 (<90)',odds:1.75}] },
  { id:'king_mild', group:'king', title:'國王大冒險｜輕度', desc:'輕度互動挑戰，可改為非酒精任務', category:'multi', options:[{label:'指定唱歌',odds:4.00},{label:'趣味問答',odds:4.00},{label:'模仿動作',odds:4.00},{label:'分享故事',odds:4.00}] },
  { id:'king_medium', group:'king', title:'國王大冒險｜中度', desc:'中度互動挑戰，先確認參與者同意', category:'multi', options:[{label:'即興表演',odds:4.00},{label:'指定舞步',odds:4.00},{label:'真心話',odds:4.00},{label:'團體任務',odds:4.00}] },
  { id:'king_extreme', group:'king', title:'國王大冒險｜高強度', desc:'高強度僅作展示，禁止危險或強迫飲酒', category:'multi', options:[{label:'高難度表演',odds:4.00},{label:'團體接力',odds:4.00},{label:'即興挑戰',odds:4.00},{label:'安全替代任務',odds:4.00}] }
];

// 預設示範兌換碼 (若資料庫尚無則自動初始化)
const DEFAULT_REDEEM_CODES = {
  'VIP888': { points: 5000, name: 'VIP尊榮儲值碼 (5000點)' },
  'WELCOME1000': { points: 1000, name: '幹部首儲新手禮 (1000點)' },
  'NIGHTCLUB5000': { points: 5000, name: '夜店專案儲值碼 (5000點)' },
  'BETPANEL2026': { points: 2000, name: '官方禮包碼 (2000點)' }
};

/* =========================================
 * 1. 基礎工具 (Utility)
 * ========================================= */

function esc(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-US');
}

function uid() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function generateReferralCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = 'REF-';
  for (let i = 0; i < 4; i++) {
    r += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return r;
}

/* =========================================
 * 2. 音效引擎 (Web Audio API Sound Engine)
 * ========================================= */

const SoundEngine = {
  ctx: null,
  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) this.ctx = new AudioContextClass();
    }
  },
  isMuted() {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('bp_sfx_muted') === 'true';
  },
  toggleMute() {
    const muted = !this.isMuted();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bp_sfx_muted', muted ? 'true' : 'false');
    }
    return muted;
  },
  playTone(freq, type, duration, gainVal = 0.1) {
    if (this.isMuted()) return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  },
  playChip() {
    this.playTone(1200, 'sine', 0.08, 0.12);
  },
  playBet() {
    if (this.isMuted()) return;
    this.playTone(523.25, 'triangle', 0.1, 0.15);
    setTimeout(() => this.playTone(659.25, 'triangle', 0.15, 0.15), 70);
  },
  playWin() {
    if (this.isMuted()) return;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'sine', 0.2, 0.2), idx * 90);
    });
  },
  playLock() {
    this.playTone(220, 'sawtooth', 0.15, 0.15);
  },
  playError() {
    this.playTone(180, 'square', 0.2, 0.15);
  }
};

/* =========================================
 * 3. 幹部點數錢包與推薦分潤模組 (Host Wallet & Referral System)
 * ========================================= */

function createHostProfile(hostName, hostId = null) {
  const id = hostId || 'host_' + Math.random().toString(36).substring(2, 9);
  return {
    hostId: id,
    hostName: hostName || '尊榮幹部',
    credits: 1000, // 初始贈送 1000 點開房點數
    referralCode: generateReferralCode(),
    referredBy: null,
    totalRebate: 0,
    createdAt: Date.now()
  };
}

/* =========================================
 * 4. 包廂管理 (Room Management)
 * ========================================= */

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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

function createRoom(hostName, roomTitle = '', rakePercent = DEFAULT_RAKE, maxBet = DEFAULT_MAX_BET, hostId = null) {
  return {
    code: generateRoomCode(),
    hostName: hostName || '包廂莊家',
    hostId: hostId || 'host_anon',
    roomTitle: roomTitle || 'VIP 尊榮投注包廂',
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
 * 5. 資料正規化 (Data Normalization)
 * ========================================= */

function normalize(raw) {
  if (!raw) return { markets: [], bets: [], hostName: '包廂莊家', roomTitle: 'VIP 包廂' };
  
  const config = raw.config || {};
  const state = {
    hostName: config.hostName || raw.hostName || '包廂莊家',
    hostId: config.hostId || raw.hostId || '',
    roomTitle: config.roomTitle || raw.roomTitle || 'VIP 尊榮投注包廂',
    hostPin: config.pin || raw.hostPin || '',
    rakePercent: typeof config.rake === 'number' ? (config.rake / 100) : (typeof raw.rakePercent === 'number' ? raw.rakePercent : DEFAULT_RAKE),
    createdAt: config.createdAt || raw.createdAt || Date.now(),
    maxBet: typeof config.maxBet === 'number' ? config.maxBet : (typeof raw.maxBet === 'number' ? raw.maxBet : DEFAULT_MAX_BET),
    markets: [],
    bets: [],
    updates: []
  };

  if (raw.updates) {
    state.updates = Object.keys(raw.updates).map(uId => ({ ...raw.updates[uId], id: uId })).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

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

  if (raw.bets) {
    state.bets = Object.keys(raw.bets).map(bId => {
      return { ...raw.bets[bId], id: bId };
    });
    state.bets.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  }

  return state;
}

/* =========================================
 * 6. 資金池計算 (Pool Calculations)
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
 * 7. 賠率引擎 (Odds Engine)
 * ========================================= */

function bookOverround(market) {
  let sum = 0;
  for (const opt of market.options) {
    sum += 1 / (opt.odds || DEFAULT_ODDS);
  }
  return sum;
}

function autoOdds(pools, market, optId) {
  const O = bookOverround(market);
  const K = typeof market.priorK === 'number' ? market.priorK : DEFAULT_PRIOR_K;
  const S = marketTotal(pools, market);
  const s_i = poolOf(pools, market.id, optId);
  
  const opt = market.options.find(o => o.id === optId);
  if (!opt) return DEFAULT_ODDS;
  
  const initialOdds = opt.odds || DEFAULT_ODDS;
  const q_i = (1 / initialOdds) / O;
  
  let rawOdds = (K + S) / (O * (K * q_i + s_i));
  rawOdds = Math.max(MIN_AUTO_ODDS, Math.min(MAX_AUTO_ODDS, rawOdds));
  return Number(rawOdds.toFixed(2));
}

function liveOdds(pools, market, optId) {
  const opt = market.options.find(o => o.id === optId);
  if (!opt) return { value: DEFAULT_ODDS, auto: false, opening: DEFAULT_ODDS };
  
  // 預設採用開盤固定賠率；只有盤口明確寫入 true 才啟用浮動賠率。
  const auto = market.autoPrice === true;
  const opening = opt.odds || DEFAULT_ODDS;
  const value = auto ? autoOdds(pools, market, optId) : opening;
  
  return { value, auto, opening };
}

/* =========================================
 * 8. 盤口建立 (Market Creation)
 * ========================================= */

function buildDuelMarket(opts) {
  const { nameA, nameB, rakePercent, priorK, maxBet, maxPerBettor, maxLiability } = opts;
  const rake = typeof rakePercent === 'number' ? rakePercent : DEFAULT_RAKE;
  const impliedProb = 0.5;
  const initialOdds = 1 / impliedProb;
  
  return {
    title: `${nameA} vs ${nameB}`,
    desc: '1v1 對決盤口',
    category: 'duel',
    rakePercent: rake,
    autoPrice: false,
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

function buildCustomMarket(opts) {
  const { title, desc, options, rakePercent, autoPrice, priorK, maxBet } = opts;
  
  const mOptions = options.map((opt, idx) => ({
    id: `opt${idx}`,
    label: typeof opt === 'string' ? opt : opt.label,
    order: idx,
    odds: Number(opt.odds || 2)
  }));
  
  return {
    title,
    desc,
    category: 'custom',
    rakePercent: typeof rakePercent === 'number' ? rakePercent : DEFAULT_RAKE,
    autoPrice: autoPrice === true,
    priorK: priorK || DEFAULT_PRIOR_K,
    maxBet: maxBet || null,
    locked: false,
    settled: false,
    winnerId: null,
    order: Date.now(),
    options: mOptions
  };
}

/* =========================================
 * 9. 風險與結算 (Risk & Settlement)
 * ========================================= */

function betOdds(bet) {
  return Number(bet.oddsAtBet) || 1.0;
}
function payoutForBet(bet, market) {
  const amount = Number(bet.amount) || 0;
  const grossProfit = Math.max(0, amount * betOdds(bet) - amount);
  const rake = Math.max(0, Math.min(1, Number(market && market.rakePercent) || 0));
  // 抽水只從中獎淨利扣除；本金完整返還，賠率在下注時固定。
  return amount + grossProfit * (1 - rake);
}

function bankerNetIfWins(state, pools, market, winOptId) {
  if (!market) return 0;
  
  const total = marketTotal(pools, market);
  let payout = 0;
  
  for (const bet of state.bets) {
    if (bet.marketId === market.id && bet.optionId === winOptId) {
      payout += payoutForBet(bet, market);
    }
  }
  
  return total - payout;
}

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

function settleInfo(state, pools, market) {
  if (!market) return null;
  
  const total = marketTotal(pools, market);
  if (total === 0) {
    return { total: 0, payoutTotal: 0, bankerNet: 0, rakeEarned: 0, winPool: 0, empty: true };
  }
  
  if (!market.winnerId) return null;
  
  let payoutTotal = 0;
  for (const bet of state.bets) {
    if (bet.marketId === market.id && bet.optionId === market.winnerId) {
      payoutTotal += payoutForBet(bet, market);
    }
  }
  
  const bankerNet = total - payoutTotal;
  const winPool = poolOf(pools, market.id, market.winnerId);
  const grossPayout = state.bets.filter(bet => bet.marketId === market.id && bet.optionId === market.winnerId).reduce((sum, bet) => sum + (Number(bet.amount) * Math.max(0, betOdds(bet) - 1)), 0);
  const rakeEarned = grossPayout - Math.max(0, payoutTotal - winPool); // 只抽中獎淨利
  
  return {
    total,
    payoutTotal,
    bankerNet,
    rakeEarned,
    winPool,
    empty: false
  };
}

function betOutcome(state, pools, bet) {
  const market = state.markets.find(m => m.id === bet.marketId);
  if (!market || !market.settled || !market.winnerId) {
    return { status: 'pending', profit: 0, payout: 0 };
  }
  
  if (bet.optionId === market.winnerId) {
    const payout = payoutForBet(bet, market);
    return { status: 'win', profit: payout - bet.amount, payout };
  } else {
    return { status: 'lose', profit: -bet.amount, payout: 0 };
  }
}

function effectiveMaxBet(state, market) {
  if (market && market.maxBet !== null && market.maxBet > 0) return market.maxBet;
  return state.maxBet || DEFAULT_MAX_BET;
}

function validateBetAmount(rawAmount, maxBet) {
  const amount = Number(rawAmount);
  if (isNaN(amount) || amount <= 0) return { ok: false, reason: '請輸入有效的下注金額' };
  if (!Number.isInteger(amount)) return { ok: false, reason: '金額必須為整數' };
  if (amount > maxBet) return { ok: false, reason: `單注金額不能超過 $${fmt(maxBet)}` };
  return { ok: true };
}

function sameNickname(n1, n2) {
  if (!n1 || !n2) return false;
  return n1.trim().toLowerCase() === n2.trim().toLowerCase();
}

function getRecentActivity(state, limit = 10) {
  if (!state || !state.bets) return [];
  const sorted = [...state.bets].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, limit);
  return sorted.map(b => {
    const market = state.markets.find(m => m.id === b.marketId);
    const opt = market ? market.options.find(o => o.id === b.optionId) : null;
    return {
      id: b.id,
      name: b.name || '神秘玩家',
      marketTitle: market ? market.title : '盤口',
      optionLabel: opt ? opt.label : '選項',
      amount: b.amount,
      odds: betOdds(b),
      ts: b.ts || Date.now()
    };
  });
}

/* =========================================
 * 10. 報表與結算單產出 (Reports & Bill)
 * ========================================= */

function reportByBettor(state, pools) {
  const map = {};
  
  for (const bet of state.bets) {
    const key = bet.name || bet.bettorId;
    if (!map[key]) {
      map[key] = { name: key, totalStaked: 0, staked: 0, winCount: 0, loseCount: 0, pendingCount: 0, profit: 0, bankerNet: 0, bets: 0 };
    }
    
    map[key].totalStaked += bet.amount;
    map[key].staked += bet.amount;
    map[key].bets++;
    
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
    map[key].bankerNet = -map[key].profit;
  }
  
  return Object.values(map).sort((a, b) => b.profit - a.profit);
}

function bankerExposure(state, pools) {
  let activeWorst = 0;
  let settledNet = 0;
  let staked = 0;
  let totalRakeEarned = 0;
  
  for (const m of state.markets) {
    const mTotal = marketTotal(pools, m);
    staked += mTotal;
    if (m.settled) {
      const info = settleInfo(state, pools, m);
      if (info) {
        settledNet += info.bankerNet;
        totalRakeEarned += info.rakeEarned;
      }
    } else {
      const worst = worstCase(state, pools, m);
      if (worst < 0) activeWorst += worst;
    }
  }
  
  return { activeWorst, worstOpen: activeWorst, settledNet, staked, totalVolume: staked, totalRakeEarned };
}

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
    if (b.name === state.hostName) continue;
    playersMap[b.name] = {
      name: b.name,
      staked: b.totalStaked,
      profit: b.profit,
      bets: b.bets
    };
  }

  return {
    players: Object.values(playersMap).sort((a, b) => b.profit - a.profit),
    hostRake,
    hostNet,
    totalPool
  };
}

function generateFormattedBill(state, pools) {
  if (!state) return '';
  const res = roomSettlement(state, pools);
  const nowStr = new Date().toLocaleString('zh-TW');
  
  let bill = `┌────────────────────────────────────────┐\n`;
  bill += `│   👑 BetPanel 包廂專屬結算帳單 👑      │\n`;
  bill += `├────────────────────────────────────────┤\n`;
  bill += `  包廂名稱：${state.roomTitle || 'VIP包廂'}\n`;
  bill += `  莊家幹部：${state.hostName || '幹部'}\n`;
  bill += `  結算時間：${nowStr}\n`;
  bill += `  總下注池：$${fmt(res.totalPool)}\n`;
  bill += `├────────────────────────────────────────┤\n`;
  bill += `  【幹部/莊家收益拆算】\n`;
  const hostSign = res.hostNet >= 0 ? '+' : '';
  bill += `  💰 幹部抽水收益(Rake)：+$${fmt(res.hostRake)}\n`;
  bill += `  📊 莊家總派彩淨收益 ：${hostSign}$${fmt(res.hostNet)}\n`;
  bill += `├────────────────────────────────────────┤\n`;
  bill += `  【客人帳單明細 (贏+/輸-)】\n`;
  
  if (res.players.length === 0) {
    bill += `  (尚無已結算的客人投注)\n`;
  } else {
    res.players.forEach(p => {
      const sign = p.profit > 0 ? '👑 贏 +' : (p.profit < 0 ? '💔 輸 -' : '🤝 平  ');
      bill += `  • ${p.name.padEnd(10, ' ')} : ${sign}$${fmt(Math.abs(p.profit))}\n`;
    });
  }
  bill += `└────────────────────────────────────────┘\n`;
  bill += ` 💡 提示：請輸家客人將對應款項交付莊家或以 QR Code 轉帳。`;
  return bill;
}

/* =========================================
 * 11. 離線 SVG QR Code 繪製 (Offline QR Code Engine)
 * ========================================= */

function generateQRCodeSVG(text, size = 200) {
  const encodedText = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}`;
}

/* =========================================
 * 12. 標籤與輔助 (Label Helpers)
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
 * 13. 模組匯出 (Module Export)
 * ========================================= */

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    firebaseConfig,
    DB_PATH,
    DEFAULT_ODDS,
    DEFAULT_PRIOR_K,
    DEFAULT_MAX_BET,
    MAX_AUTO_ODDS,
    MIN_AUTO_ODDS,
    QUICK_AMOUNTS,
    DEFAULT_RAKE,
    ROOM_CREATION_COST,
    REFERRAL_REBATE_PERCENT,
    RAKE_OPTIONS,
    CATEGORIES,
    NIGHTLIFE_PRESETS,
    DEFAULT_REDEEM_CODES,
    SoundEngine,
    esc,
    fmt,
    uid,
    generateReferralCode,
    createHostProfile,
    generateRoomCode,
    generateRoomPin,
    createRoom,
    roomDbPath,
    normalize,
    buildPools,
    poolOf,
    marketTotal,
    bookOverround,
    autoOdds,
    liveOdds,
    buildDuelMarket,
    buildCustomMarket,
    betOdds,
    bankerNetIfWins,
    worstCase,
    settleInfo,
    betOutcome,
    effectiveMaxBet,
    validateBetAmount,
    sameNickname,
    getRecentActivity,
    reportByBettor,
    bankerExposure,
    roomSettlement,
    generateFormattedBill,
    generateQRCodeSVG,
    optionLabel,
    categoryLabel
  };
}






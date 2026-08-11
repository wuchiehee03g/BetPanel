const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const app = require('../app.js');

test('payout deducts rake from profit only and rounds to two decimals', () => {
  assert.equal(
    app.payoutForBet({ amount: 100, oddsAtBet: 2 }, { rakePercent: 0.05 }),
    195
  );
  assert.equal(
    app.payoutForBet({ amount: 125, oddsAtBet: 1.47 }, { rakePercent: 0.05 }),
    180.81
  );
});

test('normalize preserves room ownership and archive state', () => {
  const state = app.normalize({
    config: {
      hostName: '莊家',
      hostUid: 'host-uid',
      status: 'archived',
      archivedAt: 123
    }
  });

  assert.equal(state.hostUid, 'host-uid');
  assert.equal(state.status, 'archived');
  assert.equal(state.archivedAt, 123);
});

test('single-session rooms last six hours while legacy rooms remain compatible', () => {
  const activatedAt = 1_000_000;
  const room = app.createRoom('主持人', '測試活動', 0.05, 1000, 'host-1', activatedAt);
  assert.equal(room.billingMode, 'single_room_6h_twd_200');
  assert.equal(room.sessionPriceTwd, 200);
  assert.equal(room.expiresAt - room.activatedAt, 6 * 60 * 60 * 1000);
  assert.equal(app.isSessionExpired(room, room.expiresAt - 1), false);
  assert.equal(app.isSessionExpired(room, room.expiresAt), true);
  assert.equal(app.isSessionActive(room, room.expiresAt), false);

  const legacy = app.normalize({ config: { hostUid: 'legacy-host', status: 'active' } });
  assert.equal(legacy.expiresAt, null);
  assert.equal(app.isSessionActive(legacy, Number.MAX_SAFE_INTEGER), true);
});

test('bet ownership never falls back to a matching nickname', () => {
  const bet = { bettorUid: 'user-a', bettorId: 'legacy-a', name: '同名' };
  assert.equal(app.betBelongsTo(bet, 'user-a', 'unused'), true);
  assert.equal(app.betBelongsTo(bet, 'user-b', 'legacy-a'), false);
  assert.equal(app.betBelongsTo({ bettorId: 'legacy-a', name: '同名' }, '', 'legacy-a'), true);
});

test('reports keep same-name users separate and do not exclude host-name collisions', () => {
  const market = {
    id: 'm1',
    settled: true,
    winnerId: 'win',
    rakePercent: 0,
    options: [{ id: 'win', label: '勝', odds: 2 }, { id: 'lose', label: '負', odds: 2 }]
  };
  const state = {
    hostName: '同名',
    markets: [market],
    bets: [
      { bettorUid: 'u1', name: '同名', marketId: 'm1', optionId: 'win', amount: 100, oddsAtBet: 2 },
      { bettorUid: 'u2', name: '同名', marketId: 'm1', optionId: 'lose', amount: 100, oddsAtBet: 2 }
    ]
  };
  const pools = app.buildPools(state);

  assert.equal(app.reportByBettor(state, pools).length, 2);
  assert.equal(app.roomSettlement(state, pools).players.length, 2);
});

test('banker archive flow keeps market and bet records', () => {
  const banker = fs.readFileSync(path.join(__dirname, '..', 'banker.html'), 'utf8');
  assert.doesNotMatch(banker, /markets\s*:\s*null/);
  assert.doesNotMatch(banker, /bets\s*:\s*null/);
  assert.match(banker, /updates\['config\/status'\]\s*=\s*'archived'/);
  assert.match(banker, /lockedAt/);
  assert.match(banker, /settledAt/);
  assert.match(banker, /settledByUid/);
});

test('front end has no stored-value, redeem-code, or referral data writes', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const banker = fs.readFileSync(path.join(__dirname, '..', 'banker.html'), 'utf8');
  assert.doesNotMatch(appSource, /ROOM_CREATION_COST|REFERRAL_REBATE_PERCENT|DEFAULT_REDEEM_CODES/);
  assert.doesNotMatch(banker, /betpanel\/hosts|betpanel\/redeemCodes|referralCode|btnRedeem|btnBindUpline/);
  assert.match(banker, /billingMode:\s*'single_room_6h_twd_200'/);
  assert.match(banker, /expiresAt:\s*activatedAt \+ SESSION_DURATION_MS/);
});

test('both pages use Firebase server time for session expiry UI', () => {
  const player = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const banker = fs.readFileSync(path.join(__dirname, '..', 'banker.html'), 'utf8');
  assert.match(player, /\.info\/serverTimeOffset/);
  assert.match(banker, /\.info\/serverTimeOffset/);
  assert.match(player, /isSessionExpired\(state, serverNow\(\)\)/);
  assert.match(banker, /isSessionExpired\(state, serverNow\(\)\)/);
});

test('formal and example rules stay byte-for-byte identical', () => {
  const formal = fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8');
  const example = fs.readFileSync(path.join(__dirname, '..', 'firebase.database.rules.example.json'), 'utf8');
  assert.equal(formal, example);
  assert.doesNotThrow(() => JSON.parse(formal));
});

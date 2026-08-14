const fs = require('node:fs');
const path = require('node:path');
const { after, before, beforeEach, test } = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} = require('@firebase/rules-unit-testing');
const {
  get,
  ref,
  serverTimestamp,
  set,
  update
} = require('firebase/database');

const PROJECT_ID = 'demo-betpanel';
const ROOM_ID = 'ABC234';
const HOST_UID = 'host-uid';
const PLAYER_UID = 'player-uid';
const OTHER_UID = 'other-uid';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    database: {
      rules: fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8')
    }
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearDatabase();
  await testEnv.withSecurityRulesDisabled(async context => {
    await set(ref(context.database(), `betpanel/rooms/${ROOM_ID}`), baseRoom());
  });
});

test('only the room host can manage config, markets, updates and audit logs', async () => {
  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const otherDb = testEnv.authenticatedContext(OTHER_UID).database();

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { locked: true }));
  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { rakePercent: 0.15 }));
  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1/options/o1`), { odds: 3 }));
  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1/options/o1`), { label: '竄改選項' }));
  await assertFails(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1/options/o1`), null));
  await assertFails(update(ref(otherDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { locked: false }));
  await assertFails(update(ref(otherDb, `betpanel/rooms/${ROOM_ID}/config`), { roomTitle: '竄改' }));

  await assertSucceeds(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/updates/u1`), {
    message: '即時戰況',
    type: 'live',
    actorUid: HOST_UID,
    ts: serverTimestamp()
  }));
  await assertFails(set(ref(otherDb, `betpanel/rooms/${ROOM_ID}/updates/u2`), {
    message: '偽造戰況',
    type: 'live',
    actorUid: OTHER_UID,
    ts: serverTimestamp()
  }));

  await assertSucceeds(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/auditLogs/a1`), {
    action: 'host_check',
    actorUid: HOST_UID,
    ts: serverTimestamp()
  }));
  await assertFails(set(ref(otherDb, `betpanel/rooms/${ROOM_ID}/auditLogs/a2`), {
    action: 'fake_log',
    actorUid: OTHER_UID,
    ts: serverTimestamp()
  }));
});

test('valid fixed-odds bet succeeds and invalid bet variants fail', async () => {
  const playerDb = testEnv.authenticatedContext(PLAYER_UID).database();
  const otherDb = testEnv.authenticatedContext(OTHER_UID).database();

  await assertSucceeds(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b1`), bet()));
  await assertFails(set(ref(otherDb, `betpanel/rooms/${ROOM_ID}/bets/b2`), bet()));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b3`), bet({ optionId: 'missing' })));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b4`), bet({ oddsAtBet: 99 })));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b5`), bet({ amount: 10.5 })));
  await assertSucceeds(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b6`), bet({ amount: 250000 })));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b7`), bet({ ts: 1 })));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b8`), bet({ amount: 9007199254740992 })));
  await assertFails(update(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b1`), { amount: 1 }));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/b1`), null));
});

test('settlement is atomic, result is immutable, and archive is terminal', async () => {
  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const playerDb = testEnv.authenticatedContext(PLAYER_UID).database();

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), {
    locked: true,
    lockedAt: serverTimestamp(),
    lockedByUid: HOST_UID
  }));

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'markets/m1/settled': true,
    'markets/m1/winnerId': 'o1',
    'markets/m1/resultLabel': '選項一',
    'markets/m1/settledAt': serverTimestamp(),
    'markets/m1/settledByUid': HOST_UID,
    'auditLogs/settled': {
      action: 'market_settled',
      actorUid: HOST_UID,
      ts: serverTimestamp()
    }
  }));

  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { winnerId: 'o2' }));
  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { settled: false }));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/late`), bet()));

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'markets/m1/archived': true,
    'markets/m1/archivedAt': serverTimestamp(),
    'markets/m1/archivedByUid': HOST_UID,
    'auditLogs/archived': {
      action: 'market_archived',
      actorUid: HOST_UID,
      ts: serverTimestamp()
    }
  }));

  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { locked: false }));
});

test('room archive preserves data and blocks future room activity', async () => {
  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const playerDb = testEnv.authenticatedContext(PLAYER_UID).database();

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'config/status': 'archived',
    'config/archivedAt': serverTimestamp(),
    'config/archivedByUid': HOST_UID,
    'auditLogs/room-archived': {
      action: 'room_archived',
      actorUid: HOST_UID,
      ts: serverTimestamp()
    }
  }));

  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/config`), { status: 'active' }));
  await assertFails(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/updates/late`), {
    message: '封存後訊息',
    type: 'notice',
    actorUid: HOST_UID,
    ts: serverTimestamp()
  }));
  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/late`), bet()));
});

test('new demo session is fixed to six hours and private legacy wallet paths are hidden', async () => {
  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const publicDb = testEnv.unauthenticatedContext().database();
  const activatedAt = Date.now();
  const config = {
    hostUid: HOST_UID,
    hostId: HOST_UID,
    hostName: '測試主持人',
    roomTitle: '單場測試',
    pin: '2345',
    status: 'active',
    accessMode: 'demo',
    billingMode: 'single_room_6h_twd_200',
    sessionPriceTwd: 200,
    activatedAt,
    expiresAt: activatedAt + 6 * 60 * 60 * 1000,
    createdAt: activatedAt
  };

  await assertSucceeds(set(ref(hostDb, 'betpanel/rooms/NEW234/config'), config));
  await assertFails(set(ref(hostDb, 'betpanel/rooms/LONG23/config'), {
    ...config,
    expiresAt: activatedAt + 7 * 60 * 60 * 1000
  }));
  await assertFails(update(ref(hostDb, 'betpanel/rooms/NEW234/config'), {
    expiresAt: activatedAt + 12 * 60 * 60 * 1000
  }));

  await assertSucceeds(get(ref(publicDb, 'betpanel/rooms/NEW234')));
  await assertFails(get(ref(publicDb, 'betpanel/hosts')));
  await assertFails(get(ref(publicDb, 'betpanel/redeemCodes')));
  await assertFails(get(ref(publicDb, 'betpanel/roomAccess')));
});

test('expired session blocks new activity but still permits lock, settlement and archive cleanup', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await update(ref(context.database(), `betpanel/rooms/${ROOM_ID}/config`), {
      accessMode: 'demo',
      billingMode: 'single_room_6h_twd_200',
      sessionPriceTwd: 200,
      activatedAt: Date.now() - 7 * 60 * 60 * 1000,
      expiresAt: Date.now() - 60 * 60 * 1000
    });
  });

  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const playerDb = testEnv.authenticatedContext(PLAYER_UID).database();

  await assertFails(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/expired`), bet()));
  await assertFails(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/updates/expired`), {
    message: '過期戰況', type: 'notice', actorUid: HOST_UID, ts: serverTimestamp()
  }));
  await assertFails(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/new-market`), {
    title: '過期後新盤',
    options: { o1: { label: '一', odds: 2 }, o2: { label: '二', odds: 2 } },
    locked: false,
    settled: false
  }));

  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), {
    locked: true,
    lockedAt: serverTimestamp(),
    lockedByUid: HOST_UID
  }));
  await assertFails(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/m1`), { locked: false }));
  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'markets/m1/settled': true,
    'markets/m1/winnerId': 'o1',
    'markets/m1/resultLabel': '選項一',
    'markets/m1/settledAt': serverTimestamp(),
    'markets/m1/settledByUid': HOST_UID,
    'auditLogs/expired-settlement': {
      action: 'market_settled', actorUid: HOST_UID, ts: serverTimestamp()
    }
  }));
  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'markets/m1/archived': true,
    'markets/m1/archivedAt': serverTimestamp(),
    'markets/m1/archivedByUid': HOST_UID,
    'auditLogs/expired-market-archive': {
      action: 'market_archived', actorUid: HOST_UID, ts: serverTimestamp()
    }
  }));
  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}`), {
    'config/status': 'archived',
    'config/archivedAt': serverTimestamp(),
    'config/archivedByUid': HOST_UID,
    'auditLogs/expired-room-archive': {
      action: 'room_archived', actorUid: HOST_UID, ts: serverTimestamp()
    }
  }));
});

test('legacy rooms without expiresAt retain their existing lifecycle', async () => {
  const hostDb = testEnv.authenticatedContext(HOST_UID).database();
  const playerDb = testEnv.authenticatedContext(PLAYER_UID).database();
  await assertSucceeds(set(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/legacy-new`), {
    title: '舊房新盤',
    options: { o1: { label: '一', odds: 2 }, o2: { label: '二', odds: 2 } },
    rakePercent: 0,
    autoPrice: false,
    locked: false,
    settled: false
  }));
  await assertSucceeds(set(ref(playerDb, `betpanel/rooms/${ROOM_ID}/bets/legacy-bet`),
    bet({ marketId: 'legacy-new', optionId: 'o1' })));
  await assertSucceeds(update(ref(hostDb, `betpanel/rooms/${ROOM_ID}/markets/legacy-new`), {
    locked: true,
    lockedAt: serverTimestamp(),
    lockedByUid: HOST_UID
  }));
});

function baseRoom() {
  return {
    config: {
      hostUid: HOST_UID,
      hostName: '測試莊家',
      roomTitle: '測試包廂',
      status: 'active'
    },
    markets: {
      m1: {
        title: '測試盤口',
        desc: '測試',
        options: {
          o1: { label: '選項一', odds: 2, order: 0 },
          o2: { label: '選項二', odds: 2, order: 1 }
        },
        rakePercent: 0.05,
        autoPrice: false,
        locked: false,
        settled: false
      }
    }
  };
}

function bet(overrides = {}) {
  return {
    marketId: 'm1',
    optionId: 'o1',
    amount: 100,
    oddsAtBet: 2,
    bettorUid: PLAYER_UID,
    bettorId: PLAYER_UID,
    name: '玩家',
    ts: serverTimestamp(),
    ...overrides
  };
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Run, CARDS, STARTER, REWARDS, FIXTURES, defaultProfile, readProfile, saveProfile, purchase, MAX_HAND } from '../src/engine.js';

function hand(run, ids) { run.hand = ids.map((id, i) => ({ id, uid: 1000 + i })); return run.hand; }
function start(seed = 42) { const r = new Run(seed); r.startMatch(); return r; }
const deckCount = r => r.drawPile.length + r.hand.length + r.discard.length;

test('a fresh match has all starter cards and a five-card hand', () => {
  const r = start();
  assert.equal(r.hand.length, 5); assert.equal(deckCount(r), STARTER.length);
  assert.equal(r.energy, 3); assert.equal(r.attack, 1); assert.equal(r.goals, 0);
});
test('same seed and same actions produce the same hands and results', () => {
  const a = start(123), b = start(123);
  assert.deepEqual(a.hand, b.hand);
  assert.deepEqual(a.scramble(), b.scramble());
  a.nextChance(); b.nextChance(); assert.deepEqual(a.hand, b.hand);
});
test('illegal cards and unaffordable cards leave state unchanged', () => {
  const r = start(); hand(r, ['laces']); r.energy = 1;
  const before = JSON.stringify(r);
  assert.equal(r.play(1000), null); assert.equal(r.play(99), null);
  assert.equal(JSON.stringify(r), before);
});
test('build-up spends legs, improves chance and includes the fixture pressure tax', () => {
  const r = start(); hand(r, ['touch']);
  const p = r.preview('touch'); const result = r.play(1000);
  assert.equal(result.type, 'setup'); assert.equal(r.energy, 2);
  assert.equal(r.quality, 32); assert.equal(r.pressure, 28); assert.equal(p.pressure, r.pressure);
});
test('exactly 100 pressure loses the attack without allowing a shot', () => {
  const r = start(); hand(r, ['run']); r.pressure = 78;
  assert.equal(r.preview('run').tackle, true);
  assert.equal(r.play(1000).type, 'tackle');
  assert.equal(r.phase, 'resolution'); assert.equal(r.scramble(), null);
});
test('composure reduces pressure without charging a positive fixture tax', () => {
  const r = start(); hand(r, ['breathe']); r.pressure = 10;
  r.play(1000); assert.equal(r.pressure, 0); assert.equal(r.energy, 3);
});
test('a draw card never redraws itself during its own effect', () => {
  const r = start(); hand(r, ['breathe']); r.drawPile = []; r.discard = [];
  r.play(1000); assert.equal(r.hand.length, 0); assert.deepEqual(r.discard, ['breathe']);
});
test('the hand cap never deletes undrawn cards', () => {
  const r = start(); r.draw(20);
  assert.equal(r.hand.length, MAX_HAND); assert.equal(deckCount(r), STARTER.length);
});
test('discard reshuffles without losing or duplicating cards across attacks', () => {
  const r = start();
  for (let i = 0; i < FIXTURES[0].attacks; i++) {
    r.scramble(); assert.equal(deckCount(r), STARTER.length);
    r.nextChance(); assert.equal(deckCount(r), STARTER.length);
  }
});
test('card effects and bonus conditions produce exact displayed shot probabilities', () => {
  const r = start(); r.quality = 40;
  assert.equal(r.shotChance('finish'), 48);
  assert.equal(r.shotChance('toe'), 32);
  assert.equal(r.shotChance(), 26);
  assert.equal(r.shotChance('chip'), 71);
  r.pressure = 40; assert.equal(r.shotChance('chip'), 56);
  r.lastType = 'Link-up'; assert.equal(r.shotChance('volley'), 72);
  r.lastType = 'Movement'; assert.equal(r.shotChance('volley'), 50);
  r.quality = 95; assert.equal(r.shotChance('laces'), 95);
  r.quality = 5; assert.equal(r.shotChance('toe'), 5);
});
test('a scored shot counts once, banks £5 and blocks repeated inputs', () => {
  const r = start(); hand(r, ['finish']); r.random = () => 0;
  const result = r.play(1000);
  assert.equal(result.type, 'goal'); assert.equal(result.chance, 26);
  assert.equal(r.goals, 1); assert.equal(r.totalGoals, 1); assert.equal(r.bank, 5);
  assert.equal(r.play(1000), null); assert.equal(r.shoot(), null); assert.equal(r.abandon(), null);
  assert.equal(r.goals, 1);
});
test('a high-quality shot can still miss and a miss earns nothing', () => {
  const r = start(); r.quality = 95; r.random = () => 0.999;
  assert.equal(r.scramble().type, 'miss'); assert.equal(r.bank, 0);
});
test('zero-cost shots can rescue an exhausted hand; fallback cannot', () => {
  const r = start(); hand(r, ['toe']); r.energy = 0;
  assert.equal(r.scramble(), null); assert.equal(r.play(1000).type === 'goal' || r.lastResult.type === 'miss', true);
});
test('letting a chance go resets legs, quality and pressure on the next attack', () => {
  const r = start(); r.energy = 0; r.pressure = 99; r.quality = 90;
  r.abandon(); r.nextChance();
  assert.equal(r.attack, 2); assert.equal(r.energy, 3); assert.equal(r.quality, 18); assert.equal(r.pressure, 12);
});
test('draws knock you out; a win offers three unique rare cards', () => {
  const draw = start(); draw.goals = 2; draw.attack = 6; draw.abandon(); draw.nextChance(); assert.equal(draw.phase, 'lost');
  const win = start(); win.goals = 3; win.attack = 6; win.abandon(); win.nextChance();
  assert.equal(win.phase, 'reward'); assert.equal(new Set(win.offers).size, 3);
  assert.ok(win.offers.every(id => REWARDS.includes(id))); assert.equal(win.bank, 15);
});
test('rewards and events cannot be selected twice or out of phase', () => {
  const r = start(); assert.equal(r.pickReward('laces'), false); assert.equal(r.chooseEvent(0), false);
  r.goals = 3; r.attack = 6; r.abandon(); r.nextChance();
  assert.equal(r.pickReward('not-a-card'), false);
  const reward = r.offers[0]; assert.equal(r.pickReward(reward), true); assert.equal(r.deck.at(-1), reward);
  assert.equal(r.pickReward(reward), false); assert.equal(r.chooseEvent(-1), false); assert.equal(r.chooseEvent(.5), false);
  assert.equal(r.chooseEvent(0), true); assert.equal(r.chooseEvent(0), false);
  assert.equal(r.fixtureIndex, 1); assert.equal(r.phase, 'ready');
  r.startMatch(); assert.equal(r.energy, 4);
});
test('one-match event bonuses expire after that match', () => {
  const r = start(); r.boon = { quality: 10, energy: 1 }; r.goals = 3; r.attack = 6; r.abandon(); r.nextChance();
  assert.deepEqual(r.boon, {});
});
test('permanent upgrades apply to new runs, warm-up only to the first attack', () => {
  const profile = { ...defaultProfile(), training: 2, warmup: 1 };
  const r = new Run(1, profile); r.startMatch();
  assert.equal(r.quality, 24); assert.equal(r.energy, 4);
  r.abandon(); r.nextChance(); assert.equal(r.energy, 3); assert.equal(r.quality, 24);
});
test('an entire four-match run reaches champion and can bank once', () => {
  const r = new Run(56); const profile = defaultProfile();
  for (let fixture = 0; fixture < 4; fixture++) {
    assert.equal(r.startMatch(), true);
    while (r.phase === 'playing') {
      r.quality = 95; r.random = () => 0; r.scramble(); r.nextChance();
    }
    if (fixture < 3) { assert.equal(r.phase, 'reward'); r.pickReward(r.offers[0]); r.chooseEvent(0); }
  }
  assert.equal(r.phase, 'champion'); assert.equal(r.wins, 4); assert.equal(r.history.length, 4);
  assert.equal(r.claim(profile), true); assert.equal(r.claim(profile), false);
  assert.equal(profile.cups, 1); assert.equal(profile.runs, 1); assert.equal(profile.kitty, r.bank);
});
test('failed runs bank their earned goals and cannot claim before ending', () => {
  const r = start(); const profile = defaultProfile();
  assert.equal(r.claim(profile), false); r.bank = 5; r.attack = 6; r.abandon(); r.nextChance();
  assert.equal(r.claim(profile), true); assert.equal(profile.kitty, 5); assert.equal(profile.runs, 1); assert.equal(profile.cups, 0);
});
test('purchases respect prices, level caps and unknown upgrades', () => {
  const p = { ...defaultProfile(), kitty: 100 };
  assert.equal(purchase(p, 'training'), true); assert.equal(p.kitty, 65); assert.equal(p.training, 1);
  assert.equal(purchase(p, 'warmup'), true); assert.equal(purchase(p, 'warmup'), false);
  assert.equal(purchase(p, 'training'), false); assert.equal(purchase(p, 'anything'), false);
});
test('storage corruption, unknown versions, denied storage and impossible upgrades recover', () => {
  const storage = value => ({ getItem: () => value });
  assert.deepEqual(readProfile(storage('{broken')), defaultProfile());
  assert.deepEqual(readProfile(storage('{"version":999}')), defaultProfile());
  assert.deepEqual(readProfile(null), defaultProfile());
  assert.equal(saveProfile(null, defaultProfile()), false);
  const p = readProfile(storage('{"version":1,"kitty":-9,"training":999,"warmup":-3,"runs":"banana"}'));
  assert.equal(p.kitty, 0); assert.equal(p.training, 3); assert.equal(p.warmup, 0); assert.equal(p.runs, 0);
});
test('all starter and reward cards have a playable definition', () => {
  for (const id of [...STARTER, ...REWARDS]) {
    assert.ok(CARDS[id]); assert.ok(Number.isInteger(CARDS[id].cost)); assert.ok(CARDS[id].cost >= 0);
  }
});

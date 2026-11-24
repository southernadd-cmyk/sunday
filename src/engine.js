// Pure turn-based rules. Rendering never decides a football outcome.
export const SAVE_VERSION = 1;
export const MAX_HAND = 8;
export const FIXTURES = [
  { name: 'The Railway Arms', short: 'RAILWAY', round: 'First round', ground: 'Recreation Ground', score: 2, attacks: 6, pressure: 12, tax: 2, weather: 'Overcast, obviously', rule: 'Two down already. Their centre-half has just finished a night shift. Time to rescue this.', colour: '#496cdb' },
  { name: 'AFC Municipal', short: 'MUNICIPAL', round: 'Quarter-final', ground: 'Council Pitch No. 3', score: 3, attacks: 6, pressure: 20, tax: 4, weather: 'Sideways drizzle', rule: 'A heavy pitch and three goals behind. Every build-up card adds 4 extra pressure.', colour: '#eed253' },
  { name: 'Station Road Social', short: 'STATION RD', round: 'Semi-final', ground: 'The Playing Fields', score: 3, attacks: 7, pressure: 26, tax: 6, weather: 'A proper headwind', rule: 'Three behind. Seven attacks, and very little breathing room. Use that new kit.', colour: '#bd70c2' },
  { name: 'The Dog & Duck', short: 'DOG & DUCK', round: 'Cup final', ground: 'Saltmere Common', score: 4, attacks: 7, pressure: 32, tax: 8, weather: 'Cup-final sunshine', rule: 'The holders have put four past us. Seven attacks to produce a completely unreasonable comeback.', colour: '#f0f0e2' },
];

export const CARDS = {
  touch: { name: 'First touch', type: 'Control', cost: 1, quality: 14, pressure: 14, icon: 'boot', text: '+14% chance. +14 pressure.', quote: 'For once, it stays under your foot.' },
  run: { name: 'Lose your man', type: 'Movement', cost: 1, quality: 20, pressure: 20, icon: 'run', text: '+20% chance. +20 pressure.', quote: 'He turns like the number 12 bus.' },
  pass: { name: 'Give & go', type: 'Link-up', cost: 1, quality: 10, pressure: 12, draw: 1, icon: 'pass', text: '+10% chance. Draw 1. +12 pressure.', quote: 'Give it to Kev. Actually get it back.' },
  breathe: { name: 'Head up', type: 'Composure', cost: 0, pressure: -18, draw: 1, icon: 'eye', text: 'Lose 18 pressure. Draw 1.', quote: 'There is slightly more time than you think.' },
  tea: { name: 'Half-time orange', type: 'Graft', cost: 0, energy: 1, pressure: 12, icon: 'orange', text: '+1 leg. +12 pressure.', quote: 'Mostly peel. Still counts.' },
  finish: { name: 'Side-foot it', type: 'Shot', cost: 1, shot: true, bonus: 8, icon: 'ball', text: 'Shoot with +8% chance.', quote: 'Pick a corner. Try to mean it.' },
  toe: { name: 'Toe punt', type: 'Shot', cost: 0, shot: true, bonus: -8, icon: 'ball', text: 'Shoot with −8% chance. Costs no legs.', quote: 'No technique. Absolutely no shame.' },
  laces: { name: 'Put your laces through it', type: 'Shot', cost: 2, shot: true, bonus: 25, icon: 'fire', rare: true, text: 'Shoot with +25% chance.', quote: 'The keeper has a shift at two.' },
  nutmeg: { name: 'Through his legs', type: 'Flair', cost: 1, quality: 32, pressure: 26, icon: 'nutmeg', rare: true, text: '+32% chance. +26 pressure.', quote: 'You will be talking about this all week.' },
  overlap: { name: 'Kev on the overlap', type: 'Link-up', cost: 1, quality: 18, pressure: 8, draw: 2, icon: 'pass', rare: true, text: '+18% chance. Draw 2. +8 pressure.', quote: 'A full-back, briefly possessed by Cafu.' },
  second: { name: 'Second wind', type: 'Graft', cost: 0, energy: 2, pressure: -12, icon: 'wind', rare: true, text: '+2 legs. Lose 12 pressure.', quote: 'That Thursday run has finally paid off.' },
  feint: { name: 'Drop a shoulder', type: 'Flair', cost: 1, quality: 20, pressure: -12, icon: 'run', rare: true, text: '+20% chance. Lose 12 pressure.', quote: 'Sold him a dummy and a timeshare.' },
  chip: { name: 'Cheeky little dink', type: 'Shot', cost: 1, shot: true, bonus: 16, calmBonus: 15, icon: 'chip', rare: true, text: 'Shoot +16%. Another +15% below 40 pressure.', quote: 'If this comes off, you are unbearable.' },
  wall: { name: 'Use the big lad', type: 'Link-up', cost: 1, quality: 24, pressure: 4, icon: 'pass', rare: true, text: '+24% chance. +4 pressure.', quote: 'Darren has held off two men and a mortgage.' },
  volley: { name: 'On the volley', type: 'Shot', cost: 1, shot: true, bonus: 10, linkBonus: 22, icon: 'fire', rare: true, text: 'Shoot +10%. Another +22% after a Link-up card.', quote: 'Do not let it bounce. Do not think.' },
  badknee: { name: 'Dodgy knee', type: 'Baggage', cost: 1, pressure: -5, icon: 'knee', curse: true, text: 'Lose 5 pressure. Takes up a place in your hand.', quote: 'It can tell you when rain is coming.' },
};

export const STARTER = ['touch', 'touch', 'run', 'run', 'pass', 'pass', 'breathe', 'tea', 'finish', 'finish', 'toe', 'badknee'];
export const REWARDS = Object.keys(CARDS).filter(id => CARDS[id].rare);
export const EVENTS = [
  { title: 'Just the one?', kicker: 'Saturday, 9:46pm · The Anchor & Crown', body: 'Kev has bought a round. Someone has put the jukebox on. You did say you were getting an early night.', choices: [
    { label: 'Get yourself home', text: 'Start next match with +1 leg in every attack.', energy: 1 },
    { label: 'Stay for the team bonding', text: 'Add Kev on the overlap. Start next match with +12 pressure.', add: 'overlap', pressure: 12 },
  ] },
  { title: 'The boot of his car.', kicker: 'Sunday, 9:12am · The car park', body: 'The gaffer has a pair of nearly-new boots and a bag of suspicious oranges. You are allowed one.', choices: [
    { label: 'Take the boots', text: '+10% starting chance next match.', quality: 10 },
    { label: 'Take the oranges', text: 'Add Half-time orange to your deck.', add: 'tea' },
  ] },
  { title: 'A quiet word with the gaffer.', kicker: 'Thursday, 7:05pm · Training', body: 'He has actually put cones out. This could be serious. What do you want to work on?', choices: [
    { label: 'Finishing practice', text: 'Add Side-foot it. +5% starting chance next match.', add: 'finish', quality: 5 },
    { label: 'Sort that knee out', text: 'Remove Dodgy knee, or trim a First touch if your knee is fine.', remove: true },
  ] },
];

export const UPGRADES = {
  training: { name: 'Wednesday five-a-side', price: 35, max: 3, text: '+3% starting chance in every attack. Three levels.' },
  warmup: { name: 'An actual warm-up', price: 50, max: 1, text: '+1 leg in the first attack of every match.' },
};

export function defaultProfile() { return { version: SAVE_VERSION, kitty: 0, training: 0, warmup: 0, runs: 0, cups: 0, best: 0 }; }
export function readProfile(storage) {
  try {
    const p = JSON.parse(storage.getItem('sunday-profile') || 'null');
    if (!p || p.version !== SAVE_VERSION) return defaultProfile();
    const clean = defaultProfile();
    for (const key of ['kitty', 'runs', 'cups', 'best']) if (Number.isSafeInteger(p[key]) && p[key] >= 0) clean[key] = p[key];
    clean.training = Math.min(3, Math.max(0, Math.floor(Number(p.training) || 0)));
    clean.warmup = Math.min(1, Math.max(0, Math.floor(Number(p.warmup) || 0)));
    return clean;
  } catch { return defaultProfile(); }
}
export function saveProfile(storage, profile) {
  try { storage.setItem('sunday-profile', JSON.stringify(profile)); return true; } catch { return false; }
}
export function purchase(profile, id) {
  const u = UPGRADES[id];
  if (!u || profile[id] >= u.max || profile.kitty < u.price) return false;
  profile.kitty -= u.price; profile[id]++; return true;
}

export class Run {
  constructor(seed = Date.now(), profile = defaultProfile()) {
    this.seed = Number(seed) >>> 0;
    this.rng = this.seed || 1;
    this.profile = { ...profile };
    this.deck = [...STARTER];
    this.fixtureIndex = 0;
    this.totalGoals = 0;
    this.wins = 0;
    this.bank = 0;
    this.history = [];
    this.boon = {};
    this.phase = 'ready';
    this.claimed = false;
    this.uid = 0;
    this.log = [];
  }
  random() {
    let t = this.rng += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  get fixture() { return FIXTURES[this.fixtureIndex]; }
  get remaining() { return this.fixture.attacks - this.attack; }
  get minute() { return Math.min(90, Math.round(this.attack / this.fixture.attacks * 90)); }
  get matchWon() { return this.goals > this.fixture.score; }
  startMatch() {
    if (this.phase !== 'ready') return false;
    this.goals = 0; this.attack = 0;
    this.drawPile = this.shuffle(this.deck);
    this.discard = []; this.hand = [];
    this.log = [];
    this.beginChance();
    return true;
  }
  beginChance() {
    this.phase = 'playing';
    this.attack++;
    this.quality = 18 + this.profile.training * 3 + (this.boon.quality || 0);
    this.pressure = Math.max(0, this.fixture.pressure + (this.boon.pressure || 0));
    this.energy = 3 + (this.boon.energy || 0) + (this.attack === 1 ? this.profile.warmup : 0);
    this.lastType = null;
    this.actions = 0;
    this.hand = [];
    this.draw(5);
    this.note(`Attack ${this.attack}. You find a pocket of space.`, 'new');
  }
  draw(count) {
    for (let i = 0; i < count && this.hand.length < MAX_HAND; i++) {
      if (!this.drawPile.length) {
        if (!this.discard.length) break;
        this.drawPile = this.shuffle(this.discard);
        this.discard = [];
      }
      this.hand.push({ id: this.drawPile.pop(), uid: ++this.uid });
    }
  }
  shotChance(cardId = 'scramble') {
    const c = CARDS[cardId];
    let bonus = c ? (c.bonus || 0) : -14;
    if (c?.calmBonus && this.pressure < 40) bonus += c.calmBonus;
    if (c?.linkBonus && this.lastType === 'Link-up') bonus += c.linkBonus;
    return Math.min(95, Math.max(5, Math.round(this.quality + bonus)));
  }
  preview(cardId) {
    const c = CARDS[cardId];
    if (!c) return null;
    const tax = c.shot || c.pressure < 0 || c.curse ? 0 : this.fixture.tax;
    const nextPressure = Math.max(0, this.pressure + (c.pressure || 0) + tax);
    return { chance: c.shot ? this.shotChance(cardId) : Math.min(95, this.quality + (c.quality || 0)), pressure: nextPressure, tackle: !c.shot && nextPressure >= 100, tax };
  }
  canPlay(uid) {
    const entry = this.hand.find(c => c.uid === uid);
    return this.phase === 'playing' && !!entry && this.energy >= CARDS[entry.id].cost;
  }
  play(uid) {
    if (!this.canPlay(uid)) return null;
    const index = this.hand.findIndex(c => c.uid === uid);
    const entry = this.hand[index];
    const c = CARDS[entry.id];
    this.hand.splice(index, 1);
    this.energy -= c.cost;
    this.actions++;
    // Resolve before discarding so a draw cannot redraw the card being played.
    if (c.shot) {
      const result = this.shoot(entry.id);
      this.discard.push(entry.id);
      return result;
    }
    const preview = this.preview(entry.id);
    this.quality = Math.min(95, this.quality + (c.quality || 0));
    this.pressure = preview.pressure;
    this.energy = Math.min(8, this.energy + (c.energy || 0));
    this.lastType = c.type;
    this.note(`${c.name}. ${c.quote}`, 'play');
    if (this.pressure >= 100) {
      this.discard.push(entry.id);
      this.phase = 'resolution';
      const result = { type: 'tackle', card: entry.id, text: 'Crowded out. You held it a moment too long.', chance: 0 };
      this.lastResult = result;
      this.note(result.text, 'bad');
      return result;
    }
    this.draw(c.draw || 0);
    this.discard.push(entry.id);
    return { type: 'setup', card: entry.id, quality: this.quality, pressure: this.pressure };
  }
  shoot(cardId = 'scramble') {
    if (this.phase !== 'playing') return null;
    const chance = this.shotChance(cardId);
    const roll = this.random() * 100;
    const goal = roll < chance;
    if (goal) { this.goals++; this.totalGoals++; this.bank += 5; }
    this.phase = 'resolution';
    const text = goal ? ['Bottom corner. The touchline erupts.', 'In off the post. You absolutely meant that.', 'Keeper beaten. Someone spills their tea.'][Math.floor(this.random() * 3)]
      : chance >= 65 ? 'The keeper gets a hand to it. That was a proper chance.' : 'Wide. Someone is fetching that from the allotments.';
    const result = { type: goal ? 'goal' : 'miss', card: cardId, chance, roll, text };
    this.lastResult = result;
    this.note(text, goal ? 'good' : 'bad');
    return result;
  }
  scramble() {
    if (this.phase !== 'playing' || this.energy < 1) return null;
    this.energy--;
    return this.shoot();
  }
  abandon() {
    if (this.phase !== 'playing') return null;
    this.phase = 'resolution';
    this.lastResult = { type: 'waste', text: 'You lay it back. A fresh attack, a little less time.' };
    this.note(this.lastResult.text, 'bad');
    return this.lastResult;
  }
  nextChance() {
    if (this.phase !== 'resolution') return false;
    this.discard.push(...this.hand.map(c => c.id));
    this.hand = [];
    if (this.attack >= this.fixture.attacks) {
      this.finishMatch();
    } else this.beginChance();
    return true;
  }
  finishMatch() {
    const won = this.matchWon;
    this.history.push({ fixture: this.fixtureIndex, goals: this.goals, against: this.fixture.score, won });
    this.boon = {};
    if (!won) { this.phase = 'lost'; return; }
    this.wins++; this.bank += 15;
    if (this.fixtureIndex === FIXTURES.length - 1) { this.phase = 'champion'; return; }
    this.offers = this.shuffle(REWARDS).slice(0, 3);
    this.phase = 'reward';
  }
  pickReward(id) {
    if (this.phase !== 'reward' || !this.offers.includes(id)) return false;
    this.deck.push(id);
    this.phase = 'event';
    return true;
  }
  get event() { return EVENTS[this.fixtureIndex]; }
  chooseEvent(index) {
    if (this.phase !== 'event' || !Number.isInteger(index)) return false;
    const c = this.event.choices[index];
    if (!c) return false;
    if (c.add) this.deck.push(c.add);
    if (c.remove) {
      const i = this.deck.indexOf(this.deck.includes('badknee') ? 'badknee' : 'touch');
      if (i >= 0) this.deck.splice(i, 1);
    }
    this.boon = { energy: c.energy || 0, quality: c.quality || 0, pressure: c.pressure || 0 };
    this.fixtureIndex++;
    this.phase = 'ready';
    return true;
  }
  claim(profile) {
    if (!['lost', 'champion'].includes(this.phase) || this.claimed) return false;
    profile.kitty += this.bank;
    profile.runs++;
    profile.best = Math.max(profile.best, this.totalGoals);
    if (this.phase === 'champion') profile.cups++;
    this.claimed = true;
    return true;
  }
  note(text, type) { this.log.unshift({ text, type }); this.log.length = Math.min(12, this.log.length); }
}

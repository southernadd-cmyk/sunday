import '@fontsource/press-start-2p/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import './style.css';
import { Run, CARDS, FIXTURES, STARTER, UPGRADES, readProfile, saveProfile, purchase } from './engine.js';
import { Pitch } from './pitch.js';

const $ = selector => document.querySelector(selector);
const app = $('#app');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const profile = readProfile(storage);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let run = null;
let screen = 'menu';
let pitch;
let sound = false;
let low = false;
let audio;
let busy = false;
let saveFailed = false;
let dialogReturnFocus;

const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const crest = `<svg class="crest" viewBox="0 0 32 40" aria-hidden="true"><path fill="#e4423d" d="M2 2h28v24L16 38 2 26z"/><path fill="#f5efcc" d="M6 6h20v18L16 32 6 24z"/><path fill="#dd443e" d="M13 6h6v24h-6z"/><path fill="#172541" d="M8 15h16v4H8z"/><path fill="#f7d54a" d="M13 13h6v8h-6z"/></svg>`;

function art(id) {
  const base = '<path fill="#479a38" d="M0 0h96v56H0z"/><path fill="#3c8c32" d="M0 0h24v56H0zm48 0h24v56H48z"/><path fill="none" stroke="#a9ce82" d="M0 44h96M70 0v26h26"/>';
  const player = (x, y, blue = false) => `<g transform="translate(${x} ${y})"><path fill="#2d2828" d="M3 0h6v3H3z"/><path fill="#f1c18b" d="M2 3h8v4H2z"/><path fill="${blue ? '#4975d5' : '#ed5141'}" d="M1 7h10v6H1z"/><path fill="#f8f0ce" d="M2 13h8v3H2z"/><path fill="#202a37" d="M1 16h4v3H1zm6 0h4v3H7z"/></g>`;
  const ball = (x, y) => `<path fill="#fff5cb" d="M${x} ${y}h7v7h-7z"/><path fill="#172541" d="M${x+2} ${y+2}h3v3h-3z"/>`;
  const lines = `<path fill="none" stroke="#ffdf59" stroke-width="2" stroke-dasharray="3 3" d="M37 35 67 12"/>`;
  let drawing = '';
  if (id === 'orange') drawing = '<path fill="#ec8b27" d="M34 9h28v5h5v28h-5v5H34v-5h-5V14h5z"/><path fill="#ffc452" d="M35 15h25v24H35z"/><path fill="#fff0a3" d="M45 13h4v29h-4zM33 25h29v4H33z"/><path fill="#4f6a32" d="M46 6h4v5h-4z"/>';
  else if (id === 'eye') drawing = player(41, 25) + '<path fill="#ffdf59" d="M38 7h20v3H38zm-6 5h4v4h-4zm28 0h4v4h-4z"/>' + ball(55, 37);
  else if (id === 'wind') drawing = player(40, 22) + '<path fill="none" stroke="#e8edb9" stroke-width="3" d="M12 14h42m-48 8h30m-22 8h16m31-6h18m-14 9h22"/>';
  else if (id === 'knee') drawing = player(41, 19) + '<path fill="#fff3d0" d="M43 32h8v5h-8z"/><path fill="#f8d54a" d="M62 10h4v12h-4zm0 16h4v4h-4z"/>';
  else if (['pass', 'nutmeg'].includes(id)) drawing = player(15, 25) + player(66, 5, id === 'nutmeg') + ball(42, 24) + lines;
  else if (id === 'run') drawing = player(51, 12) + player(25, 27, true) + '<path fill="none" stroke="#ffdf59" stroke-width="2" stroke-dasharray="3 3" d="M12 42q26 5 37-23"/>' + ball(65, 24);
  else if (id === 'boot') drawing = '<path fill="#1c283a" d="M27 13h15v13h6v5h21v5h6v9H24V29h3z"/><path fill="#e84c3d" d="M29 13h11v14h6v7h24v6H27V28h2z"/><path fill="#fff0cb" d="M36 25h13v3H36zm0 6h18v3H36z"/><path fill="#e7e4ca" d="M28 45h6v4h-6zm15 0h6v4h-6zm17 0h6v4h-6z"/>' + ball(73, 35);
  else drawing = player(22, 29) + ball(56, id === 'chip' ? 14 : 25) + '<path fill="none" stroke="#ffdf59" stroke-width="2" stroke-dasharray="3 3" d="M39 34Q52 10 78 8"/>' + (id === 'fire' ? '<path fill="#ff973d" d="M41 25h9v4h-9zm-5 6h13v3H36z"/>' : '');
  return `<svg viewBox="0 0 96 56" class="card-art" aria-hidden="true" shape-rendering="crispEdges">${base}${drawing}</svg>`;
}

app.innerHTML = `
  <header class="topbar">
    <button class="wordmark" data-action="home" aria-label="Sunday main menu">SUNDAY<span>FC</span></button>
    <div class="edition">SALTMERE SUNDAY LEAGUE <span>DECKBUILDER · PROTOTYPE 0.1</span></div>
    <nav class="top-actions" aria-label="Game options">
      <button data-action="help" class="text-button">HOW TO PLAY</button>
      <button data-action="low" class="icon-button" aria-pressed="false" title="Toggle lower rendering resolution">LO-FI</button>
      <button data-action="sound" class="icon-button" aria-pressed="false" title="Toggle sound">SOUND OFF</button>
    </nav>
  </header>
  <main id="main">
    <div id="pitch-host"><div id="pitch-fallback" hidden>THE GROUNDSKEEPER HAS LOST THE PIXELS.<br>The card game still works. Carry on.</div></div>
    <div class="pitch-vignette" aria-hidden="true"></div>
    <section id="menu" class="menu-screen"></section>
    <section id="game" class="game-screen" hidden></section>
    <section id="between" class="between-screen" hidden></section>
  </main>
  <div id="live" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
  <dialog id="modal" aria-labelledby="modal-title"><div id="modal-content"></div></dialog>
  <div id="toast" role="status"></div>
`;

try { pitch = new Pitch($('#pitch-host'), { reducedMotion: motionQuery.matches }); }
catch (error) { $('#pitch-fallback').hidden = false; console.warn('Pixel pitch unavailable:', error.message); }

function stash() {
  saveFailed = !saveProfile(storage, profile);
  if (saveFailed) toast('Your browser could not save the club kitty. This run still works.');
}
function toast(text) {
  $('#toast').textContent = text; $('#toast').classList.add('visible');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').classList.remove('visible'), 3400);
}
function announce(text) { $('#live').textContent = text; }
function beep(type = 'card') {
  if (!sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
    const notes = type === 'goal' ? [392, 494, 587, 784] : type === 'miss' ? [220, 164] : [330, 440];
    notes.forEach((freq, i) => {
      const osc = audio.createOscillator(), gain = audio.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.025, audio.currentTime + i * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + i * 0.09 + 0.12);
      osc.connect(gain); gain.connect(audio.destination);
      osc.start(audio.currentTime + i * 0.09); osc.stop(audio.currentTime + i * 0.09 + 0.13);
    });
  } catch { /* Muted and unsupported browsers still have a complete game. */ }
}
function switchScreen(next) {
  screen = next;
  document.body.dataset.screen = next;
  for (const id of ['menu', 'game', 'between']) $(`#${id}`).hidden = id !== next;
  pitch?.setMode(next === 'game' ? 'playing' : 'menu');
}
function renderMenu() {
  switchScreen('menu');
  const isReturn = profile.runs > 0;
  $('#menu').innerHTML = `
    <div class="menu-copy">
      <div class="tape">THE ANCHOR & CROWN F.C. · EST. WHENEVER</div>
      <h1>SUNDAY<span class="title-dot">.</span></h1>
      <p class="tagline">YOU'VE GOT WORK<br>IN THE MORNING.</p>
      <p class="intro">A Sunday league roguelite.<br>You're the striker. Your cards do the running.</p>
      <button class="primary start-button" data-action="start">${isReturn ? 'ONE MORE SUNDAY' : 'START A CUP RUN'}<span>ENTER</span></button>
      <div class="menu-secondary"><button class="text-button" data-action="help">FIRST TIME? THE TEAM TALK</button><button class="text-button" data-action="shed">CLUB SHED <b>£${profile.kitty}</b></button></div>
      <div class="menu-record">${isReturn ? `${profile.runs} RUN${profile.runs === 1 ? '' : 'S'} · ${profile.cups} CUP${profile.cups === 1 ? '' : 'S'} · BEST: ${profile.best} GOALS` : 'FOUR SUNDAYS. ONE CUP. PROBABLY A DODGY KNEE.'}</div>
    </div>
    <div class="menu-fixture"><span class="pixel-label">NEXT SUNDAY · 10:30 AM</span><div>${crest}<strong>ANCHOR & CROWN</strong></div><small>vs. THE RAILWAY ARMS</small><p>Recreation Ground, Saltmere<br>Bring your own water. And a deck.</p></div>
    <div class="menu-bottom"><span>TURN-BASED TACTICS. PUB-TEAM PROBLEMS.</span><span>NO REFLEXES REQUIRED.</span></div>
  `;
}

function cardMarkup(id, { entry, reward = false, library = false } = {}) {
  const c = CARDS[id];
  const preview = run?.phase === 'playing' ? run.preview(id) : null;
  const can = entry ? run.canPlay(entry.uid) : true;
  const classes = ['playing-card', c.shot ? 'shot-card' : '', c.rare ? 'rare-card' : '', c.curse ? 'curse-card' : '', reward ? 'reward-card' : ''].join(' ');
  const label = `${c.name}, costs ${c.cost} ${c.cost === 1 ? 'leg' : 'legs'}. ${c.text}${preview?.tax ? ` Plus ${preview.tax} pitch pressure.` : ''}${c.shot && preview ? ` Goal chance ${preview.chance} percent.` : ''}${preview?.tackle ? ' WARNING: you will be tackled.' : ''}`;
  const body = `<div class="card-top"><span class="card-type">${c.type}</span><span class="card-cost" title="Legs cost">${c.cost}<i aria-hidden="true">▰</i></span></div>
    ${art(c.icon)}<strong class="card-name">${c.name}</strong><span class="card-effect">${c.text}</span>
    <span class="card-foot">${c.shot && preview ? `${preview.chance}% TO SCORE` : preview?.tackle ? '100: CROWDED OUT' : reward ? 'ADD TO YOUR DECK' : c.rare ? 'A BIT SPECIAL' : c.type === 'Baggage' ? 'CARRYING A KNOCK' : 'SUNDAY LEAGUE'}</span>`;
  if (library) return `<div class="${classes}" title="${escape(c.quote)}">${body}</div>`;
  return `<button class="${classes}" ${entry ? `data-card="${entry.uid}"` : `data-reward="${id}"`} ${!can ? 'disabled' : ''} aria-label="${escape(label)}">${body}</button>`;
}

function renderGame() {
  switchScreen('game');
  pitch?.update(run);
  const f = run.fixture;
  const resolving = run.phase === 'resolution';
  const needed = Math.max(0, f.score + 1 - run.goals);
  const pressureWarning = run.pressure >= 75;
  $('#game').innerHTML = `
    <div class="arena">
      <div class="scoreboard" aria-label="Score"><div class="score-round">SALTMERE CUP · ${f.round.toUpperCase()}</div><div class="scoreline"><span>ANCHOR & CROWN</span><b>${run.goals}</b></div><div class="scoreline opponent"><span>${f.short}</span><b>${f.score}</b></div><div class="score-clock"><span>${run.minute}'</span><span>ATTACK ${run.attack}/${f.attacks}</span></div></div>
      <div class="ground-label">${f.ground.toUpperCase()}<span>${f.weather}</span></div>
      <div class="striker-tag">YELLOW RING = YOU · NO. 9</div>
      <aside class="touchline"><h2>FROM THE TOUCHLINE</h2><p>${resolving ? escape(run.lastResult.text) : escape(run.log[0]?.text || 'Find some space. Make it count.')}</p><div class="objective">${needed ? `<b>${needed} MORE GOAL${needed === 1 ? '' : 'S'}</b><span>needed to go through</span>` : '<b>YOU\'RE IN FRONT</b><span>Keep going. Goals fill the kitty.</span>'}</div><div class="touchline-rule">${escape(f.rule)}</div><button class="text-button" data-action="deck">YOUR DECK · ${run.deck.length} CARDS</button></aside>
      <div class="meters"><div class="meter quality"><div><span>CHANCE</span><b>${Math.round(run.quality)}<small>%</small></b></div><div class="track"><i style="width:${run.quality}%"></i></div><span>Before your shot bonus</span></div><div class="meter pressure ${pressureWarning ? 'danger' : ''}"><div><span>PRESSURE</span><b>${run.pressure}<small>/100</small></b></div><div class="track"><i style="width:${Math.min(100,run.pressure)}%"></i></div><span>${pressureWarning ? 'Careful. 100 loses the chance.' : '100 = crowded out'}</span></div><div class="legs"><span>LEGS LEFT</span><b>${run.energy}</b><small>Spend them on cards</small></div></div>
      ${resolving ? `<div class="result-banner ${run.lastResult.type} ${busy ? 'in-flight' : ''}"><h2>${({goal:'GET IN!',miss:'NOT THIS TIME.',tackle:'CROWDED OUT.',waste:'RECYCLE IT.'})[run.lastResult.type]}</h2><p>${escape(run.lastResult.text)}</p>${run.lastResult.chance ? `<span>A ${run.lastResult.chance}% chance. ${run.lastResult.type === 'goal' ? 'You took it.' : 'Football, eh?'}</span>` : ''}<button class="primary" data-action="next" ${busy ? 'disabled' : ''}>${run.remaining > 0 ? 'NEXT ATTACK' : 'FULL-TIME'}<small>ENTER</small></button></div>` : ''}
    </div>
    <div class="hand-table"><div class="hand-heading"><div><h2>PLAY YOUR HAND</h2><span>${run.actions === 0 && run.attack === 1 ? 'Build a chance, then play a Shot card. Keep 1 leg to finish.' : `Build up, take a breath, or have a go. Pitch adds +${f.tax} pressure to build-up cards.`}</span></div><span class="piles">DRAW ${run.drawPile.length} <i>/</i> DISCARD ${run.discard.length}</span></div><div class="hand-bottom"><div class="hand" aria-label="Your cards">${run.hand.map((e) => cardMarkup(e.id, { entry: e })).join('') || '<p class="empty-hand">Nothing left in your hand. Scramble a shot or recycle the ball.</p>'}</div><div class="last-resort"><button class="scramble-button" data-action="scramble" ${resolving || run.energy < 1 ? 'disabled' : ''}><span>SCRAMBLE A SHOT</span><b>${run.shotChance()}%</b><small>1 leg · −14% chance</small></button><button class="text-button recycle" data-action="abandon" ${resolving ? 'disabled' : ''}>LET THIS CHANCE GO</button><span class="keyboard-hint">1–8: cards · S: shot</span></div></div></div>
  `;
  if (resolving && !busy) $('[data-action="next"]')?.focus({ preventScroll: true });
}

function renderReady() {
  switchScreen('between');
  const f = run.fixture;
  $('#between').innerHTML = `<div class="interstitial match-brief"><div class="eyebrow">SUNDAY ${run.fixtureIndex + 1} OF 4 · ${f.round.toUpperCase()}</div><h1>BOOTS ON.<br>KETTLE ON.</h1><div class="brief-teams">${crest}<span>THE ANCHOR & CROWN<b>vs. ${f.name.toUpperCase()}</b></span></div><p>${f.rule}</p><div class="brief-rules"><div><b>${f.attacks}</b><span>ATTACKS TO PLAY</span></div><div><b>0–${f.score}</b><span>YOU START BEHIND</span></div><div><b>${f.score + 1}</b><span>GOALS TO WIN</span></div></div><p class="brief-tip">Each attack: a fresh hand, fresh legs, and a new chance. A draw knocks you out. Every goal earns £5 for the club kitty.</p>${run.boon.energy || run.boon.quality || run.boon.pressure ? `<div class="boon">THIS SUNDAY: ${[run.boon.energy ? `+${run.boon.energy} leg every attack` : '', run.boon.quality ? `+${run.boon.quality}% starting chance` : '', run.boon.pressure ? `+${run.boon.pressure} starting pressure` : ''].filter(Boolean).join(' · ')}</div>` : ''}<button class="primary" data-action="kickoff">KICK OFF <small>ENTER</small></button><button class="text-button" data-action="help">QUICK TEAM TALK</button></div>`;
  $('[data-action="kickoff"]')?.focus({ preventScroll: true });
}

function renderReward() {
  switchScreen('between');
  $('#between').innerHTML = `<div class="interstitial reward-screen"><div class="eyebrow">FULL-TIME · ANCHOR & CROWN ${run.goals}–${run.fixture.score} ${run.fixture.short}</div><h1>THERE'S ALWAYS<br>NEXT SUNDAY.</h1><p>You're through. Pick one card to keep for the rest of this run.</p><div class="reward-row">${run.offers.map(id => cardMarkup(id, { reward: true })).join('')}</div><div class="reward-bottom"><span>£${run.bank} EARNED THIS RUN</span><button class="text-button" data-action="deck">LOOK AT YOUR DECK</button></div></div>`;
  $('[data-reward]')?.focus({ preventScroll: true });
}

function renderEvent() {
  switchScreen('between');
  const e = run.event;
  $('#between').innerHTML = `<div class="interstitial event-screen"><div class="eyebrow">${e.kicker.toUpperCase()}</div><div class="event-pixel" aria-hidden="true">${art(run.fixtureIndex === 0 ? 'orange' : run.fixtureIndex === 1 ? 'boot' : 'eye')}</div><h1>${e.title.toUpperCase()}</h1><p>${e.body}</p><div class="event-choices">${e.choices.map((c, i) => `<button class="event-choice" data-choice="${i}"><strong>${c.label}</strong><span>${c.text}</span></button>`).join('')}</div><span class="muted">YOUR DECK LASTS THE RUN. MATCH BONUSES LAST ONE SUNDAY.</span></div>`;
  $('[data-choice]')?.focus({ preventScroll: true });
}

function renderEnd() {
  switchScreen('between');
  const champion = run.phase === 'champion';
  if (run.claim(profile)) stash();
  $('#between').innerHTML = `<div class="interstitial end-screen"><div class="eyebrow">${champion ? 'SALTMERE SUNDAY CUP · WINNERS' : 'FULL-TIME · OUT OF THE CUP'}</div><h1>${champion ? 'PUB LEGEND.' : 'THERE\'S ALWAYS<br>ANOTHER RUN.'}</h1><p>${champion ? 'Four Sundays. One very dented trophy. You are still going to work tomorrow.' : `Anchor & Crown ${run.goals}–${run.fixture.score} ${run.fixture.name}. ${run.goals === run.fixture.score ? 'A draw is not enough in this cup.' : 'The cup run is over.'} The boots go in the bag. The stories get better on the way home.`}</p><div class="end-stats"><div><b>${run.totalGoals}</b><span>GOALS</span></div><div><b>${run.wins}</b><span>WINS</span></div><div><b>£${run.bank}</b><span>INTO THE KITTY</span></div></div><div class="run-receipt">${run.history.map(h => `<div><span>${FIXTURES[h.fixture].short}</span><b>${h.goals}–${h.against}</b><span>${h.won ? 'WON' : 'OUT'}</span></div>`).join('')}</div><p class="brief-tip">Your deck resets. The £${profile.kitty} club kitty stays. Buy a small upgrade, then try a different build.</p><div class="end-actions"><button class="primary" data-action="start">ONE MORE SUNDAY</button><button class="secondary" data-action="shed">CLUB SHED · £${profile.kitty}</button></div><button class="text-button" data-action="menu">BACK TO THE CLUBHOUSE</button></div>`;
  $('[data-action="start"]')?.focus({ preventScroll: true });
}

function openModal(content) {
  dialogReturnFocus = document.activeElement;
  $('#modal-content').innerHTML = content + '<button class="modal-close secondary" data-action="close">BACK TO IT</button>';
  if (!$('#modal').open) $('#modal').showModal();
  $('#modal').querySelector('button')?.focus();
}
function closeModal() { $('#modal').close(); dialogReturnFocus?.focus?.({ preventScroll: true }); }
function help() {
  openModal(`<div class="eyebrow">NO JOYSTICK REQUIRED</div><h2 id="modal-title">THE TEAM TALK.</h2><p>You're the striker in a pub team. Win four matches to lift the Saltmere Cup. Each match starts with your team behind.</p><ol class="help-steps"><li><strong>Build a chance.</strong> Play Movement, Control and Link-up cards to raise your chance of scoring. A card's top-right number is its legs cost.</li><li><strong>Watch the pressure.</strong> Most build-up cards bring defenders closer. At 100 pressure, you're tackled and lose the attack. Composure cards buy you space.</li><li><strong>Then shoot.</strong> Shot cards show the exact scoring probability. Higher is better; 95% is still a risk. Keep a leg for a shot, or use a free Toe punt.</li><li><strong>Make the chances count.</strong> Each attack gives a new hand and fresh legs. You have six or seven attacks; finish ahead to go through. A draw knocks you out.</li><li><strong>Build your run.</strong> Win to draft a better card. Make choices between Sundays. Bank £5 per goal and £15 per win, even when your run ends.</li></ol><div class="help-tip">No Shot card? <b>Scramble a shot</b> always costs 1 leg with a −14% penalty. No legs? <b>Let this chance go</b> starts the next attack.</div><p class="muted">Keyboard: 1–8 plays a card · S scrambles a shot · Enter continues · Esc closes this talk. Every decision also works by mouse or touch.</p>`);
}
function shed() {
  openModal(`<div class="eyebrow">PERMANENT CLUB IMPROVEMENTS</div><h2 id="modal-title">THE CLUB SHED.</h2><p>Kitty: <strong>£${profile.kitty}</strong>. Goals and wins fund little improvements. Each new run starts with your upgrades.</p><div class="upgrades">${Object.entries(UPGRADES).map(([id, u]) => `<div class="upgrade"><div><strong>${u.name}</strong><p>${u.text}</p><small>LEVEL ${profile[id]}/${u.max}</small></div><button class="secondary" data-upgrade="${id}" ${profile[id] >= u.max || profile.kitty < u.price ? 'disabled' : ''}>${profile[id] >= u.max ? 'SORTED' : `£${u.price}`}</button></div>`).join('')}</div><p class="muted">Upgrades apply to your next run. Saved in this browser${saveFailed ? ' — currently unavailable' : ''}.</p>`);
}
function deck() {
  const cards = run?.deck || STARTER;
  const counts = {};
  cards.forEach(id => counts[id] = (counts[id] || 0) + 1);
  openModal(`<div class="eyebrow">${cards.length} CARDS · THIS RUN ONLY</div><h2 id="modal-title">YOUR KIT BAG.</h2><div class="deck-list">${Object.entries(counts).map(([id, count]) => `<div>${art(CARDS[id].icon)}<div><strong>${CARDS[id].name} <span>×${count}</span></strong><p>${CARDS[id].text}</p></div><b>${CARDS[id].cost} LEG${CARDS[id].cost === 1 ? '' : 'S'}</b></div>`).join('')}</div>`);
}

function start() {
  closeModal();
  run = new Run(crypto.getRandomValues(new Uint32Array(1))[0], profile);
  busy = false;
  renderReady();
}
function handleResult(result) {
  if (!result) return;
  pitch?.update(run);
  pitch?.animate(result);
  beep(result.type);
  if (result.type !== 'setup') {
    busy = true;
    setTimeout(() => {
      busy = false;
      if (run?.phase === 'resolution' && screen === 'game') {
        const button = $('[data-action="next"]');
        if (button) { button.disabled = false; $('.result-banner')?.classList.remove('in-flight'); button.focus({ preventScroll: true }); }
      }
    }, motionQuery.matches ? 150 : 1000);
  }
  renderGame();
  announce(`${result.type === 'setup' ? CARDS[result.card].name + '. Chance ' + run.quality + ' percent. Pressure ' + run.pressure + '. Legs ' + run.energy : result.text}`);
}

app.addEventListener('click', e => {
  const button = e.target.closest('button');
  if (!button || button.disabled) return;
  if (button.dataset.card) { handleResult(run.play(Number(button.dataset.card))); return; }
  if (button.dataset.reward) { if (run.pickReward(button.dataset.reward)) { beep(); renderEvent(); } return; }
  if (button.dataset.choice !== undefined) { if (run.chooseEvent(Number(button.dataset.choice))) renderReady(); return; }
  if (button.dataset.upgrade) { if (purchase(profile, button.dataset.upgrade)) { stash(); beep(); shed(); } return; }
  const action = button.dataset.action;
  if (action === 'start') start();
  else if (action === 'kickoff') { if (run.startMatch()) renderGame(); }
  else if (action === 'scramble') handleResult(run.scramble());
  else if (action === 'abandon') handleResult(run.abandon());
  else if (action === 'next' && !busy) {
    run.nextChance();
    if (run.phase === 'playing') renderGame();
    else if (run.phase === 'reward') renderReward();
    else renderEnd();
  }
  else if (action === 'help') help();
  else if (action === 'shed') shed();
  else if (action === 'deck') deck();
  else if (action === 'close') closeModal();
  else if (action === 'menu') renderMenu();
  else if (action === 'home') {
    if (run && !['lost', 'champion'].includes(run.phase) && screen !== 'menu') openModal('<h2 id="modal-title">LEAVE THIS CUP RUN?</h2><p>Your current deck and unbanked earnings will be lost. The club kitty stays.</p><button class="primary" data-action="quit">LEAVE THE RUN</button>');
    else renderMenu();
  }
  else if (action === 'quit') { run = null; closeModal(); renderMenu(); }
  else if (action === 'low') { low = !low; pitch?.setLow(low); button.setAttribute('aria-pressed', String(low)); toast(low ? 'Low detail: smaller framebuffer, 20 fps.' : 'Standard detail: pixel pitch, 30 fps.'); }
  else if (action === 'sound') { sound = !sound; button.setAttribute('aria-pressed', String(sound)); button.textContent = sound ? 'SOUND ON' : 'SOUND OFF'; beep(); }
});

document.addEventListener('keydown', e => {
  if ($('#modal').open || e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
  if (/^[1-8]$/.test(e.key) && run?.phase === 'playing' && screen === 'game') {
    e.preventDefault(); const entry = run.hand[Number(e.key) - 1]; if (entry) handleResult(run.play(entry.uid));
  } else if (e.key.toLowerCase() === 's' && run?.phase === 'playing' && screen === 'game') {
    e.preventDefault(); handleResult(run.scramble());
  } else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
    if (screen === 'menu') start();
    else if (run?.phase === 'ready') $('[data-action="kickoff"]')?.click();
    else if (run?.phase === 'resolution' && !busy) $('[data-action="next"]')?.click();
  }
});
$('#modal').addEventListener('click', e => { if (e.target === $('#modal')) closeModal(); });
$('#modal').addEventListener('cancel', () => { setTimeout(() => dialogReturnFocus?.focus?.(), 0); });
motionQuery.addEventListener('change', e => { if (pitch) pitch.reducedMotion = e.matches; });
// Read-only diagnostics for profiling. No debug state or game cheats are shipped.
window.sundayPerformance = () => pitch?.metrics() || { fallback: true };
renderMenu();

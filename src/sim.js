// LAST LIGHT — pure, deterministic rules for a fictional artillery strategy game.
// Coordinates and shell behavior are intentionally abstract game mechanics.
export const W = 960;
export const H = 600;
export const MISSION_SECONDS = 132;
export const SECTORS = ["Dunmere", "Ashen Ford", "Black Coppice", "Red Valley", "Glass Ridge", "Old Vey", "The Citadel"];
export const SHELLS = {
  he:       { name: "High explosive", short: "HE", cost: 1, radius: 78, damage: 33, color: "#e7a55a", effect: "Blast & suppression" },
  smoke:    { name: "Smoke", short: "SMK", cost: 1, radius: 118, damage: 0, color: "#c5cbba", effect: "Screen friendly advance" },
  shrapnel: { name: "Airburst", short: "AIR", cost: 1, radius: 102, damage: 25, color: "#e5be77", effect: "Wide infantry suppression" },
  flare:    { name: "Illumination", short: "FLR", cost: 1, radius: 130, damage: 0, color: "#eee2a9", effect: "Expose enemy positions" }
};
export const UPGRADES = {
  guns:     { name: "Additional field gun", desc: "Adds one gun to the battery (up to four).", base: 110, max: 3 },
  caliber:  { name: "Heavy shells", desc: "Increases explosive force and suppression.", base: 95, max: 3 },
  scouts:   { name: "Forward observers", desc: "Reduces dispersion and improves enemy spotting.", base: 85, max: 3 },
  loaders:  { name: "Veteran gun crews", desc: "Shortens gun reload times.", base: 75, max: 3 },
  supply:   { name: "Supply train", desc: "More shells available on each mission.", base: 80, max: 3 }
};
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const rnd = s => { s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0; return s.seed / 4294967296; };
export const range = (s, a, b) => a + (b - a) * rnd(s);
export function upgradeCost(s, key) { const u = UPGRADES[key]; return Math.round(u.base * (1 + (s.upgrades[key] || 0) * 0.8)); }
export function createCampaign(seed = 1826) {
  return { version: 1, seed: seed >>> 0, credits: 130, day: 1, activeSector: 2,
    sectors: [-0.15, -0.08, 0.01, 0.13, 0.22, 0.30, 0.42],
    upgrades: { guns: 0, caliber: 0, scouts: 0, loaders: 0, supply: 0 },
    history: [], victories: 0, defeats: 0, lastReport: null };
}
export function buyUpgrade(c, key) {
  if (!UPGRADES[key]) return { ok: false, reason: "Unknown upgrade" };
  const level = c.upgrades[key] || 0;
  if (level >= UPGRADES[key].max) return { ok: false, reason: "Fully upgraded" };
  const cost = upgradeCost(c, key);
  if (c.credits < cost) return { ok: false, reason: "Not enough requisition points" };
  c.credits -= cost; c.upgrades[key] = level + 1;
  return { ok: true, cost };
}
function makeUnit(s, team, i) {
  const row = i % 7;
  const y = 77 + row * 72 + range(s, -13, 13);
  return { id: `${team}-${i}`, team, x: team === "ally" ? range(s, 110, 365) : range(s, 612, 855), y,
    hp: 100, morale: range(s, 65, 100), strength: range(s, 0.8, 1.25), alive: true,
    moving: false, jitter: range(s, 0, 10) };
}
export function createMission(campaign) {
  const seed = (campaign.seed + campaign.day * 991 + campaign.activeSector * 1013) >>> 0;
  const s = { version: 1, seed, t: 0, paused: false, finished: false, result: null,
    weather: ["DRIZZLE", "FOG", "CLEAR", "WIND"][seed % 4],
    front: Array.from({length: 10}, (_, i) => 485 + (i % 3 - 1) * 10 + (campaign.sectors[campaign.activeSector] || 0) * 80),
    allyPower: range({seed: seed ^ 0x55}, 0.84, 1.18), enemyPower: range({seed: seed ^ 0xa5}, 0.82, 1.20),
    allyMorale: 78, enemyMorale: 80, support: 0, recon: 0, suppression: 0,
    guns: Array.from({length: 1 + campaign.upgrades.guns}, (_, i) => ({id: i, reload: 0, shots: 0})),
    ammo: { he: 13 + campaign.upgrades.supply * 6, smoke: 6 + campaign.upgrades.supply * 3,
      shrapnel: 7 + campaign.upgrades.supply * 3, flare: 5 + campaign.upgrades.supply * 2 },
    units: [...Array.from({length: 15}, (_, i) => makeUnit({seed: seed + i * 3}, "ally", i)),
      ...Array.from({length: 16}, (_, i) => makeUnit({seed: seed + i * 7 + 100}, "enemy", i))],
    requests: [], shots: [], effects: [], craters: [],
    stats: { fired: 0, hits: 0, enemyLosses: 0, friendlyLosses: 0, requestsCompleted: 0,
      requestsMissed: 0, requestsTotal: 0, supportScore: 0, roundsByType: { he: 0, smoke: 0, shrapnel: 0, flare: 0 } },
    nextRequest: 8, nextSkirmish: 4, nextEnemyStrike: 12, nextFront: 2.5,
    messages: [{t: 0, type:"radio", text:"Battery standing by. Infantry taking positions."}] };
  return s;
}
function message(s, type, text) { s.messages.unshift({t:s.t, type, text}); if(s.messages.length > 18) s.messages.length = 18; }
function near(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
export function addRequest(s) {
  if (s.finished || s.requests.filter(r => !r.done && !r.expired).length >= 3) return null;
  const kind = ["he", "smoke", "shrapnel", "flare"][Math.floor(rnd(s) * 4)];
  const y = range(s, 90, 525), x = kind === "smoke" ? range(s, 425, 550) : range(s, 585, 810);
  const calls = {
    he: "Enemy emplacement. Request immediate bombardment!",
    smoke: "We're crossing open ground. Need a smoke screen!",
    shrapnel: "Infantry massing ahead. Request airburst!",
    flare: "Can't see their positions. Request illumination!"
  };
  const req = { id: Math.floor(rnd(s)*1e9).toString(36), x, y, kind, ttl: 29, done: false, expired: false,
    unit: ["3rd Rifles", "Cedar Company", "North Platoon", "8th Foot", "Falcon Section"][Math.floor(rnd(s)*5)],
    text: calls[kind] };
  s.requests.push(req); s.stats.requestsTotal++;
  message(s, "radio", `${req.unit}: ${req.text}`); return req;
}
export function fire(s, c, gunIndex, kind, target) {
  if (s.finished || s.paused) return {ok:false, reason:"Mission not active"};
  const gun = s.guns[gunIndex];
  if (!gun) return {ok:false, reason:"Select a field gun"};
  if (!SHELLS[kind]) return {ok:false, reason:"Unknown ammunition"};
  if (gun.reload > 0) return {ok:false, reason:"Gun crew reloading"};
  if (s.ammo[kind] <= 0) return {ok:false, reason:"Ammunition exhausted"};
  if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return {ok:false, reason:"Mark a valid target"};
  const x = clamp(target.x, 20, W-20), y = clamp(target.y, 20, H-20);
  const dispersion = Math.max(6, 45 - 10 * c.upgrades.scouts + (s.weather === "WIND" ? 8 : 0));
  const angle = rnd(s)*Math.PI*2, distance = Math.sqrt(rnd(s))*dispersion;
  s.shots.push({x: clamp(x + Math.cos(angle)*distance, 15, W-15),
    y: clamp(y + Math.sin(angle)*distance, 15, H-15), targetX:x, targetY:y,
    kind, ttl: 1.15 + rnd(s)*0.5, total: 1.65, gun:gunIndex});
  s.ammo[kind]--; s.stats.fired++; s.stats.roundsByType[kind]++; gun.shots++;
  gun.reload = Math.max(1.3, 5.7 - c.upgrades.loaders * 1.15);
  message(s, "order", `Gun ${gunIndex+1}: ${SHELLS[kind].short} round away.`);
  return {ok:true};
}
function impact(s, c, shot) {
  const {kind, x, y} = shot, info = SHELLS[kind];
  const blast = info.radius + (kind === "he" ? c.upgrades.caliber*12 : 0);
  let tagged = 0;
  for (const u of s.units) {
    if (!u.alive) continue;
    const d = Math.hypot(x-u.x, y-u.y);
    if (d > blast) continue;
    const f = Math.pow(1-d/blast, 0.65);
    if (kind === "he" || kind === "shrapnel") {
      const damage = info.damage * (1 + c.upgrades.caliber*0.24) * f * (kind === "shrapnel" ? 1.15:1);
      u.hp -= damage * 1.7; u.morale -= damage * 0.8;
      if (u.team === "enemy") { tagged++; s.stats.hits++; s.suppression += f*2.3; }
      if (u.team === "ally") s.allyMorale -= f*2.5;
      if (u.hp <= 0) {
        u.alive = false;
        if (u.team === "enemy") s.stats.enemyLosses++;
        else {s.stats.friendlyLosses++; message(s, "danger", "Friendly casualties reported near the impact zone.");}
      }
    }
  }
  if(kind === "smoke") { s.support += 9; s.allyMorale = clamp(s.allyMorale+2,0,100); }
  if(kind === "flare") { s.recon += 15; s.support += 2; }
  if(tagged && kind !== "smoke" && kind !== "flare") {s.support += Math.min(5,tagged*0.4); s.enemyMorale -= Math.min(7, tagged*0.9);}
  s.effects.push({kind, x, y, life: kind === "smoke" ? 14 : kind === "flare" ? 10 : 1.2,
    max: kind === "smoke" ? 14 : kind === "flare" ? 10 : 1.2, radius:blast});
  if(kind === "he" || kind === "shrapnel") s.craters.push({x,y,r:range(s,12,26)});
  if(s.craters.length>100) s.craters.shift();
  for(const r of s.requests){
    if(r.done || r.expired || r.kind !== kind) continue;
    if(Math.hypot(x-r.x,y-r.y) < (kind === "flare" ? 150: kind === "smoke" ? 132: 105)){
      r.done=true; s.stats.requestsCompleted++; s.stats.supportScore+=25;
      s.support+=8; s.allyMorale=clamp(s.allyMorale+3,0,100);
      message(s,"success",`${r.unit}: Fire mission effective. Outstanding support!`);
      break;
    }
  }
  message(s, tagged?"success":"field", tagged ? `Impact confirmed. ${tagged} enemy positions suppressed.` : `${info.short} impact registered.`);
}
function skirmish(s, c, dt) {
  const aliveAlly=s.units.filter(u=>u.alive&&u.team==="ally");
  const aliveEnemy=s.units.filter(u=>u.alive&&u.team==="enemy");
  for(const u of s.units){
    if(!u.alive) continue;
    const line=s.front[clamp(Math.floor(u.y/60),0,9)];
    const targetX=u.team==="ally"?line-45:line+70;
    const speed= (u.team==="ally" ? 5.5+s.support*0.15 : 5.7+s.enemyPower*2.5)*dt;
    u.x+=clamp(targetX-u.x,-speed,speed);
    u.jitter+=dt; u.y=clamp(u.y+Math.sin(u.jitter*0.9)*dt*2,25,H-25);
    if(s.recon>0 && u.team==="enemy")u.spotted=true;
  }
  if(s.t>=s.nextSkirmish){
    s.nextSkirmish+=range(s,2.0,3.7);
    for(const [attackers, defenders, power] of [[aliveAlly,aliveEnemy,s.allyPower],[aliveEnemy,aliveAlly,s.enemyPower]]){
      if(!attackers.length || !defenders.length) continue;
      const a=attackers[Math.floor(rnd(s)*attackers.length)];
      const d=defenders.reduce((best,u)=>near(a,u)<near(a,best)?u:best, defenders[0]);
      if(near(a,d)<370 && rnd(s)<0.66){
        const damage=range(s,3,12)*power*(attackers===aliveAlly?(1+s.support*0.015):1);
        d.hp-=damage;d.morale-=damage*0.4;
        if(d.hp<=0){d.alive=false;if(d.team==="ally") s.stats.friendlyLosses++; else s.stats.enemyLosses++;}
      }
    }
  }
  if(s.t>=s.nextEnemyStrike){
    s.nextEnemyStrike += range(s,12,18);
    const x=range(s,275,485), y=range(s,50,550);
    s.effects.push({kind:"enemy",x,y,life:1.5,max:1.5,radius:50});
    for(const u of aliveAlly){if(Math.hypot(x-u.x,y-u.y)<65){u.hp-=range(s,6,24);u.morale-=8;if(u.hp<=0){u.alive=false;s.stats.friendlyLosses++;}}}
    s.allyMorale=clamp(s.allyMorale-range(s,1,4),0,100);
    message(s,"danger","Enemy counterbattery fire detected near the line!");
  }
  if(s.t>=s.nextFront){
    s.nextFront+=3.5;
    const allyCount=aliveAlly.length,enemyCount=aliveEnemy.length;
    const own=(allyCount/15)*s.allyPower*(s.allyMorale/80) + s.support*0.035;
    const foe=(enemyCount/16)*s.enemyPower*(s.enemyMorale/80)+0.10;
    const tide=clamp((own-foe)*17 + range(s,-6,6),-16,16);
    for(let i=0;i<s.front.length;i++){
      const noise=range(s,-3.2,3.2);
      s.front[i]=clamp(s.front[i] + tide + noise,290,685);
    }
    s.allyMorale=clamp(s.allyMorale+range(s,-1,0.8),0,100);
    s.enemyMorale=clamp(s.enemyMorale+range(s,-0.6,0.8),0,100);
  }
}
export function stepMission(s, c, dt){
  if(s.finished || s.paused || !Number.isFinite(dt) || dt<=0) return;
  dt=Math.min(dt,0.15); s.t+=dt;
  s.support=Math.max(0,s.support-dt*0.23); s.suppression=Math.max(0,s.suppression-dt*0.1); s.recon=Math.max(0,s.recon-dt);
  for(const g of s.guns)g.reload=Math.max(0,g.reload-dt);
  for(let i=s.shots.length-1;i>=0;i--){const sh=s.shots[i]; sh.ttl-=dt;if(sh.ttl<=0){s.shots.splice(i,1);impact(s,c,sh);}}
  for(let i=s.effects.length-1;i>=0;i--){s.effects[i].life-=dt;if(s.effects[i].life<=0)s.effects.splice(i,1);}
  for(const r of s.requests){if(!r.done&&!r.expired){r.ttl-=dt;if(r.ttl<=0){r.expired=true;s.stats.requestsMissed++;message(s,"danger",`${r.unit}: Fire mission cancelled. Too late.`);}}}
  if(s.t>=s.nextRequest){addRequest(s);s.nextRequest+=range(s,16,22);}
  skirmish(s,c,dt);
  if(s.t>=MISSION_SECONDS || s.allyMorale<=12 || s.enemyMorale<=12 || s.front.every(x=>x>660)||s.front.every(x=>x<315)) endMission(s,c);
}
export function endMission(s,c){
  if(s.finished)return s.result;
  s.finished=true;
  const averageFront=s.front.reduce((a,b)=>a+b,0)/s.front.length;
  const territory=(averageFront-485)/185;
  const allies=s.units.filter(u=>u.team==="ally"&&u.alive).length;
  const enemies=s.units.filter(u=>u.team==="enemy"&&u.alive).length;
  const score=territory*0.63 +(allies/15-enemies/16)*0.20 +(s.allyMorale-s.enemyMorale)/100*0.17 + (s.allyPower-s.enemyPower)*0.14;
  const outcome=score>0.12?"victory":score< -0.10?"defeat":"stalemate";
  const shift=outcome==="victory"?0.09+Math.max(0,score)*0.04:outcome==="defeat"?-0.09+Math.min(0,score)*0.04:0.01;
  c.sectors[c.activeSector]=clamp(c.sectors[c.activeSector]+shift,-0.8,0.85);
  // Higher sector balance means an Allied advance; negative means enemy pressure.
  if(outcome==="victory") c.victories++; if(outcome==="defeat") c.defeats++;
  const completion=s.stats.requestsTotal? s.stats.requestsCompleted/s.stats.requestsTotal:0;
  const reward=Math.round((outcome==="victory"?95:outcome==="stalemate"?57:32)+s.stats.requestsCompleted*12+Math.min(60,s.stats.enemyLosses*3)-s.stats.friendlyLosses*2);
  c.credits+=Math.max(20,reward);
  const report={day:c.day,sector:SECTORS[c.activeSector],outcome,score:Math.round(score*100),shift:Math.round(shift*100),credits:Math.max(20,reward),
    fired:s.stats.fired,hits:s.stats.hits,enemyLosses:s.stats.enemyLosses,friendlyLosses:s.stats.friendlyLosses,
    requestsCompleted:s.stats.requestsCompleted,requestsTotal:s.stats.requestsTotal,completion:Math.round(completion*100),
    alliedPerformance: Math.round(s.allyPower*100),enemyPerformance:Math.round(s.enemyPower*100),
    survivingAllies:allies,survivingEnemies:enemies,
    notes:[
      completion>=0.6?"Radio coordination was strong; infantry received timely fire support.":"Missed fire missions reduced the infantry's ability to maneuver.",
      s.stats.friendlyLosses>1?"Friendly units suffered losses. Check firing zones before striking.":"Fire discipline protected friendly formations.",
      s.stats.roundsByType.smoke>=2?"Smoke screens helped allied troops cross exposed ground.":"Consider smoke screens during infantry advances.",
      score>0?"Local infantry initiative contributed to the battle's outcome.":"Allied and enemy battlefield performance affected the result beyond your control."
    ]};
  s.result=report;c.lastReport=report;c.history.unshift(report);if(c.history.length>30)c.history.length=30;
  c.day++;
  if(outcome==="victory"&&c.activeSector<SECTORS.length-1 && rnd(s)>0.33)c.activeSector++;
  if(outcome==="defeat"&&c.activeSector>0 && rnd(s)>0.55)c.activeSector--;
  message(s,"order",`HEADQUARTERS: ${outcome.toUpperCase()}. Detailed report available.`);
  return report;
}
export function safeCampaign(raw){
  if(!raw || raw.version!==1 || !Array.isArray(raw.sectors))return createCampaign();
  const c=createCampaign();
  c.seed=(Number(raw.seed)||1826)>>>0; c.credits=clamp(Number(raw.credits)||0,0,999999);
  c.day=clamp(Math.floor(Number(raw.day)||1),1,99999);c.activeSector=clamp(Math.floor(Number(raw.activeSector)||0),0,SECTORS.length-1);
  c.sectors=c.sectors.map((v,i)=>clamp(Number(raw.sectors[i])||0,-0.8,0.85));
  for(const k of Object.keys(UPGRADES))c.upgrades[k]=clamp(Math.floor(Number(raw.upgrades?.[k])||0),0,UPGRADES[k].max);
  c.victories=clamp(Number(raw.victories)||0,0,99999);c.defeats=clamp(Number(raw.defeats)||0,0,99999);
  c.history=Array.isArray(raw.history)?raw.history.slice(0,30):[];
  c.lastReport=raw.lastReport||null;return c;
}

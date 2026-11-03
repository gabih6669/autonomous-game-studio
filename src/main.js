import {W,H,MISSION_SECONDS,SECTORS,SHELLS,UPGRADES,clamp,createCampaign,createMission,buyUpgrade,upgradeCost,fire,stepMission,safeCampaign} from './sim.js';
const $ = id => document.getElementById(id);
const cvs=$('battlefield'), ctx=cvs.getContext('2d',{alpha:false});
const STORAGE='last-light-save-v1';
const shellKeys=Object.keys(SHELLS);
let campaign=createCampaign(), mission, selectedGun=0, selectedShell='he', target=null, selectedRequest=null;
let running=false, speed=1, muted=false, audio=null, lastFrame=performance.now(), lastUI=0, lastSave=0, lastShotCount=0;
let pointer={x:-100,y:-100}, phase='intro', effectParticles=[], terrainCanvas;
function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function load(){try{const obj=JSON.parse(localStorage.getItem(STORAGE));if(!obj||obj.version!==1)return false;campaign=safeCampaign(obj.campaign);if(obj.mission?.version===1&&obj.mission?.units?.length&&obj.mission?.guns?.length){mission=obj.mission;phase=mission.finished?'between':'intro';return true;}return false;}catch{return false;}}
function save(show=false){try{localStorage.setItem(STORAGE,JSON.stringify({version:1,campaign,mission}));if(show){$('saveStatus').textContent='✓ CAMPAIGN SAVED LOCALLY';setTimeout(()=>{$('saveStatus').textContent='◉ AUTO-SAVE ENABLED'},2000);}}catch{$('saveStatus').textContent='LOCAL STORAGE UNAVAILABLE';}}
function init(){const resumed=load();if(!mission)mission=createMission(campaign);terrainCanvas=makeTerrain();setupEvents();renderCampaign();renderUpgrades();renderShells();renderGuns();updateUI();if(resumed && mission.finished){showReport();}else{showIntro(resumed);}requestAnimationFrame(loop);}
function setupEvents(){
  cvs.addEventListener('pointermove',e=>{pointer=mapPos(e);$('coordLabel').textContent=`GRID ${String(Math.round(pointer.x/10)).padStart(2,'0')} / ${String(Math.round(pointer.y/10)).padStart(2,'0')}`;});
  cvs.addEventListener('pointerleave',()=>{pointer={x:-100,y:-100};$('coordLabel').textContent='GRID — / —';});
  cvs.addEventListener('pointerdown',e=>{if(phase!=='playing')return;const pos=mapPos(e);if(e.button===2)return;markTarget(pos);});
  cvs.addEventListener('contextmenu',e=>e.preventDefault());
  $('fireBtn').onclick=()=>{if(phase==='between'){nextMission();return;}performFire();};
  $('pauseBtn').onclick=()=>{if(phase!=='playing')return;mission.paused=!mission.paused;$('pauseBtn').textContent=mission.paused?'▶ RESUME':'Ⅱ PAUSE';};
  $('speedBtn').onclick=()=>{speed=speed===1?2:speed===2?3:1;$('speedBtn').textContent=`${speed}× SPEED`;};
  $('soundBtn').onclick=()=>{muted=!muted;$('soundBtn').textContent=muted?'♫ OFF':'♫ ON';if(!muted)bleep();};
  $('saveBtn').onclick=()=>save(true);
  $('resetBtn').onclick=()=>{if(!window.confirm('Start a new campaign? Current save and upgrades will be overwritten.'))return;campaign=createCampaign((Date.now()>>>0));mission=createMission(campaign);selectedGun=0;selectedShell='he';target=null;selectedRequest=null;phase='intro';running=false;save(true);renderCampaign();renderUpgrades();showIntro(false);};
  $('overlayAction').onclick=()=>{if(phase==='intro'){phase='playing';running=true;$('overlay').classList.remove('open');mission.paused=false;lastFrame=performance.now();}else if(phase==='report'){phase='between';$('overlay').classList.remove('open');renderUpgrades();updateUI();}};
  window.addEventListener('keydown',e=>{if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    if(e.code==='Space'){e.preventDefault();if(phase==='playing')performFire();}
    const gun=Number(e.key)-1;if(gun>=0&&gun<mission.guns.length)chooseGun(gun);
    const k={q:'he',w:'smoke',e:'shrapnel',r:'flare'}[e.key.toLowerCase()];if(k)chooseShell(k);
    if(e.key.toLowerCase()==='p'&&phase==='playing')$('pauseBtn').click();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing'){mission.paused=true;$('pauseBtn').textContent='▶ RESUME';save();}});
}
function mapPos(e){const r=cvs.getBoundingClientRect();return{x:clamp((e.clientX-r.left)/r.width*W,0,W),y:clamp((e.clientY-r.top)/r.height*H,0,H)};}
function markTarget(p){target={x:Math.round(p.x),y:Math.round(p.y)};selectedRequest=null;
  $('targetLabel').textContent=`X ${String(Math.round(target.x/10)).padStart(2,'0')} · Y ${String(Math.round(target.y/10)).padStart(2,'0')}`;
  for(const r of mission.requests)if(!r.done&&!r.expired&&Math.hypot(r.x-p.x,r.y-p.y)<40){selectedRequest=r.id;selectedShell=r.kind;break;}
  renderShells();renderRequests();updateControls();bleep(500);
}
function chooseGun(i){selectedGun=i;renderGuns();updateControls();}
function chooseShell(k){selectedShell=k;renderShells();updateControls();}
function performFire(){if(phase!=='playing')return;
  const r=fire(mission,campaign,selectedGun,selectedShell,target);
  if(r.ok){$('fireFeedback').textContent='ROUND AWAY — OBSERVE IMPACT';$('fireFeedback').style.color='#dec192';sfx('fire');}
  else{$('fireFeedback').textContent=r.reason.toUpperCase();$('fireFeedback').style.color='#df9a8b';bleep(190);}
  renderShells();renderGuns();updateControls();save();
}
function renderGuns(){const wrap=$('guns');wrap.innerHTML='';mission.guns.forEach((g,i)=>{const b=document.createElement('button');b.className='gun'+(i===selectedGun?' selected':'');b.setAttribute('aria-label',`Select gun ${i+1}`);b.innerHTML=`<span class="gun-icon">♜</span><small>GUN ${String(i+1).padStart(2,'0')}</small><div class="gun-bar"><span style="width:${Math.round((1-clamp(g.reload/5.7,0,1))*100)}%"></span></div>`;b.onclick=()=>chooseGun(i);wrap.append(b);});}
function renderShells(){const glyph={he:'✹',smoke:'☁',shrapnel:'✦',flare:'☼'};$('shells').innerHTML='';shellKeys.forEach(k=>{const info=SHELLS[k],b=document.createElement('button');b.className='shell'+(selectedShell===k?' selected':'');b.innerHTML=`<span class="shell-glyph">${glyph[k]}</span><span><span class="shell-name">${info.name.toUpperCase()}</span><span class="shell-desc">${info.effect}</span></span><span class="shell-count">${mission.ammo[k]}</span>`;b.onclick=()=>chooseShell(k);$('shells').append(b);});}
function renderRequests(){const wrap=$('requests');wrap.innerHTML='';const list=mission.requests.filter(r=>!r.done&&!r.expired);
  if(!list.length){wrap.innerHTML='<div class="empty-state">No urgent calls on the line.<br>Monitor the front.</div>';return;}
  for(const r of list){const b=document.createElement('button');b.className='request'+(selectedRequest===r.id?' selected':'');b.innerHTML=`<div class="request-title"><span>◉ ${escapeHtml(r.unit.toUpperCase())}</span><span class="request-ttl">${Math.ceil(r.ttl)}s</span></div><p>${escapeHtml(r.text)}</p><small>${SHELLS[r.kind].short} REQUEST · GRID ${Math.round(r.x/10)}/${Math.round(r.y/10)}</small><div class="request-timer"><span style="width:${clamp(r.ttl/29*100,0,100)}%"></span></div>`;
    b.onclick=()=>{selectedRequest=r.id;target={x:r.x,y:r.y};chooseShell(r.kind);$('targetLabel').textContent=`X ${Math.round(r.x/10)} · Y ${Math.round(r.y/10)}`;renderRequests();updateControls();bleep(520);};wrap.append(b);}
}
function renderLog(){const n=$('radioLog');n.innerHTML=mission.messages.slice(0,10).map(m=>`<div class="log-entry ${escapeHtml(m.type)}"><span class="log-time">${fmt(MISSION_SECONDS-m.t)}</span>${escapeHtml(m.text)}</div>`).join('');}
function renderCampaign(){const wrap=$('campaignMap');wrap.innerHTML='';campaign.sectors.forEach((v,i)=>{const dom=document.createElement('div');dom.className='campaign-sector'+(i===campaign.activeSector?' current':'');const ground=clamp((v+0.8)/1.65*100,0,100);dom.innerHTML=`<small>${String(i+1).padStart(2,'0')} / SECTOR</small><strong>${escapeHtml(SECTORS[i].toUpperCase())}</strong><div class="sector-tide"><span style="width:${ground}%"></span></div><div class="sector-pos">${i===campaign.activeSector?'◆ ACTIVE FRONT':v>0.10?'ALLIED GAINS':v< -0.08?'ENEMY PRESSURE':'CONTESTED'}</div>`;wrap.append(dom);});$('credits').textContent=`${campaign.credits} RP`;$('victories').textContent=campaign.victories;$('defeats').textContent=campaign.defeats;$('dayLabel').textContent=String(campaign.day).padStart(2,'0');$('sectorLabel').textContent=SECTORS[campaign.activeSector].toUpperCase();$('fieldSector').textContent=SECTORS[campaign.activeSector].toUpperCase();}
function renderUpgrades(){const wrap=$('upgrades');wrap.innerHTML='';for(const [key,u] of Object.entries(UPGRADES)){const level=campaign.upgrades[key],cost=upgradeCost(campaign,key);const box=document.createElement('div');box.className='upgrade';box.innerHTML=`<div class="upgrade-title">${escapeHtml(u.name.toUpperCase())}</div><div class="upgrade-stars">${'★'.repeat(level)}${'☆'.repeat(u.max-level)}</div><p>${escapeHtml(u.desc)}</p>`;const b=document.createElement('button');b.textContent=level>=u.max?'MAX LEVEL':`REQUISITION · ${cost} RP`;b.disabled=phase==='playing'||level>=u.max||campaign.credits<cost;b.onclick=()=>{const r=buyUpgrade(campaign,key);if(r.ok){mission=createMission(campaign);selectedGun=0;save(true);renderCampaign();renderUpgrades();renderGuns();renderShells();updateUI();bleep(680);} };box.append(b);wrap.append(box);}}
function updateControls(){const g=mission.guns[selectedGun],ready=!!target&&g&&g.reload<=0&&mission.ammo[selectedShell]>0&&phase==='playing'&&!mission.paused;$('fireBtn').disabled=!ready;
  $('fireCoords').textContent=target?`${Math.round(target.x/10)} / ${Math.round(target.y/10)}`:'UNMARKED';
  $('gunStatus').textContent=g?(g.reload>0?`RELOAD ${g.reload.toFixed(1)}S`:'READY TO FIRE'):'NO GUN';}
function updateUI(){const left=Math.max(0,MISSION_SECONDS-mission.t);$('timeLabel').textContent=fmt(left);$('allyLabel').textContent=`${Math.max(0,Math.round(mission.allyMorale))}%`;$('enemyLabel').textContent=`${Math.max(0,Math.round(mission.enemyMorale))}%`;$('allyFill').style.width=`${clamp(mission.allyMorale,0,100)}%`;$('enemyFill').style.width=`${clamp(mission.enemyMorale,0,100)}%`;
  const f=mission.front.reduce((a,b)=>a+b,0)/mission.front.length;$('frontLabel').textContent=f>513?'ADVANCING':f<458?'FALLING BACK':'CONTESTED';$('frontLabel').style.color=f>513?'#a9c599':f<458?'#d99888':'#dfc29b';$('weatherLabel').textContent=mission.weather;
  $('aliveAllies').textContent=`${mission.units.filter(u=>u.team==='ally'&&u.alive).length} / 15`;
  $('aliveEnemies').textContent=mission.recon>0||mission.t>70?`${mission.units.filter(u=>u.team==='enemy'&&u.alive).length} DETECTED`:'UNCONFIRMED';
  if(phase==='between'){$('fireBtn').disabled=false;$('fireBtn').innerHTML='DEPLOY NEXT MISSION →';$('fireFeedback').textContent='REVIEW THE CAMPAIGN AND PURCHASE UPGRADES';}
  else {$('fireBtn').innerHTML='<span>✹</span> FIRE BATTERY <small>[ SPACE ]</small>';updateControls();}
  renderGuns();renderShells();renderRequests();renderLog();}
function fmt(s){return `${String(Math.floor(Math.max(0,s)/60)).padStart(2,'0')}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;}
function showIntro(resumed){phase='intro';running=false;const name=SECTORS[campaign.activeSector];$('overlay').classList.add('open');$('overlayEyebrow').textContent=`HEADQUARTERS · OPERATION ${String(campaign.day).padStart(2,'0')}`;$('overlayTitle').textContent='THE LAST LIGHT';$('overlaySubtitle').textContent=`${name} — The guns decide where they strike. The infantry decides whether they advance.`;
  $('overlayBody').innerHTML=`<div class="overlay-grid"><div><b>${mission.guns.length}</b><span>FIELD GUNS</span></div><div><b>${Object.values(mission.ammo).reduce((a,b)=>a+b,0)}</b><span>ROUNDS READY</span></div><div><b>${mission.weather}</b><span>CONDITIONS</span></div></div><p class="narrow">Select a gun and a shell, then click the top-down battlefield to mark a target. Fire by pressing <span class="focus">SPACE</span>. Respond to urgent radio calls, use smoke to shield the advance, and protect friendly troops. Your allies fight on their own — even excellent fire support may not secure victory.</p><div class="hint">${resumed&&mission.t>0?'SAVED OPERATION FOUND · RESUME YOUR EXISTING BATTLE':'NEW OPERATION READY · REQUISITION UPGRADES AFTER EACH MISSION'}</div>`;
  $('overlayAction').textContent=resumed&&mission.t>0?'RESUME OPERATION →':'DEPLOY TO THE FRONT →';renderUpgrades();}
function showReport(){phase='report';running=false;const r=mission.result;renderCampaign();renderUpgrades();save(true);$('overlay').classList.add('open');$('overlayEyebrow').textContent=`AFTER-ACTION REPORT · DAY ${String(r.day).padStart(2,'0')}`;$('overlayTitle').textContent=r.outcome==='victory'?'GROUND TAKEN':r.outcome==='defeat'?'THE LINE BROKE':'GROUND CONTESTED';$('overlaySubtitle').textContent=`${r.sector} · ${r.outcome.toUpperCase()} · ${r.shift>=0?'+':''}${r.shift}% CAMPAIGN CONTROL`;
  $('overlayBody').innerHTML=`<div class="overlay-grid"><div><b>${r.credits} RP</b><span>SUPPLIES EARNED</span></div><div><b>${r.requestsCompleted}/${r.requestsTotal}</b><span>CALLS ANSWERED</span></div><div><b>${r.enemyLosses}</b><span>ENEMY LOSSES</span></div><div><b>${r.friendlyLosses}</b><span>FRIENDLY LOSSES</span></div><div><b>${r.fired}</b><span>ROUNDS FIRED</span></div><div><b>${r.alliedPerformance}%</b><span>ALLIED INITIATIVE</span></div></div>${r.notes.map(n=>`<div class="report-note">${escapeHtml(n)}</div>`).join('')}`;
  $('overlayAction').textContent='VIEW CAMPAIGN & UPGRADES →';}
function nextMission(){mission=createMission(campaign);terrainCanvas=makeTerrain();selectedGun=0;target=null;selectedRequest=null;lastShotCount=0;effectParticles=[];phase='intro';save(true);renderCampaign();renderUpgrades();renderGuns();renderShells();updateUI();showIntro(false);}
function loop(now){const dt=Math.min(0.07,(now-lastFrame)/1000||0);lastFrame=now;
  if(phase==='playing'&&!mission.paused){let remaining=dt*speed;while(remaining>0){const s=Math.min(0.06,remaining);stepMission(mission,campaign,s);remaining-=s;if(mission.finished)break;}
    if(mission.finished)showReport();}
  render(now/1000);
  if(now-lastUI>180){updateUI();lastUI=now;}
  if(now-lastSave>4500){save();lastSave=now;}
  requestAnimationFrame(loop);
}
// Pixel-art battlefield painter. All terrain, sprites, and VFX are generated locally.
function hash(x,y,seed=17){let n=(Math.imul(x+seed,374761393)+Math.imul(y+seed,668265263))|0;n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function makeTerrain(){const off=document.createElement('canvas');off.width=W;off.height=H;const g=off.getContext('2d');g.fillStyle='#69735b';g.fillRect(0,0,W,H);
  for(let y=0;y<H;y+=8)for(let x=0;x<W;x+=8){const n=hash(x/8,y/8,campaign.day);g.fillStyle=n>.83?'#80846a':n>.57?'#70795e':n>.23?'#656d55':'#5d694e';g.fillRect(x,y,8,8);}
  for(let i=0;i<175;i++){const x=Math.floor(hash(i,31,campaign.day)*W/8)*8,y=Math.floor(hash(i,64,campaign.day)*H/8)*8;g.fillStyle=i%3===0?'#9b946d':'#484d42';g.fillRect(x,y,8+(i%3)*8,4);}
  // Top-down roads running through muddy fields.
  g.fillStyle='#837f67';for(let y=0;y<H;y+=8){const x=95+Math.sin(y/70)*17;g.fillRect(x,y,42,8);}
  for(let x=0;x<W;x+=8){const y=488+Math.sin(x/85)*16;g.fillRect(x,y,8,24);}
  g.fillStyle='#586448';for(let i=0;i<50;i++){const x=Math.floor(hash(i,16)*W/8)*8,y=Math.floor(hash(i,19)*H/8)*8;g.fillRect(x,y,8,8);g.fillRect(x-8,y+8,24,8);}
  // Farmhouse ruins and a broken mill.
  for(const b of [{x:212,y:127,w:66,h:48},{x:745,y:441,w:82,h:60},{x:815,y:88,w:57,h:41}]){
    g.fillStyle='#4b5245';g.fillRect(b.x-5,b.y-5,b.w+10,b.h+10);g.fillStyle='#a9a18b';g.fillRect(b.x,b.y,b.w,b.h);g.fillStyle='#716c5b';g.fillRect(b.x+8,b.y+8,b.w-16,b.h-16);g.fillStyle='#3c453f';g.fillRect(b.x+16,b.y+16,b.w-32,b.h-32);
    g.fillStyle='#c4b7a1';g.fillRect(b.x+5,b.y+5,b.w-10,4);g.fillRect(b.x+5,b.y+b.h-9,b.w-10,4);
  }
  return off;
}
function linePath(xs,offset=0){ctx.beginPath();ctx.moveTo(xs[0]+offset,0);for(let i=0;i<xs.length;i++){const y=(i+0.5)*H/xs.length;ctx.lineTo(xs[i]+offset,y);if(i<xs.length-1){ctx.lineTo(xs[i]+offset+((i%2)?-8:8),y+10);}}ctx.lineTo(xs.at(-1)+offset,H);}
function drawTrenches(){const xs=mission.front;
  ctx.fillStyle='#8a836b';ctx.globalAlpha=.14;linePath(xs);ctx.lineTo(W,H);ctx.lineTo(W,0);ctx.fill();ctx.globalAlpha=1;
  for(const [offset,back,dark,edge] of [[-65,'#6d5f48','#302c27','#aa9271'],[68,'#725747','#342b28','#b49a76']]){
    linePath(xs,offset);ctx.strokeStyle=back;ctx.lineWidth=24;ctx.stroke();linePath(xs,offset);ctx.strokeStyle=edge;ctx.lineWidth=13;ctx.stroke();linePath(xs,offset);ctx.strokeStyle=dark;ctx.lineWidth=8;ctx.stroke();
    for(let i=0;i<24;i++){const y=i*26,idx=clamp(Math.floor(y/H*xs.length),0,xs.length-1),x=xs[idx]+offset;
      ctx.fillStyle=i%3?'#9b8969':'#b09c7b';ctx.fillRect(Math.round(x)-12,y,7,5);ctx.fillRect(Math.round(x)+5,y+6,7,5);}
  }
  for(let i=0;i<42;i++){const y=hash(i,101)*H,idx=clamp(Math.floor(y/H*xs.length),0,xs.length-1),x=xs[idx]+(i%2?14:-15);ctx.strokeStyle='#303a31';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+10,y+8);ctx.moveTo(x+10,y);ctx.lineTo(x,y+8);ctx.stroke();}
  // Faint dotted front line between both positions.
  ctx.setLineDash([5,9]);linePath(xs);ctx.strokeStyle='#e8ddad8a';ctx.lineWidth=2;ctx.stroke();ctx.setLineDash([]);
}
function drawCrater(x,y,r){ctx.fillStyle='#444438';ctx.fillRect(Math.round(x-r),Math.round(y-r/2),Math.round(r*2),Math.round(r));ctx.fillStyle='#353e35';ctx.fillRect(Math.round(x-r*.6),Math.round(y-r*.35),Math.round(r*1.2),Math.round(r*.7));ctx.fillStyle='#b0a285';ctx.fillRect(Math.round(x-r*.72),Math.round(y-r*.62),Math.round(r*.8),3);}
function drawUnit(u,t){if(!u.alive){ctx.fillStyle='#394239';ctx.fillRect(Math.round(u.x),Math.round(u.y),5,3);return;}
  const hidden=u.team==='enemy'&&mission.recon<=0&&u.x>mission.front[clamp(Math.floor(u.y/60),0,9)]+120;
  if(hidden)return;
  const px=Math.round(u.x),py=Math.round(u.y),ally=u.team==='ally';
  ctx.fillStyle='#202921bb';ctx.fillRect(px-5,py+4,12,4);
  ctx.fillStyle=ally?'#b4c79a':'#ca826e';ctx.fillRect(px-4,py-5,8,9);
  ctx.fillStyle=ally?'#586f54':'#65463b';ctx.fillRect(px-5,py-7,10,4);ctx.fillRect(px-3,py+4,3,4);ctx.fillRect(px+2,py+4,3,4);
  ctx.fillStyle='#222924';ctx.fillRect(px+(ally?3:-10),py-1,7,2);
  if(u.hp<40){ctx.fillStyle='#dbad77';ctx.fillRect(px-6,py-11,12,2);ctx.fillStyle='#bc7166';ctx.fillRect(px-6,py-11,12*u.hp/100,2);}
  const phase=(u.jitter*2)%8<3; if(phase){ctx.fillStyle='#d3c792';ctx.fillRect(px+2,py-2,2,2);}
}
function render(t){ctx.imageSmoothingEnabled=false;ctx.drawImage(terrainCanvas,0,0);
  if(mission.weather==='FOG'){ctx.fillStyle='#cad3c016';ctx.fillRect(0,0,W,H);}if(mission.weather==='DRIZZLE'){ctx.fillStyle='#263f3a22';ctx.fillRect(0,0,W,H);}
  drawTrenches();
  for(const c of mission.craters)drawCrater(c.x,c.y,c.r);
  for(const u of mission.units)drawUnit(u,t);
  // Shell flight is an abstract warning marker: no real ballistic trajectories.
  for(const sh of mission.shots){const progress=clamp(1-sh.ttl/sh.total,0,1);const px=sh.x,py=sh.y;ctx.strokeStyle='#ffe1ab99';ctx.lineWidth=2;ctx.setLineDash([6,7]);ctx.beginPath();ctx.arc(px,py,12+progress*8,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#f7d28e';ctx.fillRect(px-2,py-2,4,4);}
  for(const e of mission.effects){const progress=1-e.life/e.max;const r=e.radius*(0.45+progress*.55);
    if(e.kind==='smoke'){const cloudCount=18;for(let i=0;i<cloudCount;i++){const angle=i*2.4,rad=r*(0.20+hash(i,21)*0.65);const x=e.x+Math.cos(angle)*rad,y=e.y+Math.sin(angle)*rad;ctx.fillStyle=i%2?'#b9c5b2bb':'#d1d0b8a8';const d=18+hash(i,24)*21;ctx.fillRect(Math.round(x-d/2),Math.round(y-d/2),Math.ceil(d),Math.ceil(d));}}
    else if(e.kind==='flare'){ctx.fillStyle='#e5dba837';ctx.beginPath();ctx.arc(e.x,e.y,r,0,7);ctx.fill();ctx.strokeStyle='#f5e7b0';ctx.strokeRect(e.x-5,e.y-5,10,10);}
    else{ctx.fillStyle=progress<.35?'#ffe0a7bd':'#423a32a0';ctx.beginPath();ctx.arc(e.x,e.y,r*(progress<.35?.7:1),0,7);ctx.fill();ctx.strokeStyle=progress<.35?'#f6c27d':'#645445';ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,r*progress,0,7);ctx.stroke();ctx.fillStyle='#e9b776';for(let i=0;i<11&&progress<.65;i++){const a=i*2.4,l=(14+hash(i,25)*r)*progress;ctx.fillRect(Math.round(e.x+Math.cos(a)*l),Math.round(e.y+Math.sin(a)*l),5,5);}}
  }
  for(const req of mission.requests){if(req.done||req.expired)continue;const pulse=4+Math.sin(t*4)*3;const x=req.x,y=req.y;
    ctx.strokeStyle=req.id===selectedRequest?'#ffe2a2':'#d3aa70';ctx.lineWidth=2;ctx.strokeRect(x-14-pulse/2,y-14-pulse/2,28+pulse,28+pulse);
    ctx.beginPath();ctx.moveTo(x-26,y);ctx.lineTo(x-16,y);ctx.moveTo(x+16,y);ctx.lineTo(x+26,y);ctx.moveTo(x,y-26);ctx.lineTo(x,y-16);ctx.moveTo(x,y+16);ctx.lineTo(x,y+26);ctx.stroke();
    ctx.font='bold 11px monospace';ctx.fillStyle='#ffe5aa';ctx.fillText(SHELLS[req.kind].short,x+22,y-18);
  }
  if(target){const {x,y}=target;const wobble=2+Math.sin(t*2)*2;ctx.strokeStyle='#efd59d';ctx.lineWidth=2;ctx.strokeRect(x-11-wobble,y-11-wobble,22+wobble*2,22+wobble*2);ctx.beginPath();ctx.moveTo(x-26,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+26,y);ctx.moveTo(x,y-26);ctx.lineTo(x,y-7);ctx.moveTo(x,y+7);ctx.lineTo(x,y+26);ctx.stroke();ctx.font='bold 11px monospace';ctx.fillStyle='#ffe4ad';ctx.fillText(`GRID ${Math.round(x/10)} / ${Math.round(y/10)}`,x+17,y-19);}
  if(pointer.x>=0 && !target){ctx.strokeStyle='#f1e1ba88';ctx.strokeRect(pointer.x-8,pointer.y-8,16,16);}
  // Subtle map graticule on top for a tactical-map feel.
  ctx.strokeStyle='#f0e7d018';ctx.lineWidth=1;for(let x=0;x<W;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}for(let y=0;y<H;y+=80){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
  if(mission.paused && phase==='playing'){ctx.fillStyle='#101817ae';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.font='bold 42px Georgia';ctx.fillStyle='#f6ddb1';ctx.fillText('OPERATION PAUSED',W/2,H/2);ctx.textAlign='left';}
}
function getAudio(){if(muted)return null;try{audio??=new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();return audio;}catch{return null;}}
function bleep(freq=440){const a=getAudio();if(!a)return;const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.setValueAtTime(freq,a.currentTime);g.gain.setValueAtTime(.028,a.currentTime);g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+.09);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+.1);}
function sfx(kind){const a=getAudio();if(!a)return;const len=.4,buffer=a.createBuffer(1,Math.ceil(a.sampleRate*len),a.sampleRate),samples=buffer.getChannelData(0);for(let i=0;i<samples.length;i++){const t=i/a.sampleRate; samples[i]=(Math.random()*2-1)*Math.pow(1-t/len,3)*.42;}const src=a.createBufferSource(),gain=a.createGain(),low=a.createBiquadFilter();low.type='lowpass';low.frequency.value=kind==='fire'?230:500;src.buffer=buffer;src.connect(low);low.connect(gain);gain.connect(a.destination);gain.gain.value=.24;src.start();}
init();

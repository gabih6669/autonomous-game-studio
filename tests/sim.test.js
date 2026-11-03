import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,createMission,SHELLS,UPGRADES,buyUpgrade,upgradeCost,fire,stepMission,addRequest,endMission,safeCampaign,MISSION_SECONDS} from '../src/sim.js';

test('campaign initializes with sensible campaign progression',()=>{
 const c=createCampaign();assert.equal(c.day,1);assert.equal(c.credits,130);assert.equal(c.sectors.length,7);assert.equal(c.activeSector,2);
});
test('new mission has autonomous teams and an operational battery',()=>{
 const m=createMission(createCampaign());assert.equal(m.units.filter(u=>u.team==='ally').length,15);
 assert.equal(m.units.filter(u=>u.team==='enemy').length,16);assert.equal(m.guns.length,1);assert.ok(m.ammo.he>0);
});
test('firing consumes ammunition, starts reload and schedules a shell',()=>{
 const c=createCampaign(),m=createMission(c);const n=m.ammo.he;
 assert.equal(fire(m,c,0,'he',{x:685,y:285}).ok,true);assert.equal(m.ammo.he,n-1);
 assert.equal(m.shots.length,1);assert.ok(m.guns[0].reload>0);
 assert.equal(fire(m,c,0,'he',{x:685,y:285}).ok,false);
});
test('no arbitrary firing without coordinates or ammunition',()=>{
 const c=createCampaign(),m=createMission(c);
 assert.equal(fire(m,c,0,'he',null).ok,false);m.ammo.he=0;
 assert.equal(fire(m,c,0,'he',{x:700,y:300}).ok,false);
 assert.equal(fire(m,c,8,'smoke',{x:700,y:300}).ok,false);
});
test('correct shell completes an urgent fire support request',()=>{
 const c=createCampaign(),m=createMission(c),r=addRequest(m);
 assert.ok(r);assert.equal(fire(m,c,0,r.kind,{x:r.x,y:r.y}).ok,true);
 for(let i=0;i<45;i++)stepMission(m,c,0.05);
 assert.equal(m.stats.requestsCompleted,1);assert.equal(r.done,true);
});
test('wrong shell type will not complete a matching request',()=>{
 const c=createCampaign(),m=createMission(c),r=addRequest(m);
 const wrong=Object.keys(SHELLS).find(k=>k!==r.kind);
 assert.equal(fire(m,c,0,wrong,{x:r.x,y:r.y}).ok,true);
 for(let i=0;i<40;i++)stepMission(m,c,0.05);
 assert.equal(m.stats.requestsCompleted,0);
});
test('smoke creates lasting protection and supports infantry',()=>{
 const c=createCampaign(),m=createMission(c);
 fire(m,c,0,'smoke',{x:500,y:250});for(let i=0;i<40;i++)stepMission(m,c,.05);
 assert.ok(m.effects.some(x=>x.kind==='smoke'));assert.ok(m.support>0);
});
test('upgrades affect field guns and ammunition allocation',()=>{
 const c=createCampaign();const price=upgradeCost(c,'guns');const ret=buyUpgrade(c,'guns');
 assert.equal(ret.ok,true);assert.equal(c.credits,130-price);assert.equal(createMission(c).guns.length,2);
 c.credits=999;for(let i=0;i<4;i++)buyUpgrade(c,'supply');assert.equal(c.upgrades.supply,3);
 assert.ok(createMission(c).ammo.he>createMission(createCampaign()).ammo.he);
});
test('upgrades enforce available funding and maximum levels',()=>{
 const c=createCampaign();c.credits=0;assert.equal(buyUpgrade(c,'guns').ok,false);
 assert.equal(buyUpgrade(c,'bogus').ok,false);
});
test('frontline and unit AI advance autonomously without any shells',()=>{
 const c=createCampaign(),m=createMission(c);const start=m.front.slice();
 for(let i=0;i<300;i++)stepMission(m,c,.05);
 assert.ok(m.t>14);assert.ok(m.front.some((x,i)=>x!==start[i]));
 assert.ok(m.units.some(u=>u.x!==110&&u.x!==612));
});
test('mission resolution changes campaign and produces detailed performance report',()=>{
 const c=createCampaign(),m=createMission(c);m.t=MISSION_SECONDS;
 const r=endMission(m,c);assert.ok(['victory','defeat','stalemate'].includes(r.outcome));
 assert.equal(c.day,2);assert.ok(r.notes.length>=3);assert.ok(c.credits>130);
 assert.deepEqual(endMission(m,c),r);assert.equal(c.day,2);
});
test('save validation reconstructs an upgrade-compatible campaign',()=>{
 const c=createCampaign();c.upgrades.guns=99;c.credits=-3;c.day=4;const restored=safeCampaign(JSON.parse(JSON.stringify(c)));
 assert.equal(restored.upgrades.guns,UPGRADES.guns.max);assert.equal(restored.credits,0);assert.equal(restored.day,4);
 assert.equal(safeCampaign(null).day,1);
});

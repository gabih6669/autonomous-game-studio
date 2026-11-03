import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const root=new URL('../',import.meta.url);
function fakeElement(id){const listeners={};return {id,style:{},className:'',classList:{add(){},remove(){}},textContent:'',innerHTML:'',disabled:false,children:[],
  addEventListener(name,fn){listeners[name]=fn},onclick:null,append(child){this.children.push(child)},getBoundingClientRect(){return{left:0,top:0,width:960,height:600}},
  getContext(){return context2d},emit(name,e){listeners[name]?.(e)},setAttribute(){}};}
const context2d=new Proxy({imageSmoothingEnabled:false},{get(o,k){return k in o?o[k]:()=>{}},set(o,k,v){o[k]=v;return true}});
test('first mission starts and can fire from war-room UI without browser runtime errors',()=>{
  const ids=new Map();const el=id=>{if(!ids.has(id))ids.set(id,fakeElement(id));return ids.get(id)};
  const doc={getElementById:el,createElement:id=>fakeElement(id),addEventListener(){},hidden:false};
  const localStorage={store:new Map(),getItem(k){return this.store.get(k)||null},setItem(k,v){this.store.set(k,v)}};
  const frames=[];
  const source=readFileSync(new URL('../src/sim.js',import.meta.url),'utf8').replace(/\bexport /g,'')+'\n'+readFileSync(new URL('../src/main.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/,'')+'\nglobalThis.__state=()=>({campaign,mission,phase,target});';
  const env={document:doc,window:{addEventListener(){},confirm(){return true}},localStorage,performance:{now:()=>1},requestAnimationFrame(fn){frames.push(fn)},Math,Date,Number,JSON,console,setTimeout(){},clearTimeout(){}};
  runInNewContext(source,env,{timeout:3000});
  assert.equal(env.__state().phase,'intro');
  assert.equal(el('overlayTitle').textContent,'THE LAST LIGHT');
  el('overlayAction').onclick();
  assert.equal(env.__state().phase,'playing');
  el('battlefield').emit('pointerdown',{clientX:700,clientY:300,button:0});
  assert.ok(el('fireBtn').disabled===false);
  assert.equal(env.__state().target.x,700);
  const ammo=env.__state().mission.ammo.he;
  el('fireBtn').onclick();
  assert.equal(env.__state().mission.ammo.he,ammo-1);
  assert.equal(env.__state().mission.shots.length,1);
  assert.ok(localStorage.getItem('last-light-save-v1'));
});

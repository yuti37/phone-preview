const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'../../index.html'),'utf8');
const NIGHT='after-work-drinks-shownu-v1';
// Entire production scripts, including startup, real route locks, all handlers and
// event replay. Only browser surfaces, storage and wall timers are simulated.
function game(snapshot={}){
 let now=new Date(2026,9,27,12).getTime(),seq=0;
 const storage=new Map(snapshot.local||[]),session=new Map(snapshot.session||[]),nodes=new Map(),timers=new Map();
 const store=data=>({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)});
 function node(key){if(nodes.has(key))return nodes.get(key);const classes=new Set(),listeners=new Map();const n={id:key.replace(/^#/,''),innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,dataset:{},style:{setProperty(){},removeProperty(){}},scrollTop:0,scrollHeight:900,clientHeight:500,children:[],classList:{contains:c=>classes.has(c),add:(...c)=>c.forEach(x=>classes.add(x)),remove:(...c)=>c.forEach(x=>classes.delete(x)),toggle(c,force){const on=force??!classes.has(c);on?classes.add(c):classes.delete(c);return on}},addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)},click(){if(this.disabled)return;for(const fn of listeners.get('click')||[])fn({target:this,currentTarget:this,preventDefault(){},stopPropagation(){}})},removeEventListener(){},setAttribute(){},getAttribute(){return null},removeAttribute(){},querySelector:s=>node(key+' '+s),querySelectorAll:()=>[],closest:()=>null,matches:()=>false,appendChild(){},append(){},insertAdjacentHTML(){},replaceChildren(){},remove(){},focus(){},scrollIntoView(){},getBoundingClientRect:()=>({left:0,top:0,width:390,height:844,right:390,bottom:844}),getContext:()=>null,play:()=>Promise.resolve(),pause(){},load(){}};nodes.set(key,n);return n;}
 const document={baseURI:'https://preview.invalid/phone-preview/',querySelector:node,querySelectorAll:()=>[],getElementById:id=>node('#'+id),createElement:tag=>node('new-'+tag+'-'+(++seq)),addEventListener(){},documentElement:node('html'),body:node('body'),head:node('head'),hidden:false};
 const location={href:'https://preview.invalid/phone-preview/',origin:'https://preview.invalid',pathname:'/phone-preview/',search:'',reload(){throw new Error('unexpected reload')}};
 class Clock extends Date{constructor(...a){super(...(a.length?a:[now]))}static now(){return now}}
 const setTimeout=(f,delay=0)=>{const id=++seq;timers.set(id,{f,at:now+Math.max(0,Number(delay)||0),interval:0});return id};
 const c=vm.createContext({console,Date:Clock,Math,URL,URLSearchParams,document,location,navigator:{userAgent:'isolated-test',clipboard:{writeText:async()=>{}}},localStorage:store(storage),sessionStorage:store(session),setTimeout,clearTimeout:id=>timers.delete(id),setInterval:(f,delay)=>{const id=setTimeout(f,delay);timers.get(id).interval=delay;return id},clearInterval:id=>timers.delete(id),requestAnimationFrame:f=>setTimeout(f,16),cancelAnimationFrame:id=>timers.delete(id),getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',getPropertyValue:()=>''}),matchMedia:()=>({matches:false,addEventListener(){}}),innerWidth:390,innerHeight:844,addEventListener(){},removeEventListener(){},scrollTo(){},performance:{now:()=>now},Image:function(){return node('image-'+(++seq))}});
 c.window=c;c.window.window=c;c.window.self=c;
 for(const script of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(script[1],c,{timeout:5000});
 const run=code=>vm.runInContext(code,c,{timeout:5000});
 function start(){assert.equal(run('initializeGameOnce()'),true,node('#launch-status').textContent);run('phoneUnlocked=true');}
 function advance(ms){const until=now+ms;let guard=0;while(true){const next=[...timers].filter(([,t])=>t.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++guard<10000,'timer loop');now=next[1].at;timers.delete(next[0]);if(next[1].interval)timers.set(next[0],{...next[1],at:now+next[1].interval});next[1].f()}now=until;}
 const state=()=>run('drinkingNightState()');
 function select(id){return run(`drinkingNightSelect('${NIGHT}:interactive:'+drinkingNightState().stage,${JSON.stringify(id)})`)}
 return {run,node,start,advance,jump(ms){now+=ms;for(const timer of timers.values())timer.at=Math.max(now,timer.at)},state,select,story:()=>run('lostPhoneStory'),events:()=>run('gameEventMemory.events'),notifications:()=>run('gameEventMemory.notifications'),messages:()=>run("CONFIG.chats.find(c=>c.id==='shownu').messages"),snapshot:()=>({local:Array.from(storage),session:Array.from(session)}),open(){run("showScreen('app-kakao');openChat('shownu')")}};
}

module.exports={game};

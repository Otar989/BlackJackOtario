'use client';
import React,{useState,useEffect} from 'react';
import Card from './Card';
import LB   from './Leaderboard';
import {apiAuth,apiMe,apiBonus,apiLeaderboard,apiUpdateCoins} from '../utils/api';

/* helpers */
const SUITS=['♠','♥','♦','♣'], RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const newDeck =()=>SUITS.flatMap(s=>RANKS.map(r=>({rank:r,suit:s})));
const shuffle=d=>{const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const val=r=>r==='A'?11:(['K','Q','J'].includes(r)?10:Number(r));
const calc=c=>{let t=0,a=0;for(const x of c){t+=val(x.rank);if(x.rank==='A')a++;}while(t>21&&a){t-=10;a--;}return t;};

export default function Game(){
  const [token,setToken]=useState(null);
  const [user,setUser]=useState(null);
  const [lb,setLb]=useState([]);

  const [login,setLogin]=useState('');
  const [bet,setBet]=useState('');
  const [deck,setDeck]=useState([]); const [pl,setPl]=useState([]); const [dl,setDl]=useState([]);
  const [hide,setHide]=useState(true); const [state,setState]=useState('idle'); const [msg,setMsg]=useState('');

  /* login flow */
  const doLogin=async()=>{
    const auth=await apiAuth(login.trim());
    if(auth.token){ localStorage.setItem('jwt',auth.token); setToken(auth.token); setUser(auth.user); }
  };

  useEffect(()=>{ (async()=>{
    const t=localStorage.getItem('jwt'); if(!t) return;
    setToken(t); setUser(await apiMe(t)); setLb(await apiLeaderboard(10));
  })(); },[]);

  /* game flow */
  const start=()=>{
    const b=Number(bet); if(!b){setMsg('Ставка?');return;} if(b>user.coins){setMsg('Нет монет');return;}
    const d=shuffle(newDeck()); setPl([d.pop(),d.pop()]); setDl([d.pop(),d.pop()]);
    setDeck(d); setHide(true); setState('play'); setMsg('');
  };
  const draw=()=>{const d=[...deck];const c=d.pop();setDeck(d);return c;};
  const finish=async(delta,text)=>{
    setHide(false); setState('done'); setMsg(text);
    await apiUpdateCoins(token,delta); setUser(await apiMe(token)); setLb(await apiLeaderboard(10));
  };
  const hit =()=>{const p=[...pl,draw()]; setPl(p); if(calc(p)>21)finish(-Number(bet),'Перебор');};
  const deal=()=>{let l=[...dl],d=[...deck];while(calc(l)<17)l.push(d.pop()); return{l,d};};
  const stand=()=>{const {l,d}=deal(); setDl(l); setDeck(d); setHide(false);
    const ps=calc(pl),ds=calc(l),b=Number(bet); if(ds>21||ps>ds)finish(b,'Вы выиграли'); else if(ps<ds)finish(-b,'Вы проиграли'); else finish(0,'Ничья');
  };
  const dbl =()=>{const b=Number(bet); if(b*2>user.coins){setMsg('Нет монет');return;} setBet(String(b*2)); const p=[...pl,draw()]; setPl(p);
    if(calc(p)>21) { finish(-b*2,'Перебор'); return; }
    const {l,d}=deal(); setDl(l); setDeck(d);
    const ps=calc(p),ds=calc(l); if(ds>21||ps>ds)finish(b*2,'Вы выиграли'); else if(ps<ds)finish(-b*2,'Вы проиграли'); else finish(0,'Ничья');
  };
  const surrender=()=>finish(-Math.ceil(Number(bet)/2),'Сдались');
  const again=()=>{setState('idle');setPl([]);setDl([]);setHide(true);setMsg('');};

  const coins=user?.coins??0, pScore=calc(pl), dScore=hide?val(dl[0]?.rank??'0'):calc(dl);

  /* render */
  if(!token) return (
    <div style={{maxWidth:420,margin:'40px auto',color:'#fff',textAlign:'center'}}>
      <h2>Введите ник-нейм</h2>
      <input value={login} onChange={e=>setLogin(e.target.value)}
             style={{padding:8,width:'100%',borderRadius:6}}/>
      <button style={{marginTop:12,padding:'8px 16px'}} onClick={doLogin}>Войти</button>
    </div>
  );

  return (
  <div style={{maxWidth:420,margin:'0 auto',padding:16,color:'#fff'}}>
    <h1 style={{textAlign:'center'}}>Блэкджек</h1>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div>💰 {coins}</div>
      <button disabled={Date.now()-new Date(user.last_bonus||0).getTime()<86_400_000}
              onClick={async()=>{const r=await apiBonus(token);setMsg(r.awarded?'+100 !':'уже было');setUser(r.user);}}>
        +Бонус
      </button>
    </div>

    <h3 style={{textAlign:'center',marginTop:16}}>Дилер ({dScore})</h3>
    <div style={{display:'flex',justifyContent:'center'}}>{dl.map((c,i)=><Card key={i} card={c} hidden={hide&&i===1}/>)}</div>

    <h3 style={{textAlign:'center',marginTop:16}}>Вы ({user.username}) ({pScore})</h3>
    <div style={{display:'flex',justifyContent:'center'}}>{pl.map((c,i)=><Card key={i} card={c}/>)}</div>

    <div style={{textAlign:'center',minHeight:24,margin:'12px 0'}}>{msg}</div>

    {state==='idle'&&<>
      <input type="number" value={bet} onChange={e=>setBet(e.target.value)}
             style={{width:'100%',padding:8,borderRadius:6}} placeholder="Ставка"/>
      <button style={{width:'100%',marginTop:8,padding:8}} onClick={start}>Старт</button>
    </>}

    {state==='play'&&<>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8}}>
        <button onClick={hit}>Ещё</button><button onClick={stand}>Стоп</button>
        <button onClick={dbl}>Удвоить</button><button onClick={surrender}>Сдаться</button>
      </div>
    </>}

    {state==='done'&&<>
      <input type="number" value={bet} onChange={e=>setBet(e.target.value)}
             style={{width:'100%',padding:8,borderRadius:6}}/>
      <button style={{width:'100%',marginTop:8,padding:8}} onClick={again}>Снова</button>
    </>}

    <LB leaderboard={lb} me={user.username}/>
  </div>);
}

// frontend/components/Game.js
'use client';

import React, { useState, useEffect } from 'react';
import Card        from './Card';
import Leaderboard from './Leaderboard';
import {
  apiMe,
  apiBonus,
  apiLeaderboard,
  apiUpdateCoins,
} from '../utils/api';

/* ---------- карты ---------- */
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck  = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank:r, suit:s });
  return deck;
}
function shuffle(a){const d=[...a];for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function val(r){return r==='A'?11:['K','Q','J'].includes(r)?10:parseInt(r,10);}
function score(cs){let t=0,a=0;for(const c of cs){t+=val(c.rank);if(c.rank==='A')a++;}while(t>21&&a){t-=10;a--;}return t;}
/* -------------------------------- */

export default function Game({ auth, onLogout }) {
  /* ------- auth state ------- */
  const [token,setToken] = useState(auth?.token || null);
  const [user ,setUser ] = useState(auth?.user  || null);

  /* ------- game state ------- */
  const [bet ,setBet ] = useState(localStorage.getItem('last_bet')||'');
  const [deck,setDeck] = useState([]);
  const [pl  ,setPl  ] = useState([]);   // player cards
  const [dl  ,setDl  ] = useState([]);   // dealer cards
  const [hide,setHide] = useState(true); // hide dealer second card
  const [st  ,setSt  ] = useState('idle'); // idle | playing | finished
  const [msg ,setMsg ] = useState('');

  const [lb  ,setLb  ] = useState([]);

  /* ------- initial load ------- */
  useEffect(()=>{
    (async()=>{
      if(token) {
        try { const me=await apiMe(token); setUser(me); }
        catch{ onLogout(); return; }
      }
      const top = await apiLeaderboard(10);
      setLb(top);
    })();
  },[token]);

  /* ------- helpers ------- */
  const bonusReady = () =>
    !user?.last_bonus || Date.now()-new Date(user.last_bonus).getTime() >= 86_400_000;

  async function refresh() {
    if(!token) return;
    const me = await apiMe(token);
    setUser(me);
    setLb(await apiLeaderboard(10));
  }

  /* ------- bonus ------- */
  async function claimBonus(){
    if(!token) return;
    const r = await apiBonus(token);
    setMsg(r.awarded ? '🎁 Бонус начислен!' : 'Бонус уже получен сегодня.');
    await refresh();
  }

  /* ------- game flow ------- */
  function start(auto=false){
    const b=parseInt(bet,10);
    if(!b||b<=0){ if(!auto) setMsg('Введите ставку'); return; }
    if(b > (user?.coins??0)){ if(!auto) setMsg('Недостаточно монет'); return; }

    localStorage.setItem('last_bet',String(b));

    const d = shuffle(createDeck());
    setPl([d.pop(),d.pop()]);
    setDl([d.pop(),d.pop()]);
    setDeck(d); setHide(true); setSt('playing'); setMsg('');
  }

  function draw(){const d=[...deck];const c=d.pop();setDeck(d);return c;}

  async function finish(delta,text){
    setHide(false); setSt('finished'); setMsg(text);
    if(token) await apiUpdateCoins(token,delta);
    await refresh();
  }

  const hit = ()=>{
    if(st!=='playing')return;
    const p=[...pl,draw()]; setPl(p);
    if(score(p)>21) finish(-parseInt(bet,10),'Перебор! Вы проиграли.');
  };

  const dealerPlay=(d,dk)=>{const l=[...d],dd=[...dk];while(score(l)<17)l.push(dd.pop());return{l,dd};};

  const stand = ()=>{
    if(st!=='playing')return;
    const {l,dd}=dealerPlay(dl,deck); setDl(l); setDeck(dd); setHide(false);
    const pS=score(pl),dS=score(l),w=parseInt(bet,10);
    if(dS>21       ) finish( w,'У дилера перебор! Вы выиграли.');
    else if(pS>dS  ) finish( w,'Вы выиграли!');
    else if(pS<dS  ) finish(-w,'Вы проиграли.');
    else             finish( 0,'Ничья.');
  };

  const dbl = ()=>{
    if(st!=='playing')return;
    const w=parseInt(bet,10);
    if(w*2 > (user?.coins??0)){ setMsg('Недостаточно монет для удвоения.'); return; }
    setBet(String(w*2)); localStorage.setItem('last_bet',String(w*2));
    const p=[...pl,draw()]; setPl(p);
    if(score(p)>21){ finish(-w*2,'Перебор! Вы проиграли.'); return; }
    const {l,dd}=dealerPlay(dl,deck); setDl(l); setDeck(dd);
    const pS=score(p),dS=score(l);
    if(dS>21||pS>dS) finish( w*2,'Вы выиграли!');
    else if(pS<dS)   finish(-w*2,'Вы проиграли.');
    else             finish( 0  ,'Ничья.');
  };

  const surrender=()=>{ if(st==='playing') finish(-Math.ceil(parseInt(bet,10)/2),'Вы сдались.'); };

  const again=()=>{ setSt('idle'); setPl([]); setDl([]); setHide(true); setMsg(''); };

  /* ------- render ------- */
  const coins = user?.coins ?? 0;
  const pS    = score(pl);
  const dS    = hide && dl.length ? val(dl[0].rank) : score(dl);

  return (
    <div className="container">
      <div className="header">
        <h1>Блэкджек</h1>
        <div className="coins">
          💰 {coins}
          <button className="bonus-btn" onClick={claimBonus} disabled={!bonusReady()}>
            {bonusReady()?'+ Бонус':'Бонус ✓'}
          </button>
        </div>
      </div>

      <h3 className="label">Дилер ({dS})</h3>
      <div className="hand">{dl.map((c,i)=><div key={i} style={{marginRight:8}}><Card card={c} hidden={hide&&i===1}/></div>)}</div>

      <h3 className="label">Вы ({user?.username}) ({pS})</h3>
      <div className="hand">{pl.map((c,i)=><div key={i} style={{marginRight:8}}><Card card={c}/></div>)}</div>

      <div className="message">{msg}</div>

      {st==='idle'&&<>
        <input className="bet-input" type="number" min="1" value={bet} onChange={e=>setBet(e.target.value)} placeholder="Введите ставку"/>
        <button className="btn" onClick={()=>start(false)} style={{marginTop:12}}>Начать игру</button>
      </>}

      {st==='playing'&&<div className="controls">
        <button className="btn" onClick={hit}>Ещё</button>
        <button className="btn" onClick={stand}>Стоп</button>
        <button className="btn" onClick={dbl}>Удвоить</button>
        <button className="btn" onClick={surrender}>Сдаться</button>
      </div>}

      {st==='finished'&&<>
        <input className="bet-input" type="number" min="1" value={bet} onChange={e=>setBet(e.target.value)}/>
        <button className="btn" onClick={again} style={{marginTop:12}}>Играть снова</button>
      </>}

      <Leaderboard leaderboard={lb} meUsername={user?.username}/>
      <style jsx>{`
        .container{max-width:420px;margin:0 auto;padding:16px;color:#fff}
        .header{display:flex;justify-content:space-between;align-items:center}
        .coins{display:flex;align-items:center;gap:8px}
        .bonus-btn{background:#264653;color:#fff;border:none;border-radius:6px;padding:4px 8px}
        .hand{display:flex;justify-content:center;margin-top:12px}
        .message{text-align:center;min-height:24px;margin:12px 0}
        .bet-input{width:100%;padding:8px 10px;background:#1a2333;border:1px solid #2a3242;color:#fff;border-radius:6px}
        .controls{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}
        .btn{background:#345bda;color:#fff;border:none;border-radius:6px;padding:8px 0}
        .label{text-align:center;margin-top:16px;color:#9aa4b2}
      `}</style>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import Card from './Card';
import Leaderboard from './Leaderboard';
import {
  apiAuth,
  apiMe,
  apiBonus,
  apiLeaderboard,
  apiUpdateCoins,
} from '../utils/api';

/* ---------- утилиты ---------- */
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck  = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  return deck;
}
function shuffleDeck(d){const a=[...d];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function value(r){if(r==='A')return 11;if(['K','Q','J'].includes(r))return 10;return +r;}
function score(cards){let t=0,a=0;for(const c of cards){t+=value(c.rank);if(c.rank==='A')a++;}while(t>21&&a>0){t-=10;a--;}return t;}
/* ----------------------------- */

export default function Game() {
  const [token,setToken]=useState(null);
  const [user,setUser]  =useState(null);
  const [lb  ,setLb]    =useState([]);

  const [bet,setBet]=useState('');
  const [deck,setDeck]=useState([]);
  const [pCards,setPC]=useState([]);
  const [dCards,setDC]=useState([]);
  const [dHidden,setDH]=useState(true);
  const [state,setSt]=useState('idle');       // idle | playing | finished
  const [msg,setMsg]=useState('');
  const [editBet,setEditBet]=useState(true);  // показать/скрыть поле ввода ставки

  /* ---------- авторизация ---------- */
  useEffect(()=>{(async()=>{
    const tg=typeof window!=='undefined'?window.Telegram?.WebApp:null;
    const initData=tg?.initData||'';
    if(!initData){
      const fakeId=Number(localStorage.getItem('dev_tid'))||Date.now();
      localStorage.setItem('dev_tid',fakeId);
    }
    const lastBet=localStorage.getItem('last_bet');
    if(lastBet)setBet(lastBet);

    const auth=await apiAuth(initData);
    if(auth?.token){
      localStorage.setItem('jwt',auth.token);
      setToken(auth.token);
      setUser(auth.user);
    }
    const top=await apiLeaderboard(10); setLb(top||[]);
  })();},[]);

  const refreshMe=async()=>{
    const t=token||localStorage.getItem('jwt'); if(!t)return;
    const me=await apiMe(t); if(!me.error) setUser(me);
  };

  /* ---------- бонус ---------- */
  const canBonus=()=>!user?.last_bonus||Date.now()-new Date(user.last_bonus)>=864e5;
  const claimBonus=async()=>{
    const t=token||localStorage.getItem('jwt'); if(!t)return;
    const r=await apiBonus(t);
    if(r.awarded){setUser(r.user);setMsg('🎁 Бонус начислен!');}
    else setMsg('Бонус уже получен сегодня.');
  };

  /* ---------- игра ---------- */
  function startGame(){
    const a=+bet;
    if(!a||a<=0){setMsg('Введите ставку');return;}
    if(!user||a>user.coins){setMsg('Недостаточно монет');return;}
    localStorage.setItem('last_bet',bet);
    setEditBet(false);

    const d=shuffleDeck(createDeck());
    setDeck(d);
    setPC([d.pop(),d.pop()]);
    setDC([d.pop(),d.pop()]);
    setDH(true); setMsg(''); setSt('playing');
  }
  function draw(){const nd=[...deck];const c=nd.pop();setDeck(nd);return c;}
  async function changeCoins(delta){const t=token||localStorage.getItem('jwt'); if(!t)return;const r=await apiUpdateCoins(t,delta);if(r.user)setUser(r.user);}
  function end(delta,text){setSt('finished');setDH(false);setMsg(text);changeCoins(delta).then(async()=>{await refreshMe();setLb(await apiLeaderboard(10)||[]);});}

  /* --- действия игрока --- */
  const hit=()=>{if(state!=='playing')return;const c=draw();const np=[...pCards,c];setPC(np);if(score(np)>21)end(-bet,'Перебор! Вы проиграли.');};
  const dealerPlay=(dc,dk)=>{let d=[...dc],k=[...dk];while(score(d)<17)d.push(k.pop());return [d,k];};
  const stand=()=>{if(state!=='playing')return;const [d,k]=dealerPlay(dCards,deck);setDC(d);setDeck(k);setDH(false);
    const ps=score(pCards),ds=score(d),w=+bet;let dlt=0,t='';if(ds>21){t='У дилера перебор! Вы выиграли.';dlt=w;}
    else if(ps>ds){t='Вы выиграли!';dlt=w;}else if(ps<ds){t='Вы проиграли.';dlt=-w;}else{t='Ничья.';}end(dlt,t);}
  const dbl=()=>{if(state!=='playing')return;const cur=+bet;if(cur*2>user.coins){setMsg('Недостаточно монет для удвоения.');return;}setBet(String(cur*2));
    const c=draw();const np=[...pCards,c];setPC(np);
    if(score(np)>21){end(-cur*2,'Перебор! Вы проиграли.');return;}
    const [d,k]=dealerPlay(dCards,deck);setDC(d);setDeck(k);
    const ps=score(np),ds=score(d);let dlt=0,t='';if(ds>21||ps>ds){t='Вы выиграли!';dlt=cur*2;}else if(ps<ds){t='Вы проиграли.';dlt=-cur*2;}else{t='Ничья.';}end(dlt,t);};
  const surrender=()=>{if(state!=='playing')return;end(-Math.ceil(+bet/2),'Вы сдались.');};

  /* --- новый раунд --- */
  const again=()=>{setSt('idle');setPC([]);setDC([]);setDH(true);setMsg('');setEditBet(true);};

  /* ---------- UI ---------- */
  const coins=user?.coins??0, pScore=score(pCards), dScore=score(dCards), dShow=dHidden&&dCards[0]?value(dCards[0].rank):dScore;

  return(
    <div className="wrap">
      <header><h1>Блэкджек</h1>
        <div className="bank">💰 {coins}
          <button onClick={claimBonus} disabled={!canBonus()}>{canBonus()?'+ Бонус':'Бонус ✓'}</button>
        </div>
      </header>

      <h3 className="label">Дилер ({dShow})</h3>
      <div className="hand">{dCards.map((c,i)=><Card key={i} card={c} hidden={dHidden&&i===1}/> )}</div>

      <h3 className="label">Вы ({user?.username||'–'}) ({pScore})</h3>
      <div className="hand">{pCards.map((c,i)=><Card key={i} card={c}/> )}</div>

      <p className="msg">{msg}</p>

      {state==='idle'&&editBet&&(
        <>
          <input className="bet" type="number" value={bet} onChange={e=>setBet(e.target.value)} placeholder="Ставка"/> 
          <button className="btn main" onClick={startGame}>Начать игру</button>
        </>
      )}

      {state==='playing'&&(
        <div className="grid">
          <button className="btn" onClick={hit}>Ещё</button>
          <button className="btn" onClick={stand}>Стоп</button>
          <button className="btn" onClick={dbl}>Удвоить</button>
          <button className="btn" onClick={surrender}>Сдаться</button>
        </div>
      )}

      {state==='finished'&&(
        <div className="grid">
          <button className="btn main" onClick={startGame}>Той же ставкой</button>
          <button className="btn" onClick={again}>Новая ставка</button>
        </div>
      )}

      <Leaderboard leaderboard={lb} meId={user?.telegram_id}/>

      <style jsx>{`
        .wrap{max-width:420px;margin:0 auto;padding:16px;color:#fff}
        header{display:flex;justify-content:space-between;align-items:center}
        .bank{display:flex;gap:8px;align-items:center}
        .bank button{background:#264653;color:#fff;border:none;border-radius:6px;padding:4px 8px}
        .hand{display:flex;justify-content:center;gap:8px;margin-top:12px}
        .label{text-align:center;margin-top:16px;color:#9aa4b2}
        .msg{text-align:center;min-height:24px;margin:12px 0}
        .bet{width:100%;padding:8px 10px;background:#1a2333;border:1px solid #2a3242;color:#fff;border-radius:6px}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:12px}
        .btn{background:#345bda;border:none;border-radius:6px;padding:8px 0;color:#fff}
        .btn.main{grid-column:1/3}
      `}</style>
    </div>
  );
}

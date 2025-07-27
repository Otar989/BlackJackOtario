// frontend/components/Game.js
'use client';

import React, { useState, useEffect } from 'react';
import Card        from './Card';
import Leaderboard from './Leaderboard';
import {
  apiAuth, apiMe, apiBonus,
  apiUpdateCoins, apiLeaderboard
} from '../utils/api';

/* ───── helpers for blackjack ───── */
function deck() {
  const s = ['♠','♥','♦','♣'], r = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return s.flatMap(suit => r.map(rank => ({ rank, suit })));
}
const shuffle = d => d.sort(()=>Math.random()-0.5);
const val = r => r==='A'?11:['K','Q','J'].includes(r)?10:+r;
const score = cards => {
  let t = 0, aces = 0;
  for (const c of cards) { t+=val(c.rank); if (c.rank==='A') aces++; }
  while (t>21 && aces--) t-=10;
  return t;
};
/* ──────────────────────────────── */

export default function Game() {
  /* ─ state ─ */
  const [token, setToken] = useState(null);
  const [user , setUser ] = useState(null);
  const [lb   , setLb   ] = useState([]);

  const [bet , setBet ] = useState('');
  const [dck , setDck ] = useState([]);
  const [pl  , setPl  ] = useState([]);
  const [dl  , setDl  ] = useState([]);
  const [hide, setHide] = useState(true);
  const [st  , setSt  ] = useState('idle');          // idle | playing | finished
  const [msg , setMsg ] = useState('');

  /* ─ first load ─ */
  useEffect(() => {
    (async () => {
      const savedName = localStorage.getItem('username') || prompt('Введите логин');
      if (!savedName) return;

      localStorage.setItem('username', savedName);
      const auth = await apiAuth({ username:savedName });
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      }
      setLb(await apiLeaderboard(10));
    })();
  }, []);

  const refresh = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const me = await apiMe(t);
    if (!me.error) setUser(me);
  };

  /* ─ bonus ─ */
  const readyBonus = () =>
    !user?.last_bonus || Date.now()-new Date(user.last_bonus).getTime() >= 86_400_000;

  const claim = async () => {
    const t = token || localStorage.getItem('jwt'); if (!t) return;
    const r = await apiBonus(t);
    r.awarded ? setMsg('🎁 Бонус!') : setMsg('Бонус уже получен');
    setUser(r.user);
  };

  /* ─ game flow ─ */
  const begin = () => {
    const w = +bet;
    if (!w)           return setMsg('Введите ставку');
    if (w > (user?.coins??0)) return setMsg('Недостаточно монет');

    const dk = shuffle(deck());
    setPl([dk.pop(), dk.pop()]);
    setDl([dk.pop(), dk.pop()]);
    setDck(dk); setHide(true); setSt('playing'); setMsg('');
  };

  const draw = () => { const dk=[...dck]; const c=dk.pop(); setDck(dk); return c; };

  const finish = async (delta, text) => {
    setHide(false); setSt('finished'); setMsg(text);
    const t = token || localStorage.getItem('jwt');
    if (t) await apiUpdateCoins(t, delta);
    await refresh(); setLb(await apiLeaderboard(10));
  };

  const hit = () => {
    if (st!=='playing') return;
    const p=[...pl, draw()]; setPl(p);
    if (score(p)>21) finish(-+bet, 'Перебор! Вы проиграли.');
  };

  const dealer = (d,dk) => { const l=[...d], dd=[...dk]; while(score(l)<17) l.push(dd.pop()); return {l,dd}; };

  const stand = () => {
    if (st!=='playing') return;
    const {l,dd}=dealer(dl,dck); setDl(l); setDck(dd); setHide(false);
    const ps=score(pl), ds=score(l), w=+bet;
    if (ds>21||ps>ds) finish( w,'Вы выиграли!');
    else if (ps<ds )  finish(-w,'Вы проиграли.');
    else              finish( 0,'Ничья.');
  };

  const dbl = () => {
    if (st!=='playing') return;
    const w=+bet; if (w*2>(user?.coins??0)) return setMsg('Недостаточно монет');
    setBet(String(w*2));
    const p=[...pl, draw()]; setPl(p);
    if (score(p)>21) return finish(-w*2,'Перебор! Вы проиграли.');
    const {l,dd}=dealer(dl,dck); setDl(l); setDck(dd);
    const ps=score(p), ds=score(l);
    if (ds>21||ps>ds) finish( w*2,'Вы выиграли!');
    else if (ps<ds )  finish(-w*2,'Вы проиграли.');
    else              finish( 0  ,'Ничья.');
  };

  const surrender = () => st==='playing' && finish(-Math.ceil(+bet/2),'Вы сдались.');

  const again = () => { setSt('idle'); setPl([]); setDl([]); setHide(true); setMsg(''); };

  /* ─ render ─ */
  const coins=user?.coins??0, ps=score(pl), ds=hide?val(dl[0]?.rank||'0'):score(dl);

  return (
    <div className="container">
      <div className="header">
        <h1>Блэкджек</h1>
        <div className="coins">💰 {coins}
          <button className="bonus-btn" onClick={claim} disabled={!readyBonus()}>
            {readyBonus()?'+ Бонус':'Бонус ✓'}
          </button>
        </div>
      </div>

      <h3 className="label">Дилер ({ds})</h3>
      <div className="hand">{dl.map((c,i)=><div key={i} style={{marginRight:8}}><Card card={c} hidden={hide&&i===1}/></div>)}</div>

      <h3 className="label">Вы ({user?.username||'...'}) ({ps})</h3>
      <div className="hand">{pl.map((c,i)=><div key={i} style={{marginRight:8}}><Card card={c}/></div>)}</div>

      <div className="message">{msg}</div>

      {st==='idle' && <>
        <input type="number" className="bet-input" value={bet} onChange={e=>setBet(e.target.value)} placeholder="Ставка" min="1"/>
        <button className="btn" onClick={begin} style={{marginTop:12}}>Начать игру</button>
      </>}

      {st==='playing' && <div className="controls">
        <button className="btn" onClick={hit}>Ещё</button>
        <button className="btn" onClick={stand}>Стоп</button>
        <button className="btn" onClick={dbl}>Удвоить</button>
        <button className="btn" onClick={surrender}>Сдаться</button>
      </div>}

      {st==='finished' && <>
        <input type="number" className="bet-input" value={bet} onChange={e=>setBet(e.target.value)} min="1"/>
        <button className="btn" onClick={again} style={{marginTop:12}}>Играть снова</button>
      </>}

      <Leaderboard leaderboard={lb} meId={user?.username}/>
      {/* ⬇ минимальные стили внутри компонента */}
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

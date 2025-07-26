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

/* ----- blackjack helpers ----- */
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  return deck;
}
function shuffleDeck(deck) {
  const a = [...deck];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getCardValue(r) {
  if (r === 'A') return 11;
  if (['K','Q','J'].includes(r)) return 10;
  return parseInt(r, 10);
}
function calcScore(cards) {
  let total = 0, aces = 0;
  for (const c of cards) {
    total += getCardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces) { total -= 10; aces--; }
  return total;
}
/* -------------------------------- */

export default function Game() {
  const [token, setToken] = useState(null);
  const [user, setUser]   = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);

  const [bet, setBet]                 = useState('');
  const [deck, setDeck]               = useState([]);
  const [player, setPlayer]           = useState([]);
  const [dealer, setDealer]           = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [state, setState]             = useState('idle'); // idle | playing | finished
  const [msg, setMsg]                 = useState('');

  /* --- initial auth + data --- */
  useEffect(() => {
    (async () => {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
      const initData = tg?.initData || '';

      const auth = await apiAuth(initData);
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      }

      const lb = await apiLeaderboard(10);
      setLeaderboard(lb);
    })();
  }, []);

  const refreshUser = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const me = await apiMe(t);
    if (!me.error) setUser(me);
  };

  /* --- bonus --- */
  const canBonus = () => {
    if (!user?.last_bonus) return true;
    return Date.now() - new Date(user.last_bonus).getTime() >= 86_400_000;
  };
  const claimBonus = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const res = await apiBonus(t);
    if (res.awarded) {
      setUser(res.user);
      setMsg('🎁 Бонус начислен!');
    } else setMsg('Бонус уже получен сегодня.');
  };

  /* --- game flow --- */
  const start = () => {
    const amount = parseInt(bet, 10);
    if (!amount || amount <= 0) { setMsg('Введите ставку'); return; }
    if (amount > (user?.coins ?? 0)) { setMsg('Недостаточно монет'); return; }

    localStorage.setItem('last_bet', String(amount));

    const d = shuffleDeck(createDeck());
    setPlayer([d.pop(), d.pop()]);
    setDealer([d.pop(), d.pop()]);
    setDeck(d);
    setDealerHidden(true);
    setState('playing');
    setMsg('');
  };

  const draw = () => {
    const d = [...deck];
    const c = d.pop();
    setDeck(d);
    return c;
  };

  const finish = async (delta, text) => {
    setState('finished');
    setDealerHidden(false);
    setMsg(text);
    const t = token || localStorage.getItem('jwt');
    if (t) await apiUpdateCoins(t, delta);
    await refreshUser();
    setLeaderboard(await apiLeaderboard(10));
  };

  const hit = () => {
    if (state !== 'playing') return;
    const c = draw();
    const p = [...player, c];
    setPlayer(p);
    if (calcScore(p) > 21) finish(-parseInt(bet, 10), 'Перебор! Вы проиграли.');
  };

  const dealerPlay = (d, dk) => {
    const local = [...d];
    const deckLocal = [...dk];
    while (calcScore(local) < 17) local.push(deckLocal.pop());
    return { local, deckLocal };
  };

  const stand = () => {
    if (state !== 'playing') return;
    const { local, deckLocal } = dealerPlay(dealer, deck);
    setDealer(local); setDeck(deckLocal); setDealerHidden(false);

    const p = calcScore(player), o = calcScore(local), w = parseInt(bet, 10);
    if   (o > 21)          finish(w   , 'У дилера перебор! Вы выиграли.');
    else if (p > o)        finish(w   , 'Вы выиграли!');
    else if (p < o)        finish(-w  , 'Вы проиграли.');
    else                   finish(0   , 'Ничья.');
  };

  const dbl = () => {
    if (state !== 'playing') return;
    const w = parseInt(bet, 10);
    if (w * 2 > (user?.coins ?? 0)) { setMsg('Недостаточно монет'); return; }

    const newBet = w * 2;
    setBet(String(newBet)); localStorage.setItem('last_bet', String(newBet));
    const p = [...player, draw()]; setPlayer(p);

    if (calcScore(p) > 21) { finish(-newBet, 'Перебор! Вы проиграли.'); return; }

    const { local, deckLocal } = dealerPlay(dealer, deck);
    setDealer(local); setDeck(deckLocal);

    const ps = calcScore(p), ds = calcScore(local);
    if      (ds > 21) finish(newBet , 'У дилера перебор! Вы выиграли.');
    else if (ps > ds) finish(newBet , 'Вы выиграли!');
    else if (ps < ds) finish(-newBet, 'Вы проиграли.');
    else              finish(0      , 'Ничья.');
  };

  const surrender = () => {
    if (state !== 'playing') return;
    finish(-Math.ceil(parseInt(bet, 10) / 2), 'Вы сдались.');
  };

  const playAgain = () => {
    setState('idle');
    setPlayer([]); setDealer([]); setDealerHidden(true); setMsg('');
  };

  /* --- render --- */
  const coins = user?.coins ?? 0;
  const pScore = calcScore(player);
  const dScore = dealerHidden ? getCardValue(dealer[0]?.rank ?? '0') : calcScore(dealer);

  return (
    <div className="container">
      <div className="header">
        <h1>Блэкджек</h1>
        <div className="coins">
          💰 {coins}
          <button className="bonus-btn" onClick={claimBonus} disabled={!canBonus()}>
            {canBonus() ? '+ Бонус' : 'Бонус ✓'}
          </button>
        </div>
      </div>

      <h3 className="label">Дилер ({dScore})</h3>
      <div className="hand">
        {dealer.map((c,i)=>(
          <div key={i} style={{marginRight:8}}>
            <Card card={c} hidden={dealerHidden && i===1}/>
          </div>
        ))}
      </div>

      <h3 className="label">Вы ({user?.username || '…'}) ({pScore})</h3>
      <div className="hand">
        {player.map((c,i)=>(
          <div key={i} style={{marginRight:8}}><Card card={c}/></div>
        ))}
      </div>

      <div className="message">{msg}</div>

      {state==='idle' && (
        <>
          <input
            type="number"
            className="bet-input"
            value={bet}
            onChange={e=>setBet(e.target.value)}
            placeholder="Введите ставку"
            min="1"
          />
          <button className="btn" onClick={start} style={{marginTop:12}}>Начать игру</button>
        </>
      )}

      {state==='playing' && (
        <div className="controls">
          <button className="btn" onClick={hit}>Ещё</button>
          <button className="btn" onClick={stand}>Стоп</button>
          <button className="btn" onClick={dbl}>Удвоить</button>
          <button className="btn" onClick={surrender}>Сдаться</button>
        </div>
      )}

      {state==='finished' && (
        <>
          <input
            type="number"
            className="bet-input"
            value={bet}
            onChange={e=>setBet(e.target.value)}
            min="1"
          />
          <button className="btn" onClick={playAgain} style={{marginTop:12}}>
            Играть снова
          </button>
        </>
      )}

      <Leaderboard leaderboard={leaderboard} meId={user?.telegram_id}/>

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

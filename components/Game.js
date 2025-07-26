'use client';

import React, { useState, useEffect } from 'react';
import Card        from './Card';
import Leaderboard from './Leaderboard';
import {
  apiVerify,      // ← новое!
  apiMe,
  apiBonus,
  apiLeaderboard,
  apiUpdateCoins,
} from '../utils/api';

/* ---------- утилиты для блэкджека ---------- */
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank:r, suit:s });
  return deck;
}
function shuffleDeck(d) {
  const a=[...d]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;
}
const val = (r)=>r==='A'?11:['K','Q','J'].includes(r)?10:parseInt(r,10);
function score(cards){let t=0,a=0;for(const c of cards){t+=val(c.rank);if(c.rank==='A')a++;}while(t>21&&a){t-=10;a--;}return t;}
/* ------------------------------------------- */

export default function Game() {
  const [token, setToken]           = useState(null);
  const [user,  setUser]            = useState(null);  // {telegram_id, username, coins, last_bonus}
  const [leaderboard,setLeaderboard]= useState([]);

  const [bet, setBet]               = useState('');
  const [deck, setDeck]             = useState([]);
  const [playerCards,setPlayerCards]= useState([]);
  const [dealerCards,setDealerCards]= useState([]);
  const [dealerHidden,setDealerHidden]=useState(true);
  const [state,setState]            = useState('idle'); // idle | playing | finished
  const [msg,setMsg]                = useState('');

  /* ---------- авторизация через /verify ---------- */
  useEffect(() => {
    const init = async () => {
      const tg  = typeof window!=='undefined'?window.Telegram?.WebApp:null;
      if (!tg) return;  // в браузере без Telegram ничего не делаем

      // deep-linked WebApp всегда содержит initData
      const { initData = '' } = tg;
      const res = await apiVerify(initData);
      if (res.error) { console.error(res.error); return; }

      localStorage.setItem('jwt', res.token);
      setToken(res.token);
      setUser(res.user);

      // ставка из localStorage
      const lastBet = localStorage.getItem('last_bet');
      if (lastBet) setBet(lastBet);

      // лидерборд
      const lb = await apiLeaderboard(10);
      setLeaderboard(lb);
    };
    init();
  }, []);

  const refreshUser = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const me = await apiMe(t);
    if (!me.error) setUser(me);
  };

  /* ---------- бонус ---------- */
  const bonusReady = () =>
    !user?.last_bonus ||
    Date.now() - new Date(user.last_bonus).getTime() >= 86_400_000;

  const claimBonus = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const res = await apiBonus(t);
    if (res.awarded) {
      setUser(res.user); setMsg('🎁 Бонус начислен!');
    } else setMsg('Бонус уже получен.');
  };

  /* ---------- старт раздачи ---------- */
  const startGame = () => {
    const amount = parseInt(bet,10);
    if (!amount||amount<=0) { setMsg('Введите корректную ставку'); return; }
    if (!user||amount>user.coins){ setMsg('Недостаточно монет'); return; }

    localStorage.setItem('last_bet', bet);

    const d  = shuffleDeck(createDeck());
    setDeck(d);
    setPlayerCards([d.pop(),d.pop()]);
    setDealerCards([d.pop(),d.pop()]);
    setDealerHidden(true);
    setState('playing');
    setMsg('');
  };

  const draw = () => { const d=[...deck];const c=d.pop();setDeck(d);return c; };

  /* ---------- завершение руки ---------- */
  const finish = async (delta, text) => {
    setState('finished'); setDealerHidden(false); setMsg(text);
    await apiUpdateCoins(token||localStorage.getItem('jwt'), delta);
    await refreshUser();
    setLeaderboard(await apiLeaderboard(10));
  };

  /* ---------- действия игрока ---------- */
  const hit = () => {
    if (state!=='playing') return;
    const card = draw();
    const pc   = [...playerCards,card];
    setPlayerCards(pc);
    if (score(pc)>21) finish(-parseInt(bet,10),'Перебор! Вы проиграли.');
  };

  const stand = () => {
    if (state!=='playing') return;
    let dc=[...dealerCards], d=[...deck];
    while (score(dc)<17) dc.push(d.pop());
    setDealerCards(dc); setDeck(d); setDealerHidden(false);

    const ps=score(playerCards), ds=score(dc), w=parseInt(bet,10);
    if (ds>21)          finish( w,'У дилера перебор! Вы выиграли.');
    else if (ps>ds)     finish( w,'Вы выиграли!');
    else if (ps<ds)     finish(-w,'Вы проиграли.');
    else                finish( 0,'Ничья.');
  };

  const dbl = () => {
    if (state!=='playing') return;
    const cur=parseInt(bet,10);
    if (cur*2>user.coins) { setMsg('Недостаточно монет для удвоения'); return; }
    setBet(String(cur*2)); localStorage.setItem('last_bet', String(cur*2));

    const card=draw(), pc=[...playerCards,card]; setPlayerCards(pc);
    if (score(pc)>21) { finish(-cur*2,'Перебор! Вы проиграли.'); return; }

    let dc=[...dealerCards], d=[...deck];
    while (score(dc)<17) dc.push(d.pop());
    setDealerCards(dc); setDeck(d); setDealerHidden(false);

    const ps=score(pc), ds=score(dc);
    if (ds>21||ps>ds) finish( cur*2,'Вы выиграли!');
    else if (ps<ds)   finish(-cur*2,'Вы проиграли.');
    else              finish( 0,'Ничья.');
  };

  const surrender = () => {
    if (state!=='playing') return;
    const loss=Math.ceil(parseInt(bet,10)/2);
    finish(-loss,'Вы сдались.');
  };

  /* ---------- рендер ---------- */
  const coins = user?.coins ?? 0;
  const pScore = score(playerCards);
  const dScore = dealerHidden ? val(dealerCards[0]?.rank||'') : score(dealerCards);

  return (
    <div className="container">
      <header>
        <h1>Блэкджек</h1>
        <div className="wallet">
          <span>💰 {coins}</span>
          <button onClick={claimBonus} disabled={!bonusReady()}>
            {bonusReady()?'+ Бонус':'Бонус ✓'}
          </button>
        </div>
      </header>

      {/* дилер */}
      <h3 className="label">Дилер ({dScore||'?'})</h3>
      <div className="hand">
        {dealerCards.map((c,i)=>(
          <Card key={i} card={c} hidden={dealerHidden&&i===1}/>
        ))}
      </div>

      {/* игрок */}
      <h3 className="label">Вы ({pScore})</h3>
      <div className="hand">
        {playerCards.map((c,i)=>(
          <Card key={i} card={c}/>
        ))}
      </div>

      <div className="msg">{msg}</div>

      {state==='idle'&&(
        <>
          <input
            type="number"
            value={bet}
            onChange={e=>setBet(e.target.value)}
            placeholder="Ставка"
          />
          <button onClick={startGame}>Начать игру</button>
        </>
      )}

      {state==='playing'&&(
        <div className="controls">
          <button onClick={hit}>Ещё</button>
          <button onClick={stand}>Стоп</button>
          <button onClick={dbl}>Удвоить</button>
          <button onClick={surrender}>Сдаться</button>
        </div>
      )}

      {state==='finished'&&(
        <button onClick={()=>{ setState('idle'); setPlayerCards([]); setDealerCards([]); setMsg(''); }}>
          Играть снова
        </button>
      )}

      <Leaderboard leaderboard={leaderboard} meId={user?.telegram_id}/>
    </div>
  );
}

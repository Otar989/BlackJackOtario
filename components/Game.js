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

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const d = [];
  for (const s of suits) for (const r of ranks) d.push({ rank: r, suit: s });
  return d;
}
function shuffleDeck(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function getCardValue(r) {
  if (r === 'A') return 11;
  if (['K', 'Q', 'J'].includes(r)) return 10;
  return parseInt(r, 10);
}
function calculateScore(cs) {
  let t = 0;
  let a = 0;
  for (const c of cs) {
    t += getCardValue(c.rank);
    if (c.rank === 'A') a++;
  }
  while (t > 21 && a > 0) {
    t -= 10;
    a--;
  }
  return t;
}

export default function Game() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bet, setBet] = useState('');
  const [deck, setDeck] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [gameState, setGameState] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
      tg && tg.ready();
      tg && tg.expand && tg.expand();
      const initData = tg?.initData || '';
      const auth = await apiAuth(
        initData,
        !initData && {
          telegram_id: Number(localStorage.getItem('dev_tid')) || Date.now(),
          username: 'WebUser',
        }
      );
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      }
      const lastBet = localStorage.getItem('last_bet');
      if (lastBet) setBet(lastBet);
      const lb = await apiLeaderboard(10);
      setLeaderboard(lb || []);
    };
    run();
  }, []);

  const refreshUser = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const me = await apiMe(t);
    if (!me.error) setUser(me);
  };

  const canClaimBonus = () =>
    !user?.last_bonus || new Date() - new Date(user.last_bonus) >= 864e5;

  const claimBonus = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const res = await apiBonus(t);
    if (res.awarded) {
      setUser(res.user);
      setMessage('🎁 Бонус начислен!');
    } else {
      setMessage('Бонус уже получен сегодня.');
    }
  };

  function startGame(auto = false) {
    const amount = parseInt(bet, 10);
    if (!amount || amount <= 0) {
      if (!auto) setMessage('Введите корректную ставку');
      return;
    }
    if (!user || amount > user.coins) {
      if (!auto) setMessage('Недостаточно монет');
      return;
    }
    localStorage.setItem('last_bet', String(amount));
    const d = shuffleDeck(createDeck());
    setDeck(d);
    setPlayerCards([d.pop(), d.pop()]);
    setDealerCards([d.pop(), d.pop()]);
    setDealerHidden(true);
    setGameState('playing');
    setMessage('');
  }

  function draw() {
    const d = [...deck];
    const c = d.pop();
    setDeck(d);
    return c;
  }

  async function updateCoins(delta) {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const data = await apiUpdateCoins(t, delta);
    if (data.user) setUser(data.user);
  }

  function endRound(delta, msg) {
    setGameState('finished');
    setDealerHidden(false);
    setMessage(msg);
    updateCoins(delta).then(async () => {
      await refreshUser();
      const lb = await apiLeaderboard(10);
      setLeaderboard(lb || []);
    });
  }

  function handleHit() {
    if (gameState !== 'playing') return;
    const c = draw();
    const p = [...playerCards, c];
    setPlayerCards(p);
    if (calculateScore(p) > 21) endRound(-parseInt(bet, 10), 'Перебор! Вы проиграли.');
  }

  function dealerPlay(dck, dd) {
    let d = [...dck];
    let k = [...dd];
    while (calculateScore(d) < 17) d.push(k.pop());
    return { d, k };
  }

  function handleStand() {
    if (gameState !== 'playing') return;
    const { d, k } = dealerPlay(dealerCards, deck);
    setDealerCards(d);
    setDeck(k);
    setDealerHidden(false);
    const pS = calculateScore(playerCards);
    const dS = calculateScore(d);
    const w = parseInt(bet, 10);
    let delta = 0;
    let msg = '';
    if (dS > 21) {
      msg = 'У дилера перебор! Вы выиграли.';
      delta = w;
    } else if (pS > dS) {
      msg = 'Вы выиграли!';
      delta = w;
    } else if (pS < dS) {
      msg = 'Вы проиграли.';
      delta = -w;
    } else {
      msg = 'Ничья.';
    }
    endRound(delta, msg);
  }

  function handleDouble() {
    if (gameState !== 'playing') return;
    const cur = parseInt(bet, 10);
    if (!user || cur * 2 > user.coins) {
      setMessage('Недостаточно монет для удвоения.');
      return;
    }
    const newBet = cur * 2;
    setBet(String(newBet));
    localStorage.setItem('last_bet', String(newBet));
    const c = draw();
    const p = [...playerCards, c];
    setPlayerCards(p);
    if (calculateScore(p) > 21) {
      endRound(-newBet, 'Перебор! Вы проиграли.');
      return;
    }
    const { d, k } = dealerPlay(dealerCards, deck);
    setDealerCards(d);
    setDeck(k);
    const pS = calculateScore(p);
    const dS = calculateScore(d);
    let delta = 0;
    let msg = '';
    if (dS > 21) {
      msg = 'У дилера перебор! Вы выиграли.';
      delta = newBet;
    } else if (pS > dS) {
      msg = 'Вы выиграли!';
      delta = newBet;
    } else if (pS < dS) {
      msg = 'Вы проиграли.';
      delta = -newBet;
    } else {
      msg = 'Ничья.';
    }
    endRound(delta, msg);
  }

  function handleSurrender() {
    if (gameState !== 'playing') return;
    const w = parseInt(bet, 10);
    endRound(-Math.ceil(w / 2), 'Вы сдались.');
  }

  function playAgain() {
    setGameState('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setMessage('');
    setDealerHidden(true);
    const lastBet = localStorage.getItem('last_bet');
    if (lastBet) {
      setBet(lastBet);
      setTimeout(() => startGame(true), 150);
    }
  }

  const coins = user?.coins ?? 0;
  const pScore = calculateScore(playerCards);
  const dScore = calculateScore(dealerCards);
  const dScoreText =
    dealerHidden && dealerCards.length ? getCardValue(dealerCards[0].rank) : dScore;

  return (
    <div className="container">
      <div className="header">
        <h1>Блэкджек</h1>
        <div className="coins">
          💰 {coins}
          <button className="bonus-btn" onClick={claimBonus} disabled={!canClaimBonus()}>
            {canClaimBonus() ? '+ Бонус' : 'Бонус ✓'}
          </button>
        </div>
      </div>

      <h3 className="label">Дилер ({dScoreText})</h3>
      <div className="hand">
        {dealerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} hidden={dealerHidden && i === 1} />
          </div>
        ))}
      </div>

      <h3 className="label">
        Вы {user ? `(${user.username})` : ''} ({pScore})
      </h3>
      <div className="hand">
        {playerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} />
          </div>
        ))}
      </div>

      <div className="message">{message}</div>

      {gameState === 'idle' && (
        <>
          <input
            type="number"
            className="bet-input"
            placeholder="Введите ставку"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            min="1"
          />
          <button className="btn" style={{ marginTop: 12 }} onClick={() => startGame(false)}>
            Начать игру
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="controls">
          <button className="btn" onClick={handleHit}>
            Ещё
          </button>
          <button className="btn" onClick={handleStand}>
            Стоп
          </button>
          <button className="btn" onClick={handleDouble}>
            Удвоить
          </button>
          <button className="btn" onClick={handleSurrender}>
            Сдаться
          </button>
        </div>
      )}

      {gameState === 'finished' && (
        <button className="btn" style={{ marginTop: 12 }} onClick={playAgain}>
          Играть снова
        </button>
      )}

      <Leaderboard leaderboard={leaderboard} meId={user?.telegram_id} />

      <style jsx>{`
        .container {
          max-width: 420px;
          margin: 0 auto;
          padding: 16px;
          color: #fff;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .coins {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .bonus-btn {
          background: #264653;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
        }
        .hand {
          display: flex;
          justify-content: center;
          margin-top: 12px;
        }
        .message {
          text-align: center;
          min-height: 24px;
          margin: 12px 0;
        }
        .bet-input {
          width: 100%;
          padding: 8px 10px;
          background: #1a2333;
          border: 1px solid #2a3242;
          color: #fff;
          border-radius: 6px;
        }
        .controls {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 12px;
        }
        .btn {
          background: #345bda;
          color: #fff;
          border: none;
          border-radius: 6px;
          padding: 8px 0;
        }
        .label {
          text-align: center;
          margin-top: 16px;
          color: #9aa4b2;
        }
      `}</style>
    </div>
  );
}

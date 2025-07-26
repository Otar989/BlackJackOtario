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
const createDeck = () => {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push({ rank: r, suit: s });
  return deck;
};
const shuffleDeck = (d) => {
  const a = [...d];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const getCardValue = (r) => (r === 'A' ? 11 : ['K', 'Q', 'J'].includes(r) ? 10 : parseInt(r, 10));
const calculateScore = (cards) => {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += getCardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return total;
};
/* -------------------------------- */

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

  /* ---------- авторизация ---------- */
  useEffect(() => {
    (async () => {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;
      const initData = tg?.initData || '';

      if (!initData) {
        const fake = Number(localStorage.getItem('dev_tid')) || Date.now();
        localStorage.setItem('dev_tid', fake);
      }

      const lastBet = localStorage.getItem('last_bet');
      if (lastBet) setBet(lastBet);

      const auth = await apiAuth(initData);          // ← здесь передаём строку
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      }

      setLeaderboard(await apiLeaderboard(10));
    })();
  }, []);

  /* ---------- помощь­ники ---------- */
  const refreshUser = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const me = await apiMe(t);
    if (!me.error) setUser(me);
  };

  const canClaimBonus = () =>
    !user?.last_bonus || new Date() - new Date(user.last_bonus) >= 86400000;

  const claimBonus = async () => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const res = await apiBonus(t);
    if (res.awarded) {
      setUser(res.user);
      setMessage('🎁 Бонус начислен!');
    } else setMessage('Бонус уже получен сегодня.');
  };

  /* ---------- игра ---------- */
  const startGame = (auto = false) => {
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

    const newDeck = shuffleDeck(createDeck());
    setDeck(newDeck);
    setPlayerCards([newDeck.pop(), newDeck.pop()]);
    setDealerCards([newDeck.pop(), newDeck.pop()]);
    setDealerHidden(true);
    setGameState('playing');
    setMessage('');
  };

  const draw = () => {
    const d = [...deck];
    const c = d.pop();
    setDeck(d);
    return c;
  };

  const updateCoins = async (delta) => {
    const t = token || localStorage.getItem('jwt');
    if (!t) return;
    const data = await apiUpdateCoins(t, delta);
    if (data.user) setUser(data.user);
  };

  const finish = (wager, pScore, dScore) => {
    if (dScore > 21) return { delta: wager, msg: 'У дилера перебор! Вы выиграли.' };
    if (pScore > dScore) return { delta: wager, msg: 'Вы выиграли!' };
    if (pScore < dScore) return { delta: -wager, msg: 'Вы проиграли.' };
    return { delta: 0, msg: 'Ничья.' };
  };

  const endRound = async (delta, msg) => {
    setGameState('finished');
    setDealerHidden(false);
    setMessage(msg);
    await updateCoins(delta);
    await refreshUser();
    setLeaderboard(await apiLeaderboard(10));
  };

  const handleHit = () => {
    if (gameState !== 'playing') return;
    const card = draw();
    const pl = [...playerCards, card];
    setPlayerCards(pl);
    if (calculateScore(pl) > 21) endRound(-parseInt(bet, 10), 'Перебор! Вы проиграли.');
  };

  const dealerPlay = (d, deckNow) => {
    const dc = [...d];
    const dk = [...deckNow];
    while (calculateScore(dc) < 17) dc.push(dk.pop());
    return { dc, dk };
  };

  const handleStand = () => {
    if (gameState !== 'playing') return;
    const { dc, dk } = dealerPlay(dealerCards, deck);
    setDealerCards(dc);
    setDeck(dk);
    setDealerHidden(false);

    const wager = parseInt(bet, 10);
    const { delta, msg } = finish(wager, calculateScore(playerCards), calculateScore(dc));
    endRound(delta, msg);
  };

  const handleDouble = () => {
    if (gameState !== 'playing') return;
    const cur = parseInt(bet, 10);
    if (!user || cur * 2 > user.coins) {
      setMessage('Недостаточно монет для удвоения.');
      return;
    }
    const newBet = cur * 2;
    setBet(String(newBet));
    localStorage.setItem('last_bet', String(newBet));

    const card = draw();
    const pl = [...playerCards, card];
    setPlayerCards(pl);

    if (calculateScore(pl) > 21) {
      endRound(-newBet, 'Перебор! Вы проиграли.');
      return;
    }

    const { dc, dk } = dealerPlay(dealerCards, deck);
    setDealerCards(dc);
    setDeck(dk);

    const { delta, msg } = finish(newBet, calculateScore(pl), calculateScore(dc));
    endRound(delta, msg);
  };

  const handleSurrender = () => {
    if (gameState !== 'playing') return;
    endRound(-Math.ceil(parseInt(bet, 10) / 2), 'Вы сдались.');
  };

  const playAgain = () => {
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
  };

  /* ---------- UI ---------- */
  const coins = user?.coins ?? 0;
  const playerScore = calculateScore(playerCards);
  const dealerScore = calculateScore(dealerCards);
  const dealerShown =
    dealerHidden && dealerCards.length ? getCardValue(dealerCards[0].rank) : dealerScore;

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

      <h3 className="label">Дилер ({dealerShown})</h3>
      <div className="hand">
        {dealerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} hidden={dealerHidden && i === 1} />
          </div>
        ))}
      </div>

      <h3 className="label">
        Вы {user ? `(${user.username})` : ''} ({playerScore})
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
          <button className="btn" onClick={() => startGame(false)} style={{ marginTop: 12 }}>
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
        <button className="btn" onClick={playAgain} style={{ marginTop: 12 }}>
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

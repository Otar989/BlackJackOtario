'use client';

import React, { useState, useEffect } from 'react';
import Card from './Card';
import Leaderboard from './Leaderboard';
import {
  API,
  apiAuth,
  apiMe,
  apiBonus,
  apiLeaderboard,
  apiUpdateCoins,
} from '../utils/api';

// ----------------- Блэкджек утилиты -----------------
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
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
function getCardValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}
function calculateScore(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += getCardValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}
// ----------------------------------------------------

export default function Game() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null); // { telegram_id, username, coins, last_bonus }
  const [leaderboard, setLeaderboard] = useState([]);

  const [bet, setBet] = useState('');
  const [deck, setDeck] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [gameState, setGameState] = useState('idle'); // idle | playing | finished
  const [message, setMessage] = useState('');

  // ---------- Авторизация и первичная загрузка ----------
  useEffect(() => {
    const run = async () => {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

      let telegram_id, username;
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        telegram_id = u.id;
        username = u.username || u.first_name || `Player${u.id}`;
      } else {
        telegram_id = Number(localStorage.getItem('dev_tid')) || Date.now();
        localStorage.setItem('dev_tid', telegram_id);
        username = 'WebUser';
      }

      // восстанавливаем последнюю ставку
      const lastBet = localStorage.getItem('last_bet');
      if (lastBet) setBet(lastBet);

      const auth = await apiAuth(telegram_id, username);
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      } else {
        console.error('Auth error', auth);
      }

      const lb = await apiLeaderboard(10);
      setLeaderboard(lb);
    };

    run();
  }, []);

  const refreshUser = async () => {
    try {
      const t = token || localStorage.getItem('jwt');
      if (!t) return;
      const me = await apiMe(t);
      if (!me.error) setUser(me);
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- БОНУС ----------
  const canClaimBonus = () => {
    if (!user?.last_bonus) return true;
    const last = new Date(user.last_bonus);
    const now = new Date();
    return now - last >= 24 * 60 * 60 * 1000;
  };

  const claimBonus = async () => {
    try {
      const t = token || localStorage.getItem('jwt');
      if (!t) return;
      const res = await apiBonus(t);
      if (res.awarded) {
        setUser(res.user);
        setMessage('🎁 Бонус начислен!');
      } else {
        setMessage('Бонус уже был получен сегодня.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- Игровая логика ----------
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

    const newDeck = shuffleDeck(createDeck());
    const player = [newDeck.pop(), newDeck.pop()];
    const dealer = [newDeck.pop(), newDeck.pop()];
    setDeck(newDeck);
    setPlayerCards(player);
    setDealerCards(dealer);
    setDealerHidden(true);
    setGameState('playing');
    setMessage('');
  }

  function draw() {
    const newDeck = [...deck];
    const card = newDeck.pop();
    setDeck(newDeck);
    return card;
  }

  async function updateCoins(delta) {
    try {
      const t = token || localStorage.getItem('jwt');
      if (!t) return;
      const data = await apiUpdateCoins(t, delta);
      if (data.user) setUser(data.user);
    } catch (err) {
      console.error(err);
    }
  }

  function endRound(resultDelta, resultMessage) {
    setGameState('finished');
    setDealerHidden(false);
    setMessage(resultMessage);

    updateCoins(resultDelta).then(async () => {
      await refreshUser();
      const lb = await apiLeaderboard(10);
      setLeaderboard(lb || []);
    });
  }

  function handleHit() {
    if (gameState !== 'playing') return;
    const card = draw();
    const newPlayer = [...playerCards, card];
    setPlayerCards(newPlayer);
    const score = calculateScore(newPlayer);
    if (score > 21) {
      endRound(-parseInt(bet, 10), 'Перебор! Вы проиграли.');
    }
  }

  function dealerPlay(currentDealerCards, currentDeck) {
    let d = [...currentDealerCards];
    let localDeck = [...currentDeck];
    while (calculateScore(d) < 17) {
      d.push(localDeck.pop());
    }
    return { d, localDeck };
  }

  function handleStand() {
    if (gameState !== 'playing') return;
    const { d, localDeck } = dealerPlay(dealerCards, deck);
    setDealerCards(d);
    setDeck(localDeck);
    setDealerHidden(false);

    const pScore = calculateScore(playerCards);
    const dScore = calculateScore(d);
    const wager = parseInt(bet, 10);

    let delta = 0;
    let msg = '';
    if (dScore > 21) {
      msg = 'У дилера перебор! Вы выиграли.';
      delta = wager;
    } else if (pScore > dScore) {
      msg = 'Вы выиграли!';
      delta = wager;
    } else if (pScore < dScore) {
      msg = 'Вы проиграли.';
      delta = -wager;
    } else {
      msg = 'Ничья.';
      delta = 0;
    }
    endRound(delta, msg);
  }

  function handleDouble() {
    if (gameState !== 'playing') return;
    const currentBet = parseInt(bet, 10);
    if (!user || currentBet * 2 > user.coins) {
      setMessage('Недостаточно монет для удвоения.');
      return;
    }
    const newBet = currentBet * 2;
    setBet(String(newBet));
    localStorage.setItem('last_bet', String(newBet));

    const card = draw();
    const newPlayer = [...playerCards, card];
    setPlayerCards(newPlayer);

    const score = calculateScore(newPlayer);
    if (score > 21) {
      endRound(-newBet, 'Перебор! Вы проиграли.');
      return;
    }

    const { d, localDeck } = dealerPlay(dealerCards, deck);
    setDealerCards(d);
    setDeck(localDeck);

    const pScore = calculateScore(newPlayer);
    const dScore = calculateScore(d);

    let delta = 0;
    let msg = '';
    if (dScore > 21) {
      msg = 'У дилера перебор! Вы выиграли.';
      delta = newBet;
    } else if (pScore > dScore) {
      msg = 'Вы выиграли!';
      delta = newBet;
    } else if (pScore < dScore) {
      msg = 'Вы проиграли.';
      delta = -newBet;
    } else {
      msg = 'Ничья.';
      delta = 0;
    }
    endRound(delta, msg);
  }

  function handleSurrender() {
    if (gameState !== 'playing') return;
    const wager = parseInt(bet, 10);
    const loss = Math.ceil(wager / 2);
    endRound(-loss, 'Вы сдались.');
  }

  function playAgain() {
    setGameState('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setMessage('');
    setDealerHidden(true);

    // автостарт с последней ставкой
    const lastBet = localStorage.getItem('last_bet');
    if (lastBet) {
      setBet(lastBet);
      setTimeout(() => startGame(true), 150); // небольшой таймаут чтобы стейт обновился
    }
  }

  const coins = user?.coins ?? 0;
  const playerScore = calculateScore(playerCards);
  const dealerScore = calculateScore(dealerCards);

  const dealerScoreText =
    dealerHidden && dealerCards.length > 0
      ? getCardValue(dealerCards[0].rank)
      : dealerScore;

  return (
    <div className="container">
      <div className="header">
        <h1>Блэкджек</h1>
        <div className="coins">
          💰 {coins}
          <button
            className="bonus-btn"
            onClick={claimBonus}
            disabled={!canClaimBonus()}
          >
            {canClaimBonus() ? '+ Бонус' : 'Бонус ✓'}
          </button>
        </div>
      </div>

      {/* Дилер */}
      <h3 className="label">
        Дилер
        {' '}
        {!dealerHidden ? `(${dealerScoreText})` : `(${dealerScoreText})`}
      </h3>
      <div className="hand">
        {dealerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} hidden={dealerHidden && i === 1} />
          </div>
        ))}
      </div>

      {/* Игрок */}
      <h3 className="label">
        Игрок {user ? `(${user.username})` : ''} ({playerScore})
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
            onChange={e => setBet(e.target.value)}
            min="1"
          />
          <button className="btn" onClick={() => startGame(false)} style={{ marginTop: 12 }}>
            Начать игру
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="controls">
          <button className="btn" onClick={handleHit}>Ещё</button>
          <button className="btn" onClick={handleStand}>Стоп</button>
          <button className="btn" onClick={handleDouble}>Удвоить</button>
          <button className="btn" onClick={handleSurrender}>Сдаться</button>
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

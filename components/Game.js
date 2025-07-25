// components/Game.js
import React, { useState, useEffect } from 'react';
import Card from './Card';
import Leaderboard from './Leaderboard';
import {
  API,
  apiAuth,
  apiMe,
  apiBonus,
  apiLeaderboard,
} from '../utils/api';

// ------- Вспомогательные функции для блэкджека -------
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
// ------------------------------------------------------

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

  // ---------- Авторизация ----------
  useEffect(() => {
    const run = async () => {
      // 1) Получаем данные из Telegram, либо делаем dev-режим
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

      let telegram_id, username;
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        telegram_id = u.id;
        username = u.username || u.first_name || `Player${u.id}`;
      } else {
        // Dev режим в обычном браузере
        telegram_id = Number(localStorage.getItem('dev_tid')) || Date.now();
        localStorage.setItem('dev_tid', telegram_id);
        username = 'WebUser';
      }

      // 2) Авторизация на сервере
      const auth = await apiAuth(telegram_id, username);
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      } else {
        console.error('Auth error', auth);
      }

      // 3) Загружаем таблицу лидеров
      const lb = await apiLeaderboard(10);
      setLeaderboard(lb || []);
    };

    run();
  }, []);

  // Удобный хелпер для повторной загрузки профиля
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
  const claimBonus = async () => {
    try {
      const t = token || localStorage.getItem('jwt');
      if (!t) return;
      const res = await apiBonus(t);
      if (res.awarded) {
        setUser(res.user);
        setMessage('🎁 Bonus claimed!');
      } else {
        setMessage('Bonus already claimed today.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const canClaimBonus = () => {
    if (!user?.last_bonus) return true;
    const last = new Date(user.last_bonus);
    const now = new Date();
    return now - last >= 24 * 60 * 60 * 1000;
  };

  // ---------- ИГРОВАЯ ЛОГИКА ----------
  function startGame() {
    const amount = parseInt(bet, 10);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid bet');
      return;
    }
    if (!user || amount > user.coins) {
      setMessage('Not enough coins');
      return;
    }

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

  // ВАЖНО: этот эндпоинт должен быть на бэкенде
  async function updateCoins(delta) {
    try {
      const t = token || localStorage.getItem('jwt');
      const res = await fetch(`${API}/api/updateCoins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`,
        },
        body: JSON.stringify({ delta }),
      });
      const data = await res.json();
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
      endRound(-parseInt(bet, 10), 'Bust! You lose.');
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
      msg = 'Dealer busts! You win.';
      delta = wager;
    } else if (pScore > dScore) {
      msg = 'You win!';
      delta = wager;
    } else if (pScore < dScore) {
      msg = 'You lose.';
      delta = -wager;
    } else {
      msg = 'Push (tie).';
      delta = 0;
    }
    endRound(delta, msg);
  }

  function handleDouble() {
    if (gameState !== 'playing') return;
    const currentBet = parseInt(bet, 10);
    if (!user || currentBet * 2 > user.coins) {
      setMessage('Not enough coins to double.');
      return;
    }
    setBet(String(currentBet * 2));

    const card = draw();
    const newPlayer = [...playerCards, card];
    setPlayerCards(newPlayer);

    const score = calculateScore(newPlayer);
    if (score > 21) {
      endRound(-currentBet * 2, 'Bust! You lose.');
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
      msg = 'Dealer busts! You win.';
      delta = currentBet * 2;
    } else if (pScore > dScore) {
      msg = 'You win!';
      delta = currentBet * 2;
    } else if (pScore < dScore) {
      msg = 'You lose.';
      delta = -currentBet * 2;
    } else {
      msg = 'Push (tie).';
      delta = 0;
    }
    endRound(delta, msg);
  }

  function handleSurrender() {
    if (gameState !== 'playing') return;
    const wager = parseInt(bet, 10);
    const loss = Math.ceil(wager / 2);
    endRound(-loss, 'You surrendered.');
  }

  function playAgain() {
    setGameState('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setBet('');
    setMessage('');
    setDealerHidden(true);
  }

  const coins = user?.coins ?? 0;

  return (
    <div className="container">
      <div className="header">
        <h1>Blackjack</h1>
        <div className="coins">
          💰 {coins}
          <button
            className="bonus-btn"
            onClick={claimBonus}
            disabled={!canClaimBonus()}
          >
            {canClaimBonus() ? '+ Bonus' : 'Bonus ✓'}
          </button>
        </div>
      </div>

      {/* Dealer */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
        {dealerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} hidden={dealerHidden && i === 1} />
          </div>
        ))}
      </div>

      {/* Player */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
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
            placeholder="Enter bet"
            value={bet}
            onChange={e => setBet(e.target.value)}
            min="1"
          />
          <button className="btn" onClick={startGame} style={{ marginTop: 12 }}>
            Start Game
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="controls">
          <button className="btn" onClick={handleHit}>Hit</button>
          <button className="btn" onClick={handleStand}>Stand</button>
          <button className="btn" onClick={handleDouble}>Double</button>
          <button className="btn" onClick={handleSurrender}>Surrender</button>
        </div>
      )}

      {gameState === 'finished' && (
        <button className="btn" onClick={playAgain} style={{ marginTop: 12 }}>
          Play Again
        </button>
      )}

      <Leaderboard leaderboard={leaderboard} />
    </div>
  );
}

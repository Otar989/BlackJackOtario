'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Card from './Card';
import Leaderboard from './Leaderboard';
import {
  API,
  apiAuth,
  apiMe,
  apiBonus,
  apiLeaderboard,
} from '../utils/api';

// -------- Вспомогательные функции для блэкджека ----------
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ rank: r, suit: s });
    }
  }
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
// ---------------------------------------------------------

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

  // Помним последнюю ставку
  useEffect(() => {
    const saved = localStorage.getItem('lastBet');
    if (saved) setBet(saved);
  }, []);
  useEffect(() => {
    if (bet) localStorage.setItem('lastBet', bet);
  }, [bet]);

  // Авторизация + первоначальные данные
  useEffect(() => {
    const run = async () => {
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : null;

      let telegram_id, username;
      if (tg?.initDataUnsafe?.user) {
        const u = tg.initDataUnsafe.user;
        telegram_id = u.id;
        username = u.username || u.first_name || `Player${u.id}`;
      } else {
        // dev-режим в браузере
        telegram_id = Number(localStorage.getItem('dev_tid')) || Date.now();
        localStorage.setItem('dev_tid', telegram_id);
        username = 'WebUser';
      }

      const auth = await apiAuth(telegram_id, username);
      if (auth?.token) {
        localStorage.setItem('jwt', auth.token);
        setToken(auth.token);
        setUser(auth.user);
      } else {
        console.error('Auth error', auth);
      }

      const lb = await apiLeaderboard(10);
      setLeaderboard(lb || []);
    };

    run();
  }, []);

  const playerScore = useMemo(() => calculateScore(playerCards), [playerCards]);
  const dealerScore = useMemo(() => calculateScore(dealerCards), [dealerCards]);

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

  function startGame(forceAmount) {
    const amount = forceAmount ?? parseInt(bet, 10);
    if (!amount || amount <= 0) {
      setMessage('Введите корректную ставку');
      return;
    }
    if (!user || amount > user.coins) {
      setMessage('Недостаточно монет');
      return;
    }

    setBet(String(amount)); // фиксируем ставку на раздачу

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

  function dealerPlay(currentDealer, currentDeck) {
    let d = [...currentDealer];
    let localDeck = [...currentDeck];
    while (calculateScore(d) < 17) {
      d.push(localDeck.pop());
    }
    return { d, localDeck };
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
      msg = 'Перебор у дилера! Вы выиграли.';
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
    setBet(String(currentBet * 2));

    const card = draw();
    const newPlayer = [...playerCards, card];
    setPlayerCards(newPlayer);

    const score = calculateScore(newPlayer);
    if (score > 21) {
      endRound(-currentBet * 2, 'Перебор! Вы проиграли.');
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
      msg = 'Перебор у дилера! Вы выиграли.';
      delta = currentBet * 2;
    } else if (pScore > dScore) {
      msg = 'Вы выиграли!';
      delta = currentBet * 2;
    } else if (pScore < dScore) {
      msg = 'Вы проиграли.';
      delta = -currentBet * 2;
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
    // ставка остаётся — можно нажать «Повторить ставку и раздать»
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
            {canClaimBonus() ? 'Бонус +' : 'Бонус ✓'}
          </button>
        </div>
      </div>

      {/* Дилер */}
      <div style={{ textAlign: 'center', marginTop: 8, color: '#aaa' }}>
        Дилер {dealerHidden ? '(?)' : `(${dealerScore})`}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        {dealerCards.map((c, i) => (
          <div key={i} style={{ marginRight: 8 }}>
            <Card card={c} hidden={dealerHidden && i === 1} />
          </div>
        ))}
      </div>

      {/* Игрок */}
      <div style={{ textAlign: 'center', marginTop: 16, color: '#aaa' }}>
        Вы ({playerScore})
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
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
          <button className="btn" onClick={() => startGame()}>
            Начать игру
          </button>
        </>
      )}

      {gameState === 'playing' && (
        <div className="controls">
          <button className="btn" onClick={handleHit}>Добор</button>
          <button className="btn" onClick={handleStand}>Стоп</button>
          <button className="btn" onClick={handleDouble}>Удвоить</button>
          <button className="btn" onClick={handleSurrender}>Сдаться</button>
        </div>
      )}

      {gameState === 'finished' && (
        <div className="controls">
          <button className="btn" onClick={() => startGame(parseInt(bet, 10))}>
            Повторить ставку и раздать
          </button>
          <button className="btn" onClick={playAgain}>
            Изменить ставку
          </button>
        </div>
      )}

      <Leaderboard leaderboard={leaderboard} meId={user?.telegram_id} />
    </div>
  );
}

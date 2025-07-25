import React, { useState, useEffect } from 'react';
import Card from './Card';
import Leaderboard from './Leaderboard';

// Helper to create and shuffle a deck of 52 playing cards
function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const array = [...deck];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function getCardValue(rank) {
  if (rank === 'A') return 11;
  if (['K', 'Q', 'J'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function calculateScore(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = getCardValue(card.rank);
    total += value;
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export default function Game() {
  const [telegramId, setTelegramId] = useState(null);
  const [username, setUsername] = useState('');
  const [coins, setCoins] = useState(0);
  const [bet, setBet] = useState('');
  const [deck, setDeck] = useState([]);
  const [playerCards, setPlayerCards] = useState([]);
  const [dealerCards, setDealerCards] = useState([]);
  const [gameState, setGameState] = useState('idle'); // idle, playing, finished
  const [message, setMessage] = useState('');
  const [leaderboard, setLeaderboard] = useState([]);
  const [dealerHidden, setDealerHidden] = useState(true);
  const [dailyBonusClaimed, setDailyBonusClaimed] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  // Fetch Telegram user info or fallback to local test user
  useEffect(() => {
    const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTelegramId(user.id);
        setUsername(user.username || user.first_name || `Player${user.id}`);
      }
    }
    // Fallback for web testing
    if (!telegramId) {
      const testId = 999999;
      setTelegramId(testId);
      setUsername('TestUser');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register or fetch user when telegramId is set
  useEffect(() => {
    if (!telegramId) return;
    async function initUser() {
      try {
        const res = await fetch(`${API_BASE}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ telegramId, username }),
        });
        const data = await res.json();
        if (data.user) {
          setCoins(data.user.coins);
          // Determine if daily bonus has already been claimed today
          if (data.user.last_bonus) {
            const lastBonus = new Date(data.user.last_bonus);
            const now = new Date();
            if (now - lastBonus < 24 * 60 * 60 * 1000) {
              setDailyBonusClaimed(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    initUser();
    // Load leaderboard
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telegramId]);

  // Fetch leaderboard
  async function fetchLeaderboard() {
    try {
      const res = await fetch(`${API_BASE}/api/leaderboard`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  }

  // Claim daily bonus
  async function claimBonus() {
    if (dailyBonusClaimed) return;
    try {
      const res = await fetch(`${API_BASE}/api/dailyBonus/${telegramId}`);
      const data = await res.json();
      if (data.awarded) {
        setCoins(data.user.coins);
        setDailyBonusClaimed(true);
        setMessage('🎁 Bonus claimed!');
      } else {
        setMessage('Bonus already claimed today.');
        setDailyBonusClaimed(true);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Start a new game/hand
  function startGame() {
    const amount = parseInt(bet, 10);
    if (!amount || amount <= 0) {
      setMessage('Enter a valid bet');
      return;
    }
    if (amount > coins) {
      setMessage('Not enough coins');
      return;
    }
    const newDeck = shuffleDeck(createDeck());
    const player = [newDeck.pop(), newDeck.pop()];
    const dealer = [newDeck.pop(), newDeck.pop()];
    setDeck(newDeck);
    setPlayerCards(player);
    setDealerCards(dealer);
    setGameState('playing');
    setDealerHidden(true);
    setMessage('');
  }

  // Helper: draw a card from the deck
  function draw() {
    const newDeck = [...deck];
    const card = newDeck.pop();
    setDeck(newDeck);
    return card;
  }

  // Update coins on server
  async function updateCoins(delta) {
    try {
      const res = await fetch(`${API_BASE}/api/updateCoins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, delta }),
      });
      const data = await res.json();
      if (data.user) {
        setCoins(data.user.coins);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Finish round and update coins & leaderboard
  function endRound(resultDelta, resultMessage) {
    setGameState('finished');
    setDealerHidden(false);
    setMessage(resultMessage);
    updateCoins(resultDelta);
    fetchLeaderboard();
  }

  // Handle Hit action
  function handleHit() {
    if (gameState !== 'playing') return;
    const card = draw();
    setPlayerCards([...playerCards, card]);
    const score = calculateScore([...playerCards, card]);
    if (score > 21) {
      // Player busts
      endRound(-parseInt(bet, 10), 'Bust! You lose.');
    }
  }

  // Dealer draws until 17 or more
  function dealerPlay(currentDealerCards, currentDeck) {
    let dealerCardsLocal = [...currentDealerCards];
    let deckLocal = [...currentDeck];
    while (calculateScore(dealerCardsLocal) < 17) {
      dealerCardsLocal.push(deckLocal.pop());
    }
    return { dealerCardsLocal, deckLocal };
  }

  // Handle Stand action
  function handleStand() {
    if (gameState !== 'playing') return;
    const { dealerCardsLocal, deckLocal } = dealerPlay(dealerCards, deck);
    setDealerCards(dealerCardsLocal);
    setDeck(deckLocal);
    setDealerHidden(false);
    // Determine outcome
    const playerScore = calculateScore(playerCards);
    const dealerScore = calculateScore(dealerCardsLocal);
    let delta = 0;
    let msg = '';
    const wager = parseInt(bet, 10);
    if (dealerScore > 21) {
      msg = 'Dealer busts! You win.';
      delta = wager;
    } else if (playerScore > dealerScore) {
      msg = 'You win!';
      delta = wager;
    } else if (playerScore < dealerScore) {
      msg = 'You lose.';
      delta = -wager;
    } else {
      msg = 'Push (tie).';
      delta = 0;
    }
    endRound(delta, msg);
  }

  // Handle Double action
  function handleDouble() {
    if (gameState !== 'playing') return;
    const currentBet = parseInt(bet, 10);
    if (currentBet * 2 > coins) {
      setMessage('Not enough coins to double.');
      return;
    }
    setBet((currentBet * 2).toString());
    // Draw one card for player
    const card = draw();
    setPlayerCards([...playerCards, card]);
    const score = calculateScore([...playerCards, card]);
    if (score > 21) {
      endRound(-currentBet * 2, 'Bust! You lose.');
    } else {
      // Stand after doubling
      const { dealerCardsLocal, deckLocal } = dealerPlay(dealerCards, deck);
      setDealerCards(dealerCardsLocal);
      setDeck(deckLocal);
      const playerScore = calculateScore([...playerCards, card]);
      const dealerScore = calculateScore(dealerCardsLocal);
      let delta = 0;
      let msg = '';
      if (dealerScore > 21) {
        msg = 'Dealer busts! You win.';
        delta = currentBet * 2;
      } else if (playerScore > dealerScore) {
        msg = 'You win!';
        delta = currentBet * 2;
      } else if (playerScore < dealerScore) {
        msg = 'You lose.';
        delta = -currentBet * 2;
      } else {
        msg = 'Push (tie).';
        delta = 0;
      }
      endRound(delta, msg);
    }
  }

  // Handle Surrender action
  function handleSurrender() {
    if (gameState !== 'playing') return;
    const wager = parseInt(bet, 10);
    const loss = Math.ceil(wager / 2);
    endRound(-loss, 'You surrendered.');
  }

  // Reset to play again
  function playAgain() {
    setGameState('idle');
    setPlayerCards([]);
    setDealerCards([]);
    setBet('');
    setMessage('');
    setDealerHidden(true);
  }

  return (
    <div className="container">
      <div className="header">
          <h1>Blackjack</h1>
          <div className="coins">
            💰 {coins}
            <button className="bonus-btn" onClick={claimBonus} disabled={dailyBonusClaimed}>
              {dailyBonusClaimed ? 'Bonus ✓' : '+ Bonus'}
            </button>
          </div>
      </div>
      {/* Dealer's hand */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        {dealerCards.map((card, index) => (
          <div key={index} style={{ marginRight: 8 }}>
            <Card card={card} hidden={dealerHidden && index === 1} />
          </div>
        ))}
      </div>
      {/* Player's hand */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        {playerCards.map((card, index) => (
          <div key={index} style={{ marginRight: 8 }}>
            <Card card={card} />
          </div>
        ))}
      </div>
      {/* Game message */}
      <div className="message">{message}</div>
      {/* Betting and action controls */}
      {gameState === 'idle' && (
        <>
          <input
            type="number"
            className="bet-input"
            placeholder="Enter bet"
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            min="1"
          />
          <button className="btn" onClick={startGame} style={{ marginTop: '12px' }}>
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
        <button className="btn" onClick={playAgain} style={{ marginTop: '12px' }}>
          Play Again
        </button>
      )}
      {/* Leaderboard */}
      <Leaderboard leaderboard={leaderboard} />
    </div>
  );
}
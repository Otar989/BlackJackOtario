import React from 'react';

export default function Leaderboard({ leaderboard = [] }) {
  return (
    <div className="leaderboard">
      <h3>🏆 Leaderboard</h3>
      <ul>
        {leaderboard.map((entry, index) => (
          <li key={index}>
            <span>{index + 1}. {entry.username || 'Player'}</span>
            <span>{entry.coins}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
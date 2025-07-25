'use client';

export default function Leaderboard({ leaderboard = [], meId }) {
  return (
    <div className="leaderboard">
      <h3>🏆 Таблица лидеров</h3>
      <ol>
        {leaderboard.map((u, idx) => {
          const isMe = u.telegram_id === meId;
          return (
            <li key={u.telegram_id || `${u.username}_${idx}`} className={isMe ? 'me' : ''}>
              <span>{idx + 1}. {u.username || 'Игрок'}</span>
              <span>{u.coins}</span>
            </li>
          );
        })}
      </ol>

      <style jsx>{`
        .leaderboard {
          margin-top: 24px;
          background: #142033;
          border-radius: 8px;
          padding: 16px;
        }
        h3 {
          margin: 0 0 8px;
        }
        ol {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: flex;
          justify-content: space-between;
          padding: 6px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        li:last-child {
          border-bottom: none;
        }
        li.me {
          background: rgba(255, 215, 0, 0.1);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

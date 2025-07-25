'use client';

export default function Leaderboard({ leaderboard, meId }) {
  const list = Array.isArray(leaderboard)
    ? leaderboard
    : (leaderboard?.leaderboard ?? []);

  return (
    <div className="leaderboard">
      <h3>🏆 Таблица лидеров</h3>
      <ol>
        {list.map((u, idx) => {
          const isMe = u.telegram_id === meId;
          return (
          <li
            key={u.telegram_id || `${u.username}_${idx}`}
            className={isMe ? 'me' : ''}
          >
            <span>
              {idx + 1}. {u.username || 'Игрок'}
              {isMe ? ' (вы)' : ''}
            </span>
            <span>{u.coins}</span>
          </li>
        );})}
      </ol>

      <style jsx>{`
        .leaderboard {
          background: #111a2b;
          border-radius: 8px;
          padding: 12px 16px;
          margin-top: 16px;
          color: #fff;
        }
        h3 {
          margin: 0 0 8px;
          font-size: 16px;
        }
        ol {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        li {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
        }
        li.me {
          color: #ffd166;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

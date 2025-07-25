// utils/api.js
export const API = process.env.NEXT_PUBLIC_API_BASE_URL;

export async function apiAuth(telegram_id, username = 'Anon') {
  const res = await fetch(`${API}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id, username })
  });
  return res.json();
}

export async function apiMe(token) {
  const res = await fetch(`${API}/api/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function apiBonus(token) {
  const res = await fetch(`${API}/api/bonus`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function apiLeaderboard(limit = 10) {
  const res = await fetch(`${API}/api/leaderboard?limit=${limit}`);
  return res.json();
}

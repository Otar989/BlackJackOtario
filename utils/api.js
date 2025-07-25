// utils/api.js
export const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function jsonFetch(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return data;
}

export async function apiAuth(telegram_id, username) {
  return jsonFetch(`${API}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id, username }),
  });
}

export async function apiMe(token) {
  return jsonFetch(`${API}/api/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function apiBonus(token) {
  return jsonFetch(`${API}/api/bonus`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function apiUpdateCoins(token, delta) {
  return jsonFetch(`${API}/api/updateCoins`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ delta }),
  });
}

export async function apiLeaderboard(limit = 10) {
  const data = await jsonFetch(`${API}/api/leaderboard?limit=${limit}`);
  // Бэкенд отдаёт { leaderboard: [...] }
  if (Array.isArray(data)) return data;
  return data.leaderboard || [];
}

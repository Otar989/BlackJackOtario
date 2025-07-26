// utils/api.js
export const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function json(req) {
  const res = await fetch(req);
  return res.json();
}

/* --- новый auth --- */
export function apiAuth(initData = '') {
  return json(
    new Request(`${API}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    }),
  );
}

export function apiMe(token) {
  return json(
    new Request(`${API}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export function apiBonus(token) {
  return json(
    new Request(`${API}/api/bonus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export function apiUpdateCoins(token, delta = 0) {
  return json(
    new Request(`${API}/api/updateCoins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ delta }),
    }),
  );
}

export function apiLeaderboard(limit = 10) {
  return json(`${API}/api/leaderboard?limit=${limit}`);
}

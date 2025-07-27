export const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function j(r) { const res = await fetch(r); return res.json(); }

export function apiAuth(username) {
  return j(new Request(`${API}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  }));
}

export function apiMe(tok) {
  return j(new Request(`${API}/api/me`, { headers: { Authorization: `Bearer ${tok}` } }));
}

export function apiBonus(tok) {
  return j(new Request(`${API}/api/bonus`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok}` },
  }));
}

export function apiUpdateCoins(tok, delta) {
  return j(new Request(`${API}/api/updateCoins`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
    body: JSON.stringify({ delta }),
  }));
}

export function apiLeaderboard(limit = 10) {
  return j(`${API}/api/leaderboard?limit=${limit}`);
}

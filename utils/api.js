// utils/api.js
export const API  = process.env.NEXT_PUBLIC_API_BASE_URL
  || 'https://blackjack-api-mfjp.onrender.com';

const json = (r) => r.json();

// 1) проверяем initData, получаем JWT
export async function apiVerify(initData) {
  return fetch(`${API}/api/verify`, {
    method  : 'POST',
    headers : { 'Content-Type':'application/json' },
    body    : JSON.stringify({ initData }),
  }).then(json);
}

// 2) прочие запросы (ниже используются в Game.js)
export const apiMe         = (t)         => fetch(`${API}/api/me`,          { headers:{ Authorization:`Bearer ${t}` } }).then(json);
export const apiBonus      = (t)         => fetch(`${API}/api/bonus`,       { method:'POST', headers:{ Authorization:`Bearer ${t}` } }).then(json);
export const apiLeaderboard= (n=10)      => fetch(`${API}/api/leaderboard?limit=${n}`).then(json);
export const apiAuth       = () => ({ error:'use /verify' }); // устарело

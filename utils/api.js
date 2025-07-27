export const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

async function j(r) { const res = await fetch(r); return res.json(); }

export const apiAuth = (username) =>
  j(new Request(`${API}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  }));

export const apiMe = (t) => j(new Request(`${API}/api/me`, { headers:{Authorization:`Bearer ${t}`}}));
export const apiBonus       = (t) => j(new Request(`${API}/api/bonus`,       {method:'POST', headers:{Authorization:`Bearer ${t}`}}));
export const apiUpdateCoins = (t,d=0)=> j(new Request(`${API}/api/updateCoins`,{
  method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${t}`},
  body:JSON.stringify({delta:d})
}));
export const apiLeaderboard = (l=10)=> j(`${API}/api/leaderboard?limit=${l}`);

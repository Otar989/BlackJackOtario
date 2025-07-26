export const API = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const json = async (r) => {
  const res = await fetch(r);
  return res.json();
};

export const apiAuth = ({ initData = '', telegram_id, username }) => {
  const body = initData ? { init_data: initData } : { telegram_id, username };
  return json(
    new Request(`${API}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
};

export const apiMe = (t) =>
  json(new Request(`${API}/api/me`, { headers: { Authorization: `Bearer ${t}` } }));

export const apiBonus = (t) =>
  json(
    new Request(`${API}/api/bonus`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    })
  );

export const apiUpdateCoins = (t, delta = 0) =>
  json(
    new Request(`${API}/api/updateCoins`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({ delta }),
    })
  );

export const apiLeaderboard = (limit = 10) =>
  json(`${API}/api/leaderboard?limit=${limit}`);

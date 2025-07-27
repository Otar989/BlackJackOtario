import { useState, useEffect } from 'react';
import Game from '../components/Game';
import Login from '../components/Login';

export default function Home() {
  const [auth, setAuth] = useState(null);

  useEffect(() => {
    const t = localStorage.getItem('jwt');
    const u = localStorage.getItem('username');
    if (t && u) setAuth({ token: t, user: { username: u } });
  }, []);

  if (!auth) return <Login onSuccess={setAuth} />;
  return <Game auth={auth} onLogout={() => {localStorage.clear(); setAuth(null);}} />;
}

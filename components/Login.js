'use client';
import { useState } from 'react';
import { apiAuth } from '../utils/api';

export default function Login({ onSuccess }) {
  const [name, setName]   = useState('');
  const [err , setErr ]   = useState('');

  async function submit() {
    if (!name.trim()) { setErr('Введите логин'); return; }
    const r = await apiAuth(name.trim());
    if (r.error) { setErr(r.error); return; }
    localStorage.setItem('jwt',  r.token);
    localStorage.setItem('username', r.user.username);
    onSuccess({ token: r.token, user: r.user });
  }

  return (
    <div className="wrap">
      <h2>Вход</h2>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Логин" />
      <button onClick={submit}>Продолжить</button>
      {err && <p className="err">{err}</p>}
      <style jsx>{`
        .wrap{max-width:320px;margin:80px auto;padding:24px;background:#101623;border-radius:8px;color:#fff;text-align:center}
        input{width:100%;padding:8px;margin:12px 0;background:#1a2333;border:1px solid #2a3242;border-radius:6px;color:#fff}
        button{width:100%;padding:10px 0;background:#345bda;border:none;border-radius:6px;color:#fff;font-weight:600}
        .err{color:#f55;font-size:14px}
      `}</style>
    </div>
  );
}

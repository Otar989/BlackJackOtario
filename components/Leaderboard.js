export default function Leaderboard({ leaderboard = [], me }) {
  if (!leaderboard.length) return null;
  return (
    <table style={{width:'100%',marginTop:24,color:'#fff',fontSize:14}}>
      <thead><tr><th align="left">Ник</th><th align="right">💰</th></tr></thead>
      <tbody>
        {leaderboard.map((u,i)=>(
          <tr key={i} style={u.username===me?{color:'#ffd700'}:null}>
            <td>{i+1}. {u.username}</td><td align="right">{u.coins}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

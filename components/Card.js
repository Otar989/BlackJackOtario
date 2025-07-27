export default function Card({ card, hidden = false }) {
  if (!card || hidden) return (
    <div style={{width:40,height:60,background:'#444',borderRadius:6}} />
  );
  return (
    <div
      style={{
        width:40,height:60,border:'1px solid #999',borderRadius:6,
        background:'#fff',color:'#000',display:'flex',
        alignItems:'center',justifyContent:'center',fontSize:18
      }}
    >
      {card.rank}{card.suit}
    </div>
  );
}

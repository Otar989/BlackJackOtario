import React from 'react';

/**
 * Render a playing card.  When `hidden` is true, a card back is shown instead of rank and suit.
 * @param {Object} props
 * @param {Object} props.card - Card object with rank and suit properties
 * @param {boolean} props.hidden - Whether to hide the card
 */
export default function Card({ card, hidden = false }) {
  if (hidden) {
    return <div className="card-back"></div>;
  }
  const { rank, suit } = card;
  // Determine color based on suit (hearts and diamonds are red)
  const isRed = suit === '♥' || suit === '♦';
  const color = isRed ? '#b91d3a' : '#172447';
  return (
    <div className="card fade-in" style={{ color }}>
      <div className="suit-top">{suit}</div>
      <div className="rank">{rank}</div>
      <div className="suit-bottom">{suit}</div>
    </div>
  );
}
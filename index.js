import dynamic from 'next/dynamic';
import Head from 'next/head';

// Dynamically import the Game component to avoid SSR issues with Telegram API
const Game = dynamic(() => import('../components/Game'), { ssr: false });

export default function Home() {
  return (
    <>
      <Head>
        <title>Blackjack Mini App</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <Game />
    </>
  );
}
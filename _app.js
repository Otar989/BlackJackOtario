import '../styles/globals.css';

// Custom App to inject global CSS into the Next.js application
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
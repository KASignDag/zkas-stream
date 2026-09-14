import ReactDOM from 'react-dom/client';
import App from './App';
import { CommunityMiningPage } from './components/CommunityMiningPage';
import './styles.css';

function Root() {
  const route = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (route === 'community-mining') {
    return (
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="ZKAS Stream home">
            <span><b>ZKAS</b><em>.stream</em></span>
            <small>COMMUNITY MINING</small>
          </a>
          <nav className="nav">
            <a href="/">Intelligence</a>
            <a href="#merged-mining">Merged Mining</a>
            <a href="#community-mining" className="active">Community Mining</a>
          </nav>
        </header>
        <main>
          <section className="hero-strip">
            <div>
              <div className="eyebrow"><span className="pulse-dot" /> ZKas community gateway</div>
              <h1>Community Merge Mining</h1>
              <p>Live, privacy-safe ZKAS + KAS solo merge-mining telemetry from the ZKAS.stream community gateway.</p>
            </div>
          </section>
          <CommunityMiningPage />
        </main>
      </div>
    );
  }

  return (
    <>
      <App />
      <a
        href="#community-mining"
        style={{
          position: 'fixed',
          right: 18,
          bottom: 18,
          zIndex: 40,
          padding: '11px 15px',
          borderRadius: 999,
          border: '1px solid rgba(34,211,238,.35)',
          background: 'rgba(8,17,31,.94)',
          color: '#e6fbff',
          fontWeight: 800,
          fontSize: 13,
          textDecoration: 'none',
          boxShadow: '0 10px 30px rgba(0,0,0,.24)',
        }}
      >
        Community Mining · Live
      </a>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);

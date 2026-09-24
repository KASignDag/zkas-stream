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
      <style>{`
        .otc-page .otc-price-dock {
          z-index: 30;
        }
        .community-mining-fab {
          position: fixed;
          left: 22px;
          right: auto;
          bottom: 24px;
          z-index: 40;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 15px;
          border: 1px solid rgba(34,211,238,.35);
          border-radius: 999px;
          background: rgba(8,17,31,.94);
          color: #e6fbff;
          font-size: 13px;
          font-weight: 800;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0,0,0,.24);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .community-mining-fab:hover { transform: translateY(-1px); }
        .community-mining-fab-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #31d7aa;
          box-shadow: 0 0 0 4px rgba(49,215,170,.14);
        }
        @media (max-width: 900px) {
          body:has(.nav.open) .community-mining-fab { display: none; }
          .community-mining-fab {
            left: 12px;
            right: auto;
            bottom: max(12px, env(safe-area-inset-bottom));
            width: calc(58vw - 18px);
            max-width: 230px;
            min-height: 46px;
            padding: 10px 12px;
            border-color: rgba(21,154,126,.38);
            background: rgba(8,27,22,.96);
            font-size: 12.5px;
            box-shadow: 0 10px 30px rgba(0,0,0,.2);
            white-space: nowrap;
          }
        }
      `}</style>
      <a className="community-mining-fab" href="/community-mining.html" aria-label="Open Community Mining live dashboard">
        <span className="community-mining-fab-dot" aria-hidden="true" />
        Community Mining
      </a>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);

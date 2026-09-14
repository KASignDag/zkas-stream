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

  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);

export const TABS = [
  { id: 'team', label: 'Team', icon: '🏈' },
  { id: 'market', label: 'Transfers', icon: '⇄' },
  { id: 'points', label: 'Points', icon: '★' },
  { id: 'rules', label: 'Rules', icon: '☰' },
];

/** Page frame shared by solo play and the league: header, body, bottom tabs. */
export default function Shell({ subtitle, notice, tabs, tab, setTab, children }) {
  return (
    <div className="app">
      <header className="app-header">
        <h1>NFFL <span className="muted">· {subtitle}</span></h1>
        {notice}
      </header>
      <main className="app-main">{children}</main>
      {tabs && (
        <nav className="tab-bar">
          {tabs.map((t) => (
            <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              <span className="tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

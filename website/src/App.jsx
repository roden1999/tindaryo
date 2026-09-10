const assets = {
  icon: `${import.meta.env.BASE_URL}tindaryo-icon.png`,
  home: `${import.meta.env.BASE_URL}screenshot-home.png`,
  inventory: `${import.meta.env.BASE_URL}screenshot-inventory.png`,
  traffic: `${import.meta.env.BASE_URL}screenshot-traffic.png`,
};

const playStoreUrl = import.meta.env.VITE_PLAY_STORE_URL?.trim();

const features = [
  ['01', 'Mabilis na bentahan', 'Search or scan products, change quantities, and accept Cash, GCash, Maya, split, or utang payments.'],
  ['02', 'Inventory na malinaw', 'Track stock, cost, selling price, low-stock limits, expiry dates, and every restock movement.'],
  ['03', 'Utang na organisado', 'Keep customer balances, due dates, partial payments, and shareable reminders in one ledger.'],
  ['04', 'Alam ang takbo ng tindahan', 'Review profit, expenses, best sellers, and the hours when customers usually buy.'],
];

const faqs = [
  ['Kailangan ba ng internet?', 'Hindi para sa araw-araw na paggamit. Inventory, sales, utang, reports, and reminders work from data stored on your phone.'],
  ['Kailangan ba ng account?', 'No. Tindaryo is designed for one store owner and does not require an online login or monthly account.'],
  ['Saan naka-save ang records?', 'Your records are stored in a private SQLite database on your device. Create regular backups before changing phones or uninstalling the app.'],
  ['May bayad ba?', 'Pricing will be announced when Tindaryo becomes publicly available on Google Play.'],
];

function Brand({ compact = false }) {
  return (
    <a className={`brand ${compact ? 'brand--compact' : ''}`} href="./index.html" aria-label="Tindaryo home">
      <img src={assets.icon} alt="" />
      <span>Tindaryo</span>
    </a>
  );
}

function PlayStoreButton({ compact = false }) {
  const className = `play-button ${compact ? 'play-button--compact' : ''}`;
  const content = <><span className="play-button__mark">▶</span><span><small>{playStoreUrl ? 'GET IT ON' : 'COMING SOON ON'}</small>Google Play</span></>;
  return playStoreUrl
    ? <a className={className} href={playStoreUrl} target="_blank" rel="noreferrer">{content}</a>
    : <span className={`${className} play-button--disabled`} aria-disabled="true">{content}</span>;
}

function Header({ simple = false }) {
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Brand compact />
        <nav aria-label="Main navigation">
          <a href={simple ? './index.html#features' : '#features'}>Features</a>
          {!simple && <a href="#offline">Why offline</a>}
          {!simple && <a href="#faq">FAQ</a>}
          <a href="./support.html">Support</a>
        </nav>
        <PlayStoreButton compact />
      </div>
    </header>
  );
}

function Phone({ src, alt, className = '' }) {
  return <figure className={`phone ${className}`}><span className="phone__speaker" aria-hidden="true" /><img src={src} alt={alt} /></figure>;
}

function HomePage() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="shell hero-layout">
            <div className="hero-copy">
              <p className="eyebrow"><span /> Gawang para sa sari-sari store</p>
              <h1>Mas madaling tindahan. <em>Mas malinaw na kita.</em></h1>
              <p className="hero-lead">Inventory, sales, utang, expenses, and store insights—organized in one app that keeps working even without internet.</p>
              <div className="hero-actions"><PlayStoreButton /><a className="text-link" href="#showcase">Tingnan ang app <span>↓</span></a></div>
              <ul className="trust-list" aria-label="Tindaryo benefits">
                <li><span>✓</span> Works offline</li><li><span>✓</span> No account required</li><li><span>✓</span> Your data stays on your phone</li>
              </ul>
            </div>
            <div className="hero-visual">
              <div className="sun-badge"><b>₱</b><span>Benta.<br />Bantay.<br />Backup.</span></div>
              <Phone src={assets.home} alt="Tindaryo dashboard showing store status, sales, and backup reminder" />
              <div className="floating-card floating-card--top"><span className="pulse" /> Offline ready</div>
              <div className="floating-card floating-card--bottom"><b>8 weeks</b><span>of sales patterns</span></div>
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="Product highlights"><div>SALES <span>•</span> INVENTORY <span>•</span> UTANG <span>•</span> EXPENSES <span>•</span> REPORTS <span>•</span> BACKUP</div></section>

        <section className="section shell" id="features">
          <div className="section-heading">
            <div><p className="eyebrow"><span /> Isang app para sa araw-araw</p><h2>From first sale to closing time.</h2></div>
            <p>Tindaryo keeps the important parts of your store connected, without turning simple work into complicated software.</p>
          </div>
          <div className="feature-grid">
            {features.map(([number, title, body]) => <article className="feature-card" key={number}><span className="feature-number">{number}</span><h3>{title}</h3><p>{body}</p></article>)}
          </div>
        </section>

        <section className="showcase" id="showcase">
          <div className="shell">
            <div className="showcase-heading"><p className="eyebrow eyebrow--light"><span /> Simple tingnan. Kumpleto gamitin.</p><h2>Your store at a glance.</h2></div>
            <div className="phone-gallery">
              <div className="gallery-item"><Phone src={assets.home} alt="Tindaryo home dashboard" /><p><b>Start with what matters.</b><span>Store status, sales, profit, and alerts.</span></p></div>
              <div className="gallery-item gallery-item--inventory"><Phone src={assets.inventory} alt="Tindaryo inventory screen" /><p><b>Know what is in stock.</b><span>Search, restock, and check prices quickly.</span></p></div>
              <div className="gallery-item gallery-item--traffic"><Phone src={assets.traffic} alt="Tindaryo sales traffic report" /><p><b>See your busy hours.</b><span>Use actual sales to understand buying patterns.</span></p></div>
            </div>
          </div>
        </section>

        <section className="section offline" id="offline">
          <div className="shell offline-layout">
            <div className="offline-mark" aria-hidden="true"><img src={assets.icon} alt="" /><span className="orbit orbit--one" /><span className="orbit orbit--two" /></div>
            <div className="offline-copy">
              <p className="eyebrow"><span /> Offline-first by design</p>
              <h2>Sa phone mo ang data. Sa iyo ang kontrol.</h2>
              <p>Tindaryo stores business records on your device, so a weak signal does not stop a sale. There is no account to remember and no server required for daily work.</p>
              <div className="offline-points"><div><b>Local</b><span>SQLite database</span></div><div><b>Private</b><span>No ads or analytics</span></div><div><b>Portable</b><span>Backup and restore</span></div></div>
              <a className="arrow-link" href="./privacy-policy.html">Read our privacy policy <span>→</span></a>
            </div>
          </div>
        </section>

        <section className="section shell faq" id="faq">
          <div className="section-heading section-heading--faq"><div><p className="eyebrow"><span /> Madalas itanong</p><h2>Good to know.</h2></div></div>
          <div className="faq-list">{faqs.map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className="cta-section"><div className="shell cta-layout"><div><p className="eyebrow eyebrow--light"><span /> Tindaryo for Android</p><h2>Handa para sa bawat benta.</h2><p>Public release is coming to Google Play.</p></div><PlayStoreButton /></div></section>
      </main>
      <Footer />
    </>
  );
}

function LegalLayout({ title, eyebrow, children }) {
  return <><Header simple /><main className="legal-shell shell"><div className="legal-heading"><p className="eyebrow"><span /> {eyebrow}</p><h1>{title}</h1></div><article className="legal-card">{children}</article></main><Footer /></>;
}

function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" eyebrow="Your data, clearly explained">
      <p className="legal-meta">Effective date: August 27, 2026</p>
      <p className="legal-lead">Tindaryo is an offline inventory, sales, expense, and customer-utang tracker for sari-sari stores. This policy explains how the mobile application handles information.</p>
      <h2>Information stored by the app</h2>
      <p>Tindaryo stores the store name, products, barcodes, prices, stock quantities, sales, customer names, utang records, payments, expenses, weekly store hours, preferences, and backup history in a local SQLite database on the user's device. Busy and quiet-hour patterns are calculated on the device from recorded sales and are not foot-traffic or location tracking. Tindaryo does not require an account and does not operate a server that receives this store data.</p>
      <p>The optional owner PIN and biometric-unlock preference are stored in device-protected secure storage. Biometric matching is performed by the device operating system. Tindaryo does not receive or store fingerprint or facial biometric data.</p>
      <h2>Device permissions</h2>
      <ul><li>Camera access is used only when the user opens the barcode scanner. Tindaryo does not save photos or video.</li><li>Notification access is used for optional low-stock, expiry, overdue-utang, and sales-pattern reminders generated from local records.</li><li>File and sharing access is used only when the user chooses to create, save, restore, print, or share a backup, CSV export, or receipt PDF.</li></ul>
      <h2>Sharing and third parties</h2>
      <p>Tindaryo does not sell personal information and does not include advertising or analytics SDKs. Information leaves the app only when the user explicitly exports or shares it. A storage provider, messaging app, email app, printer service, or other destination selected by the user handles that copy under its own privacy policy.</p>
      <h2>Security</h2>
      <p>Tindaryo relies on Android's application sandbox to protect its local database from other apps. The optional owner PIN is kept in device-protected secure storage, and biometric verification is handled by Android. Exported backups, CSV files, and PDF receipts are outside Tindaryo's application sandbox and are protected according to the folder or destination selected by the user.</p>
      <h2>Retention and deletion</h2>
      <p>Records remain on the device until the user edits them, archives supported records, uses <strong>Erase all store data</strong>, clears the app's storage, or uninstalls the app. The developer cannot recover local records. Users should create a full backup before changing devices, clearing storage, or uninstalling.</p>
      <h2>Children's privacy</h2><p>Tindaryo is a business utility and is not directed to children.</p>
      <h2>Changes</h2><p>Material changes to this policy will be reflected by updating the effective date and the policy shown with the app or its store listing.</p>
      <h2>Contact</h2><p>For privacy questions or concerns, email <a href="mailto:rodendeveloper@gmail.com">rodendeveloper@gmail.com</a>.</p>
    </LegalLayout>
  );
}

function SupportPage() {
  return (
    <LegalLayout title="How can we help?" eyebrow="Tindaryo support">
      <p className="legal-lead">Need help using Tindaryo or want to report a problem? Include your phone model, Android version, and a short description of what happened.</p>
      <a className="support-button" href="mailto:rodendeveloper@gmail.com?subject=Tindaryo%20Support">Email Tindaryo support <span>→</span></a>
      <p className="support-email"><strong>Support email</strong><br /><a href="mailto:rodendeveloper@gmail.com">rodendeveloper@gmail.com</a></p>
      <h2>Protect your store records</h2><p>Tindaryo stores its database on your device. Create a full backup regularly and keep another copy in a trusted folder or cloud-storage account. Uninstalling the app or clearing its storage can permanently delete records that were not backed up.</p>
      <h2>Barcode scanning</h2><p>Camera permission is required only for barcode scanning. You can still find and add products manually if you do not grant camera access.</p>
      <h2>PIN and biometrics</h2><p>Biometric unlock becomes available after the owner PIN is configured and the device has supported biometrics enrolled. Biometric matching remains under Android's control; Tindaryo never receives fingerprint or face data.</p>
      <h2>Deleting local data</h2><p>Use <strong>Settings → Erase all store data</strong> to remove the local store database. You can also clear the app's storage or uninstall it. These actions cannot be reversed without a previously created backup.</p>
      <h2>Privacy</h2><p>Read the complete <a href="./privacy-policy.html">Tindaryo Privacy Policy</a>.</p>
    </LegalLayout>
  );
}

function Footer() {
  return <footer className="site-footer"><div className="shell footer-layout"><Brand compact /><p>Offline tools for the everyday tindahan.</p><nav aria-label="Footer navigation"><a href="./privacy-policy.html">Privacy</a><a href="./support.html">Support</a><a href="mailto:rodendeveloper@gmail.com">Contact</a></nav><small>© 2026 Tindaryo</small></div></footer>;
}

export default function App() {
  const page = document.body.dataset.page;
  if (page === 'privacy') return <PrivacyPage />;
  if (page === 'support') return <SupportPage />;
  return <HomePage />;
}

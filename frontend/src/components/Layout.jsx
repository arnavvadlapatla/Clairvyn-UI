import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header with Logo */}
      <header className="sticky top-0 z-50 w-full bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <img 
            src="/clairvyn-logo.png" 
            alt="Clairvyn" 
            className="h-12 w-auto"
          />
        </div>
      </header>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="py-8 text-center text-gray-500 text-sm">
        <p>© 2025 Clairvyn. Disrupting the Ordinary.</p>
      </footer>
    </div>
  );
}


import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex min-h-screen" style={{background:'#0A0F1D'}}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/>
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <TopBar onMenuClick={() => setCollapsed(c => !c)}/>
        <main className="flex-1 overflow-auto" style={{background:'#0A0F1D'}}>
          {/* keyed on route → page transition replays on every navigation */}
          <div key={location.pathname} className="page-enter min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

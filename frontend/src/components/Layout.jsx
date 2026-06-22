import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed}/>
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <TopBar onMenuClick={() => setCollapsed(c => !c)}/>
        <main className="flex-1 overflow-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
}

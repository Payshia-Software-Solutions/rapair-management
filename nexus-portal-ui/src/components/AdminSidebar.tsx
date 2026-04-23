"use client";

import React from 'react';
import { 
  Zap, 
  Inbox, 
  UserCheck, 
  Layers, 
  CreditCard,
  LogOut,
  Sun,
  Moon
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

type AdminSidebarProps = {
  activeTab?: string;
  currentUser: string;
  role?: string;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
};

export default function AdminSidebar({ activeTab, currentUser, role, theme, onToggleTheme }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('http://localhost/rapair-management/nexus-portal-server/public/api/auth/logout', { credentials: 'include' });
    router.push('/admin/login');
  };

  const menuItems = [
    { id: 'requests', label: 'ERP Requests', icon: Inbox, roles: ['super_admin'] },
    { id: 'tenants', label: 'SaaS Tenants', icon: Layers, roles: ['super_admin'] },
    { id: 'packages', label: 'License Packages', icon: CreditCard, roles: ['super_admin'] },
    { id: 'subscription', label: 'Subscription & Billing', icon: CreditCard, roles: ['super_admin', 'client'] },
    { id: 'invoices', label: 'Payments & Invoices', icon: CreditCard, roles: ['super_admin'] },
    { id: 'users', label: 'Client Accounts', icon: UserCheck, roles: ['super_admin'] },
  ];

  const filteredMenu = menuItems.filter(item => !item.roles || (role && item.roles.includes(role)));

  return (
    <aside className="w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-white/5 flex flex-col h-screen sticky top-0 z-50 transition-colors duration-300">
      <div className="p-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Zap className="text-white fill-white" size={18} />
        </div>
        <span className="text-xl font-black tracking-tighter text-indigo-600 dark:text-white">NEXUS PORTAL</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {filteredMenu.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.includes(`/admin/${item.id}`) || (item.id === 'requests' && pathname === '/admin/dashboard');
          
          return (
            <button 
              key={item.id}
              onClick={() => {
                router.push(`/admin/${item.id}`);
              }}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                isActive 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-white'
              }`}
            >
              <Icon size={20} />
              <span className="font-semibold">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-6 border-t border-slate-200 dark:border-white/5">
        <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-4 mb-6 border border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black">
              {currentUser.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[120px]">{currentUser}</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">{role === 'super_admin' ? 'Master Access' : 'Authorized Client'}</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          <button 
            onClick={onToggleTheme}
            className="w-full flex items-center gap-4 px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl transition-all group"
          >
            <div className="p-1.5 rounded-lg bg-indigo-500/5 group-hover:bg-indigo-500/20 transition-all">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </div>
            <span className="font-semibold">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Save, Building2, Mail, MapPin, Globe, Phone, Image as ImageIcon, Loader2, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const API_BASE = 'http://localhost/rapair-management/nexus-portal-server/public/api';

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState({
    company_name: '',
    company_address: '',
    company_email: '',
    company_phone: '',
    company_website: '',
    company_logo: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/settings/company`, { credentials: 'include' });
      const data = await res.json();
      if (data.status === 'success') {
        setSettings(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/admin/settings/company/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Company branding updated successfully!' });
      } else {
        setMessage({ type: 'error', text: 'Failed to update settings' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Connection error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="w-full py-8 px-8 min-h-screen bg-slate-50/50 dark:bg-slate-950/50">
      <div className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <Building2 size={32} className="text-indigo-500" />
            </div>
            Company Branding & Profile
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your corporate identity for official documents and system communication.</p>
        </div>
        
        {message && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className={`px-6 py-3 rounded-2xl flex items-center gap-3 shadow-sm border ${
              message.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
            }`}
          >
            {message.type === 'success' ? <CheckCircle size={18} /> : <ImageIcon size={18} />}
            <span className="text-sm font-black uppercase tracking-tight">{message.text}</span>
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Configuration Form */}
        <div className="xl:col-span-2 space-y-8">
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Official Entity Name</label>
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text"
                  value={settings.company_name}
                  onChange={e => setSettings({...settings, company_name: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-base font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
                  placeholder="e.g. Payshia Software Solutions"
                  required
                />
              </div>
            </div>

            <div className="premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Contact Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="email"
                  value={settings.company_email}
                  onChange={e => setSettings({...settings, company_email: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
                  placeholder="billing@company.com"
                  required
                />
              </div>
            </div>

            <div className="premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Support Hotline</label>
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text"
                  value={settings.company_phone}
                  onChange={e => setSettings({...settings, company_phone: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
                  placeholder="+94 11..."
                />
              </div>
            </div>

            <div className="md:col-span-2 premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Corporate Address (Displays on Header)</label>
              <div className="relative group">
                <MapPin className="absolute left-4 top-6 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <textarea 
                  rows={4}
                  value={settings.company_address}
                  onChange={e => setSettings({...settings, company_address: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all resize-none"
                  placeholder="Full physical address for legal documents"
                  required
                />
              </div>
            </div>

            <div className="premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Official Website</label>
              <div className="relative group">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text"
                  value={settings.company_website}
                  onChange={e => setSettings({...settings, company_website: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
                  placeholder="www.yourcompany.com"
                />
              </div>
            </div>

            <div className="premium-card p-8">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Logo Asset Filename</label>
              <div className="relative group">
                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                <input 
                  type="text"
                  value={settings.company_logo}
                  onChange={e => setSettings({...settings, company_logo: e.target.value})}
                  className="w-full bg-slate-100/50 dark:bg-slate-900/50 border-2 border-transparent rounded-2xl py-4 pl-14 pr-6 text-sm font-bold focus:border-indigo-500/50 focus:bg-white dark:focus:bg-slate-900 outline-none transition-all"
                  placeholder="e.g. logo.png"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex justify-end gap-4 mt-4">
              <button 
                type="submit"
                disabled={saving}
                className="btn-premium px-12 py-5 rounded-3xl flex items-center gap-3 text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                {saving ? 'Updating Branding...' : 'Apply Corporate Profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Live Branding Preview */}
        <div className="space-y-6">
          <div className="premium-card overflow-hidden sticky top-8">
            <div className="bg-slate-900 p-4 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/50">Live Branding Preview</span>
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-rose-500/50" />
                <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
              </div>
            </div>
            <div className="p-10 bg-white dark:bg-white min-h-[400px]">
              {/* Document Header Mockup */}
              <div className="border-b-2 border-slate-100 pb-8 mb-8">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="w-32 h-10 bg-slate-100 rounded-lg mb-4 flex items-center justify-center text-[10px] font-bold text-slate-400">
                      LOGO: {settings.company_logo || 'default.png'}
                    </div>
                    <h2 className="text-xl font-black text-slate-900">{settings.company_name || 'Your Company Name'}</h2>
                    <p className="text-[10px] text-slate-500 mt-2 whitespace-pre-line leading-relaxed">
                      {settings.company_address || 'Street Address\nCity, Country'}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">
                      {settings.company_email} {settings.company_phone ? `| ${settings.company_phone}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tighter opacity-10">INVOICE</h1>
                    <p className="text-[10px] font-bold text-indigo-600 mt-1">#INV-SAMPLE-101</p>
                  </div>
                </div>
              </div>

              {/* Sample Content */}
              <div className="space-y-4 opacity-10">
                <div className="h-4 bg-slate-100 rounded w-full" />
                <div className="h-4 bg-slate-100 rounded w-5/6" />
                <div className="h-4 bg-slate-100 rounded w-4/6" />
              </div>

              <div className="mt-20 border-t border-slate-100 pt-6">
                <p className="text-[9px] text-slate-400 text-center font-medium">
                   &copy; {new Date().getFullYear()} {settings.company_name || 'Your Company'}. All rights reserved.<br/>
                   Generated by BizzFlow ERP Document Engine
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-6">
            <h4 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-3">Branding Tip</h4>
            <p className="text-sm text-slate-500 leading-relaxed italic">
              "Your company details are synchronized across all PDF engines. Changes saved here will be reflected on next invoice generation."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * API Module Barrel Export
 */

export * from './client';
export * from './orders';
export * from './inventory';
export * from './finance';
export * from './admin';
export * from './hrm';
export * from './reports';
export * from './dashboard';
export * from './master-data';
export * from './promotions';
export * from './production';

// Helper for content URLs (preserving legacy function)
export const CONTENT_BASE_URL =
  (process.env.NEXT_PUBLIC_CONTENT_BASE_URL ?? 'https://content-provider.payshia.com/service-center-system/').replace(/\/+$/, '') + '/';

export const contentUrl = (folder: 'vehicles' | 'orders' | 'items' | 'company' | 'brands' | 'employees' | 'documents', filename?: string | null) => {
  if (!filename) return '';
  // If it's already a full URL, return it
  if (filename.startsWith('http')) return filename;
  // If it's a local blob URL, return it
  if (filename.startsWith('blob:')) return filename;
  
  // Strip any leading slashes and take only the basename to be safe against legacy path data
  const safe = filename.split(/[/\\]/).pop() || '';
  return `${CONTENT_BASE_URL}${folder}/${encodeURIComponent(safe)}`;
};

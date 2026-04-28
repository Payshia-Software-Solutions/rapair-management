import { api } from './client';

export const sendSingleSms = async (data: { phone: string; message: string; customer_id?: number }) => {
  const res = await api('/api/marketing/send-sms', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to send SMS');
  return res.json();
};

export const createSmsCampaign = async (data: { name?: string; message: string; segment: string }) => {
  const res = await api('/api/marketing/bulk-sms', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create campaign');
  return res.json();
};

export const fetchSmsLogs = async () => {
  const res = await api('/api/marketing/logs');
  if (!res.ok) throw new Error('Failed to load SMS logs');
  const data = await res.json();
  return data.status === 'success' ? data.data : [];
};

export const fetchSmsCampaigns = async () => {
  const res = await api('/api/marketing/campaigns');
  if (!res.ok) throw new Error('Failed to load campaigns');
  const data = await res.json();
  return data.status === 'success' ? data.data : [];
};

export const fetchSmsSegments = async () => {
  const res = await api('/api/marketing/segments');
  if (!res.ok) throw new Error('Failed to load segments');
  const data = await res.json();
  return data.status === 'success' ? data.data : [];
};

export const fetchSmsSegmentDetails = async (id: string | number) => {
  const res = await api(`/api/marketing/segment-details/${id}`);
  if (!res.ok) throw new Error('Failed to load segment details');
  const data = await res.json();
  return data.status === 'success' ? data.data : null;
};

export const createSmsSegment = async (data: { name: string; description?: string }) => {
  const res = await api('/api/marketing/create-segment', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to create segment');
  return res.json();
};

export const updateSmsSegment = async (data: { id: number; name: string; description?: string }) => {
  const res = await api('/api/marketing/update-segment', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update segment');
  return res.json();
};

export const deleteSmsSegment = async (id: number) => {
  const res = await api('/api/marketing/delete-segment', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Failed to delete segment');
  return res.json();
};

export const importSmsContacts = async (data: { segment_id: number; contacts: any[] }) => {
  const res = await api('/api/marketing/import-contacts', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to import contacts');
  return res.json();
};

export const updateSmsContact = async (data: { id: number; name: string; phone: string; email?: string }) => {
  const res = await api('/api/marketing/update-contact', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update contact');
  return res.json();
};

export const deleteSmsContact = async (id: number) => {
  const res = await api('/api/marketing/delete-contact', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Failed to delete contact');
  return res.json();
};

export const rerunSmsCampaign = async (id: number) => {
  const res = await api('/api/marketing/rerun-campaign', {
    method: 'POST',
    body: JSON.stringify({ id })
  });
  if (!res.ok) throw new Error('Failed to re-run campaign');
  return res.json();
};

import { api } from './index';

export const fetchEmailCampaigns = async () => {
  const res = await api('/api/EmailMarketing/campaigns');
  if (!res.ok) throw new Error('Failed to fetch email campaigns');
  const data = await res.json();
  return data.data;
};

export const fetchEmailTemplates = async () => {
  const res = await api('/api/EmailMarketing/templates');
  if (!res.ok) throw new Error('Failed to fetch email templates');
  const data = await res.json();
  return data.data;
};

export const saveEmailTemplate = async (data: { id?: number; name: string; subject?: string; content: string }) => {
  const res = await api('/api/EmailMarketing/save-template', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save template');
  return res.json();
};

export const sendEmailCampaign = async (data: { name?: string; subject: string; content: string; segment: string }) => {
  const res = await api('/api/EmailMarketing/send-campaign', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to send newsletter');
  return res.json();
};

export const processEmailQueue = async () => {
  const res = await api('/api/EmailMarketing/process-queue', {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to process queue');
  return res.json();
};

export const fetchEmailLogs = async () => {
  const res = await api('/api/EmailMarketing/logs');
  if (!res.ok) throw new Error('Failed to fetch email logs');
  const data = await res.json();
  return data.data;
};

export const fetchMarketingMedia = async () => {
  const res = await api('/api/EmailMarketing/media');
  if (!res.ok) throw new Error('Failed to fetch marketing media');
  const data = await res.json();
  return data.data || [];
};

export const uploadMarketingImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);

  const res = await api('/api/Upload/marketing_image', {
    method: 'POST',
    body: formData,
    headers: { 'Accept': 'application/json' }
  });
  
  if (!res.ok) throw new Error('Failed to upload image');
  return res.json();
};
export const fetchSegmentContacts = async (segment: string) => {
  const res = await api(`/api/EmailMarketing/segment-contacts?segment=${segment}`);
  if (!res.ok) throw new Error('Failed to fetch segment contacts');
  const data = await res.json();
  return data.data;
};
export const deleteEmailTemplate = async (id: number) => {
  const res = await api(`/api/EmailMarketing/delete-template?id=${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete template');
  return res.json();
};

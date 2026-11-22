/**
 * URL of an uploaded file. Files on the content server are stored as full URLs; older ones as a path
 * relative to the API, so both are accepted.
 */
export const assetUrl = (path: string | null | undefined, base: string): string => {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
};

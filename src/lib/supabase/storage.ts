import { supabase } from './client';

const TTL_SECONDS = 3600;

/**
 * Rows store the storage PATH inside their bucket ("p1/123-file.jpg").
 * Legacy rows may hold a full public URL — normalize both to a bare path.
 */
function toPath(pathOrUrl: string): string {
  if (!pathOrUrl.includes('/storage/v1/')) return pathOrUrl.replace(/^\/+/, '');
  const after = (pathOrUrl.split('/storage/v1/object/')[1] ?? '').split('?')[0];
  return after.split('/').slice(2).join('/'); // drop "<mode>/<bucket>/"
}

/** Short-lived signed URL for <img>/<iframe>/download links. */
export async function getSignedUrl(bucket: string, pathOrUrl: string): Promise<string | null> {
  const path = toPath(pathOrUrl);
  if (!path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, TTL_SECONDS);
  return error ? null : data.signedUrl;
}

/** Object bytes via the authenticated client — no URL minting needed. */
export async function downloadObject(bucket: string, pathOrUrl: string): Promise<Blob> {
  const path = toPath(pathOrUrl);
  if (!path) throw new Error('Invalid storage path');
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw new Error(error.message);
  return data;
}

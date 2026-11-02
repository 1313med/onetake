import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Physical phones cannot use localhost (that's the phone itself).
// Update after Wi‑Fi reconnect if your PC IP changes (ipconfig → IPv4).
export const API_BASE =
  process.env.EXPO_PUBLIC_STUDIO_API || 'http://192.168.11.225:8787';

export type StudioOutput = {
  id: string;
  name: string;
  index: number;
  captionStyle: string;
  rationale: string;
  url: string;
  fileName: string;
  duration: number;
  size: number;
  width: number;
  height: number;
  timelineClips: number;
  captionEvents: number;
  qa: {
    ok: boolean;
    checks: { id: string; pass: boolean; detail: string }[];
    warnings?: { id: string; detail: string }[];
  };
  warnings?: string[];
};

export type StudioJob = {
  id: string;
  status: string;
  phase: string;
  progress: number;
  message: string;
  error?: string;
  meta?: { duration: number };
  phases?: string[] | null;
  timing?: Record<string, unknown> | null;
  transcriptSummary?: {
    language: string;
    segments: number;
    words: number;
    provider?: string;
    model?: string;
    confidence?: string;
    lowConfidenceSpans?: number;
  } | null;
  editorialSummary?: {
    engine?: string;
    ideaUnits?: number;
    takeGroups?: number;
    discardedTakes?: number;
  } | null;
  outputs: StudioOutput[];
};

export function mediaUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  return `${API_BASE}${pathOrUrl}`;
}

export async function healthCheck() {
  const r = await fetch(`${API_BASE}/health`);
  if (!r.ok) throw new Error('Studio server offline');
  return r.json();
}

export async function startStudioJob(params: {
  uri: string;
  niche: string;
  spokenNotes: string;
  goal: string;
  cta: string;
  languages: string[];
}): Promise<{ id: string }> {
  const fields = {
    niche: params.niche,
    spokenNotes: params.spokenNotes,
    goal: params.goal,
    cta: params.cta,
    languages: params.languages.join(','),
  };

  // Native: use Expo multipart uploader (avoids FormDataPart crash)
  if (Platform.OS !== 'web') {
    const result = await FileSystem.uploadAsync(`${API_BASE}/jobs`, params.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'video',
      mimeType: 'video/mp4',
      parameters: fields,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(result.body || `Upload failed (${result.status})`);
    }

    try {
      return JSON.parse(result.body);
    } catch {
      throw new Error(result.body || 'Invalid upload response');
    }
  }

  // Web: standard FormData + Blob
  const form = new FormData();
  const name = `upload_${Date.now()}.mp4`;
  const blob = await fetch(params.uri).then((r) => r.blob());
  form.append('video', blob, name);
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));

  const r = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    body: form,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || 'Failed to start job');
  }
  return r.json();
}

export async function getStudioJob(id: string): Promise<StudioJob> {
  const r = await fetch(`${API_BASE}/jobs/${id}`);
  if (!r.ok) throw new Error('Job not found');
  return r.json();
}

export async function pollJob(
  id: string,
  onUpdate: (job: StudioJob) => void,
  signal?: { cancelled: boolean }
) {
  while (!signal?.cancelled) {
    const job = await getStudioJob(id);
    onUpdate(job);
    if (job.status === 'completed' || job.status === 'failed') return job;
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error('cancelled');
}

// Fetches the build-time content JSON once and caches it in memory for the
// life of the tab. The service worker (workbox CacheFirst on /content/*)
// is what actually makes this work offline after the first load.

import { useEffect, useState } from 'react';
import type { Manifest, ContentFile, PlayItemsFile, Question } from './types';

let manifestPromise: Promise<Manifest> | null = null;
const contentPromises = new Map<string, Promise<ContentFile>>();
const playItemsPromises = new Map<string, Promise<PlayItemsFile>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return res.json() as Promise<T>;
}

export function loadManifest(): Promise<Manifest> {
  if (!manifestPromise) manifestPromise = fetchJson<Manifest>('/content/manifest.json');
  return manifestPromise;
}

export async function loadContent(specialty: string): Promise<ContentFile> {
  if (!contentPromises.has(specialty)) {
    contentPromises.set(
      specialty,
      loadManifest().then((manifest) => {
        const entry = manifest.specialties.find((s) => s.specialty === specialty);
        if (!entry) throw new Error(`Unknown specialty: ${specialty}`);
        return fetchJson<ContentFile>(`/${entry.contentFile}`);
      })
    );
  }
  return contentPromises.get(specialty)!;
}

export async function loadPlayItems(specialty: string): Promise<PlayItemsFile> {
  if (!playItemsPromises.has(specialty)) {
    playItemsPromises.set(
      specialty,
      loadManifest().then((manifest) => {
        const entry = manifest.specialties.find((s) => s.specialty === specialty);
        if (!entry) throw new Error(`Unknown specialty: ${specialty}`);
        return fetchJson<PlayItemsFile>(`/${entry.playFile}`);
      })
    );
  }
  return playItemsPromises.get(specialty)!;
}

export interface ContentBundle {
  manifest: Manifest;
  content: ContentFile;
  playItems: PlayItemsFile;
  questionsById: Map<string, Question>;
  groups: string[];
}

export async function loadBundle(specialty = 'cardiology'): Promise<ContentBundle> {
  const [manifest, content, playItems] = await Promise.all([
    loadManifest(),
    loadContent(specialty),
    loadPlayItems(specialty)
  ]);
  const entry = manifest.specialties.find((s) => s.specialty === specialty);
  return {
    manifest,
    content,
    playItems,
    questionsById: new Map(content.questions.map((q) => [q.id, q])),
    groups: entry?.groups ?? []
  };
}

type BundleState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; bundle: ContentBundle };

/** React hook wrapper around loadBundle for screens/components. */
export function useContentBundle(specialty = 'cardiology'): BundleState {
  const [state, setState] = useState<BundleState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    loadBundle(specialty)
      .then((bundle) => {
        if (!cancelled) setState({ status: 'ready', bundle });
      })
      .catch((error: Error) => {
        if (!cancelled) setState({ status: 'error', error });
      });
    return () => {
      cancelled = true;
    };
  }, [specialty]);

  return state;
}

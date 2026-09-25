import {useEffect, useState} from 'react';

import {mediaToken, mediaUrl} from '../api/media';
import {useAuth} from '../auth/AuthContext';
import type {MediaRef} from '../domain/media';
import {localFileFor} from './mediaStore';

export type MediaSourceState = 'loading' | 'local' | 'remote' | 'waiting' | 'offline';

export interface MediaSource {
  uri: string | null;
  state: MediaSourceState;
}

/**
 * Where to load a photo/video from: the copy on this phone if there is one
 * (works with no signal), otherwise the server copy through a media-token URL.
 *
 *   waiting — taken on another device and not uploaded yet
 *   offline — on the server, but no connection to fetch a token
 */
export function useMediaSource(ref: MediaRef | null): MediaSource {
  const {session} = useAuth();
  const loginToken = session?.token ?? null;
  const [source, setSource] = useState<MediaSource>({uri: null, state: 'loading'});

  useEffect(() => {
    let alive = true;
    if (!ref) {
      setSource({uri: null, state: 'waiting'});
      return;
    }
    (async () => {
      const local = await localFileFor(ref).catch(() => null);
      if (local) return {uri: `file://${local}`, state: 'local' as const};
      if (!ref.uploaded) return {uri: null, state: 'waiting' as const};
      const token = loginToken ? await mediaToken(loginToken) : null;
      return token ? {uri: mediaUrl(ref.id, token), state: 'remote' as const} : {uri: null, state: 'offline' as const};
    })().then(next => {
      if (alive) setSource(next);
    });
    return () => {
      alive = false;
    };
  }, [ref, loginToken]);

  return source;
}

/** Care-guide pictures are public: no token, no local copy. */
export function publicMediaUri(id: string): string {
  return mediaUrl(id);
}

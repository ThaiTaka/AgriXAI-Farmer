/**
 * Care guides — admin-written how-tos with an embedded YouTube video and
 * illustrated steps. They arrive through /sync (table `care_guides`) so the
 * text and steps read offline; the video and pictures need a connection the
 * first time (pictures are then cached by the image loader).
 */

export interface GuideStep {
  title: string;
  body: string;
  imageId: string | null;
}

function list(raw: string | null | undefined): unknown[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function parseSteps(raw: string | null | undefined): GuideStep[] {
  return list(raw)
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object' && typeof (s as {title?: unknown}).title === 'string')
    .map(s => ({
      title: s.title as string,
      body: typeof s.body === 'string' ? s.body : '',
      imageId: typeof s.image_id === 'string' ? s.image_id : null,
    }));
}

export function parseImageIds(raw: string | null | undefined): string[] {
  return list(raw).filter((v): v is string => typeof v === 'string');
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYoutubeId(id: string | null | undefined): id is string {
  return !!id && YOUTUBE_ID.test(id);
}

/**
 * The page the WebView loads: YouTube's own embed, full width at 16:9.
 * youtube-nocookie keeps the player from setting tracking cookies on a
 * farmer's phone; `playsinline` keeps it inside the app instead of jumping to
 * fullscreen on iOS.
 */
export function youtubeEmbedHtml(id: string): string {
  if (!isYoutubeId(id)) throw new Error('invalid YouTube id');
  const src = `https://www.youtube-nocookie.com/embed/${id}?playsinline=1&rel=0&modestbranding=1`;
  return (
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;background:#000;height:100%}iframe{border:0;width:100%;height:100%}</style>' +
    `</head><body><iframe src="${src}" referrerpolicy="strict-origin-when-cross-origin" ` +
    'allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></body></html>'
  );
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * The page a WebView loads to play one of the farmer's own videos — the file
 * on the phone, or the server copy through a media-token URL.
 */
export function videoPlayerHtml(src: string): string {
  const safe = src.replace(/"/g, '%22');
  return (
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<style>html,body{margin:0;background:#000;height:100%;display:flex;align-items:center}video{width:100%;max-height:100%}</style>' +
    `</head><body><video src="${safe}" controls playsinline autoplay></video></body></html>`
  );
}

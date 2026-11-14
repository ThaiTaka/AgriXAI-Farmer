/**
 * YouTube inside the app: the page the player WebView loads, what that page
 * reports back, and the links and pictures around it. Pure TypeScript so the
 * rules are tested without a WebView.
 *
 * The page uses YouTube's IFrame Player API rather than a bare <iframe> so the
 * app knows what the player is doing: the poster stays on screen until the
 * video is actually playing (no black frame while the player boots), and a
 * video whose uploader refused embedding says so in Vietnamese instead of
 * showing YouTube's own error card.
 */

/**
 * Origin the player page is served from (WebView `baseUrl`). The player needs
 * a real referrer — without one YouTube shows "Error 153" — and this one also
 * keeps the player from setting tracking cookies on a farmer's phone.
 */
export const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function isYoutubeId(id: string | null | undefined): id is string {
  return !!id && YOUTUBE_ID.test(id);
}

function assertId(id: string): void {
  if (!isYoutubeId(id)) throw new Error('invalid YouTube id');
}

/** YT.PlayerState values the page forwards. */
export const PLAYER_STATE = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export type PlayerEvent = (
  | {type: 'ready'}
  | {type: 'state'; state: number}
  | {type: 'error'; code: number | string}
) & {
  /** The page's `session` — which load of the frame the message comes from. */
  session?: number;
};

/**
 * The page the player WebView loads. `autoplay` is for a player created by the
 * farmer's own tap (or by opening the video screen), so that one tap plays.
 * `playsinline` keeps iOS from jumping to fullscreen; the fullscreen button in
 * the player still works. Every message the page posts carries `session`, so
 * the app can ignore one still in flight from a page it has already replaced.
 */
export function youtubePlayerHtml(
  id: string,
  {autoplay = false, session = 0}: {autoplay?: boolean; session?: number} = {},
): string {
  assertId(id);
  if (!Number.isInteger(session)) throw new Error('invalid player session');
  const vars = {
    autoplay: autoplay ? 1 : 0,
    playsinline: 1,
    rel: 0,
    modestbranding: 1,
    iv_load_policy: 3,
    fs: 1,
    hl: 'vi',
  };
  return (
    '<!doctype html><html><head>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">' +
    '<style>html,body{margin:0;height:100%;overflow:hidden;background:#000}' +
    '#player,iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}</style>' +
    '</head><body><div id="player"></div><script>' +
    `function send(m){m.session=${session};` +
    'window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify(m))}' +
    'var api=document.createElement("script");api.src="https://www.youtube.com/iframe_api";' +
    'api.onerror=function(){send({type:"error",code:"api"})};document.head.appendChild(api);' +
    'function onYouTubeIframeAPIReady(){' +
    `var vars=${JSON.stringify(vars)};vars.origin=location.origin;` +
    `window.player=new YT.Player("player",{host:${JSON.stringify(YOUTUBE_EMBED_ORIGIN)},videoId:${JSON.stringify(id)},` +
    'width:"100%",height:"100%",playerVars:vars,events:{' +
    `onReady:function(e){send({type:"ready"});${autoplay ? 'e.target.playVideo();' : ''}},` +
    'onStateChange:function(e){send({type:"state",state:e.data})},' +
    'onError:function(e){send({type:"error",code:e.data})}}})}' +
    '</script></body></html>'
  );
}

/**
 * Injected into the player page to pause it where it is — when the app goes
 * to the background, so a how-to video does not keep talking from a pocket,
 * and the farmer comes back to the same moment instead of the beginning.
 */
export const PAUSE_PLAYER_SCRIPT = 'window.player&&window.player.pauseVideo&&window.player.pauseVideo();true;';

/** What the player page posted; null for anything else (a stray message is ignored, not trusted). */
export function parsePlayerMessage(raw: string): PlayerEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const message = value as {type?: unknown; state?: unknown; code?: unknown; session?: unknown};
  const session = typeof message.session === 'number' ? {session: message.session} : {};
  if (message.type === 'ready') return {type: 'ready', ...session};
  if (message.type === 'state' && typeof message.state === 'number') {
    return {type: 'state', state: message.state, ...session};
  }
  if (message.type === 'error' && (typeof message.code === 'number' || typeof message.code === 'string')) {
    return {type: 'error', code: message.code, ...session};
  }
  return null;
}

/**
 * What to tell the farmer when the player fails. Codes are YouTube's
 * (onError): 100 removed or private; 101 / 150 the uploader turned embedding
 * off; 2 / 5 a bad id or a player error; "api" the player script did not load;
 * "timeout" nothing answered in time (a weak signal).
 */
export function playerErrorMessage(code: number | string): string {
  switch (code) {
    case 100:
      return 'Video này không còn trên YouTube.';
    case 101:
    case 150:
      return 'Chủ kênh không cho phát video này trong ứng dụng khác. Bấm "Mở bằng YouTube" để xem.';
    case 'api':
    case 'timeout':
      return 'Mạng yếu, video chưa tải được. Thử lại hoặc mở bằng YouTube.';
    default:
      return 'Không phát được video trong ứng dụng. Thử lại hoặc mở bằng YouTube.';
  }
}

/** A failure "Thử lại" can fix — not a video that is gone or locked. */
export function isRetryableError(code: number | string): boolean {
  return code !== 100 && code !== 101 && code !== 150;
}

/**
 * Whether a top-frame navigation inside the player WebView may load. Only the
 * player page itself; YouTube's logo or title link would otherwise open the
 * whole YouTube site inside a 16:9 box — the app hands those to the YouTube
 * app instead.
 */
export function isPlayerNavigation(url: string): boolean {
  if (url === 'about:blank' || url.startsWith('data:')) return true;
  return url === YOUTUBE_EMBED_ORIGIN || url === `${YOUTUBE_EMBED_ORIGIN}/` || url.startsWith(`${YOUTUBE_EMBED_ORIGIN}/embed/`);
}

/**
 * YouTube's still of the video. 'hq' (480×360, ~30 KB) for the big poster;
 * 'mq' (320×180, ~15 KB, already 16:9) for list thumbnails, so a list of
 * thirty-odd crops stays light.
 */
export function youtubeThumbnailUrl(id: string, quality: 'hq' | 'mq' = 'hq'): string {
  assertId(id);
  return `https://i.ytimg.com/vi/${id}/${quality}default.jpg`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/** 803 → "13:23"; 3725 → "1:02:05". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

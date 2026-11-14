/**
 * Video cách trồng: mỗi loại cây trong danh mục có video của riêng nó, loại
 * con trồng khác hẳn (ớt cay, cà phê chè) có video riêng; và trình phát giữ
 * ảnh bìa tới khi video thật sự chạy, báo lỗi bằng tiếng Việt, chỉ phát một
 * video một lúc.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const scripted = {state: 'idle' as string};
jest.mock('../src/sync/SyncContext', () => ({useSync: () => ({state: scripted.state})}));
const mockNavigate = jest.fn();
const mockRoute = {params: {} as Record<string, unknown>};
jest.mock('@react-navigation/native', () => ({
  NavigationContext: jest.requireActual('react').createContext(undefined),
  useNavigation: () => ({navigate: mockNavigate, goBack: jest.fn()}),
  useRoute: () => mockRoute,
}));

import {AppState, FlatList, Linking, Text} from 'react-native';
import * as webview from 'react-native-webview';

import {YouTubePlayer} from '../src/components/YouTubePlayer';
import {
  formatIsoDate,
  SOURCE_KIND_LABELS,
  videoChoices,
  videoFor,
  videoMeta,
} from '../src/domain/cropVideo';
import {
  formatDuration,
  isPlayerNavigation,
  PAUSE_PLAYER_SCRIPT,
  isRetryableError,
  parsePlayerMessage,
  playerErrorMessage,
  youtubePlayerHtml,
  youtubeThumbnailUrl,
} from '../src/domain/youtube';
import {ToolsScreen} from '../src/screens/ToolsScreen';
import {CropVideoLibraryScreen} from '../src/screens/video/CropVideoLibraryScreen';
import {CropVideoRow} from '../src/screens/video/CropVideoRow';
import {CropVideoScreen} from '../src/screens/video/CropVideoScreen';
import {allCropTypes, cropTypeById, cropVideo} from '../src/utils/staticData';

const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
  });
  mounted.push(tree);
  return tree;
}

/** Outermost instances with this testID (the WebView stand-in repeats its props on the View inside). */
const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(
    n => typeof n.type !== 'string' && n.props?.testID === id && n.parent?.props?.testID !== id,
  );

/** Every string the screen shows, in order. */
function shownText(tree: ReactTestRenderer.ReactTestRenderer): string {
  const flatten = (node: unknown): string =>
    typeof node === 'string' || typeof node === 'number'
      ? String(node)
      : Array.isArray(node)
        ? node.map(flatten).join('')
        : '';
  return tree.root
    .findAll(n => n.type === Text)
    .map(n => flatten(n.props.children))
    .join(' | ');
}

/** Post a message as the page in the player WebView would — with that page's session. */
async function postFromPage(tree: ReactTestRenderer.ReactTestRenderer, message: object, player = 0) {
  const web = byTestId(tree, 'youtube-player')[player];
  const session = Number(/m\.session=(\d+)/.exec(web.props.source.html)?.[1]);
  await ReactTestRenderer.act(async () => {
    web.props.onMessage({nativeEvent: {data: JSON.stringify({session, ...message})}});
  });
}

afterEach(() => {
  ReactTestRenderer.act(() => {
    mounted.splice(0).forEach(tree => tree.unmount());
  });
  jest.useRealTimers();
});

beforeEach(() => {
  scripted.state = 'idle';
  mockNavigate.mockClear();
  mockRoute.params = {};
});

describe('dữ liệu: mỗi loại cây một video của riêng nó', () => {
  test('every catalogue crop has a credited video, the eight required crops included', () => {
    const crops = allCropTypes();
    expect(crops.length).toBeGreaterThanOrEqual(34);
    for (const crop of crops) {
      expect(crop.video?.youtube_id).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(crop.video?.title).toBeTruthy();
      expect(crop.video?.channel).toBeTruthy();
      expect(crop.video?.channel_url).toMatch(/^https:\/\/www\.youtube\.com\//);
      expect(Object.keys(SOURCE_KIND_LABELS)).toContain(crop.video?.source_kind);
    }
    for (const name of ['Cà chua', 'Ớt', 'Dưa leo', 'Cà rốt', 'Rau muống', 'Bắp cải', 'Lúa', 'Ngô']) {
      expect(crops.find(c => c.name === name)?.video).toBeDefined();
    }
  });

  test('no two crops share a video', () => {
    const owners = new Map<string, string>();
    for (const crop of allCropTypes()) {
      for (const {video} of videoChoices(crop)) {
        expect(owners.get(video.youtube_id) ?? crop.id).toBe(crop.id);
        owners.set(video.youtube_id, crop.id);
      }
    }
  });

  test('a category grown differently has its own video; the rest use the crop’s', () => {
    const chili = cropTypeById('chili')!;
    expect(videoFor(chili, 'chili_chi_thien')?.youtube_id).not.toBe(chili.video?.youtube_id);
    expect(videoFor(chili, 'chili_chi_dia')?.youtube_id).toBe(videoFor(chili, 'chili_chi_thien')?.youtube_id);
    expect(videoFor(chili, 'chili_bell')).toBe(chili.video);
    expect(videoFor(chili, null)).toBe(chili.video);
    expect(videoFor(cropTypeById('coffee'), 'coffee_arabica')?.youtube_id).not.toBe(
      cropTypeById('coffee')!.video?.youtube_id,
    );
    expect(videoFor(undefined)).toBeUndefined();
  });

  test('the choices of a crop are labelled by the categories they cover', () => {
    expect(videoChoices(cropTypeById('chili')!).map(c => c.label)).toEqual([
      'Ớt ngọt (ớt chuông)',
      'Ớt cay chỉ địa · Ớt cay chỉ thiên',
    ]);
    const rose = videoChoices(cropTypeById('rose')!);
    expect(rose).toHaveLength(1);
    expect(rose[0].label).toBe('Hoa hồng');
  });

  test('a farmer-typed crop name finds the catalogue video; a farmer-made crop has none', () => {
    expect(cropVideo('ot', null, 'Ớt')).toBe(cropTypeById('chili')!.video);
    expect(cropVideo('sau_rieng', null, 'Sầu riêng')).toBeUndefined();
  });

  test('meta, dates and lengths read the Vietnamese way', () => {
    const rose = cropTypeById('rose')!.video!;
    expect(videoMeta(rose)).toBe('Báo và Phát thanh, Truyền hình Lâm Đồng · 3:21');
    expect(formatIsoDate('2025-02-13')).toBe('13/02/2025');
    expect(formatIsoDate('mới đây')).toBe('mới đây');
    expect(formatDuration(803)).toBe('13:23');
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
});

describe('trang trình phát (YouTube IFrame API)', () => {
  test('the page loads the IFrame API for exactly this video and reports back', () => {
    const html = youtubePlayerHtml('dQw4w9WgXcQ', {autoplay: true});
    expect(html).toContain('https://www.youtube.com/iframe_api');
    expect(html).toContain('host:"https://www.youtube-nocookie.com"');
    expect(html).toContain('videoId:"dQw4w9WgXcQ"');
    expect(html).toContain('"playsinline":1');
    expect(html).toContain('e.target.playVideo()');
    expect(html).toContain('window.ReactNativeWebView.postMessage');
    expect(youtubePlayerHtml('dQw4w9WgXcQ')).toContain('"autoplay":0');
    expect(youtubePlayerHtml('dQw4w9WgXcQ')).not.toContain('playVideo');
    expect(() => youtubePlayerHtml('"><script>')).toThrow();
    expect(youtubePlayerHtml('dQw4w9WgXcQ', {session: 7})).toContain('m.session=7;');
    expect(() => youtubePlayerHtml('dQw4w9WgXcQ', {session: 1.5})).toThrow();
  });

  test('only well-formed messages from the page are believed', () => {
    expect(parsePlayerMessage('{"type":"ready"}')).toEqual({type: 'ready'});
    expect(parsePlayerMessage('{"type":"state","state":1,"session":2}')).toEqual({type: 'state', state: 1, session: 2});
    expect(parsePlayerMessage('{"type":"error","code":150,"session":0}')).toEqual({type: 'error', code: 150, session: 0});
    expect(parsePlayerMessage('{"type":"state","state":"1"}')).toBeNull();
    expect(parsePlayerMessage('{"type":"other"}')).toBeNull();
    expect(parsePlayerMessage('null')).toBeNull();
    expect(parsePlayerMessage('not json')).toBeNull();
  });

  test('errors are told in Vietnamese; only the fixable ones offer a retry', () => {
    expect(playerErrorMessage(150)).toContain('Chủ kênh không cho phát');
    expect(playerErrorMessage(101)).toContain('Mở bằng YouTube');
    expect(playerErrorMessage(100)).toContain('không còn trên YouTube');
    expect(playerErrorMessage('timeout')).toContain('Mạng yếu');
    expect(playerErrorMessage(5)).toContain('Không phát được');
    expect(isRetryableError(150)).toBe(false);
    expect(isRetryableError(100)).toBe(false);
    expect(isRetryableError('timeout')).toBe(true);
  });

  test('only the player page itself may load inside the frame', () => {
    expect(isPlayerNavigation('about:blank')).toBe(true);
    expect(isPlayerNavigation('https://www.youtube-nocookie.com/')).toBe(true);
    expect(isPlayerNavigation('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1')).toBe(true);
    expect(isPlayerNavigation('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(false);
    expect(isPlayerNavigation('https://m.youtube.com/')).toBe(false);
  });

  test('list thumbnails use the light 16:9 still', () => {
    expect(youtubeThumbnailUrl('dQw4w9WgXcQ', 'mq')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg');
  });
});

describe('YouTubePlayer — mượt và rõ ràng', () => {
  test('the still stays over the booting player, then fades once the video plays', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'youtube-poster')[0].props.onPress();
    });
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
    expect(byTestId(tree, 'youtube-poster')).toHaveLength(1);
    expect(byTestId(tree, 'youtube-loading').length).toBeGreaterThan(0);

    await postFromPage(tree, {type: 'state', state: 3}); // buffering: still covered
    expect(byTestId(tree, 'youtube-loading').length).toBeGreaterThan(0);
    await postFromPage(tree, {type: 'state', state: 1}); // playing
    expect(byTestId(tree, 'youtube-loading')).toHaveLength(0);
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
  });

  test('a player that is ready but never starts uncovers its own controls', async () => {
    jest.useFakeTimers();
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    await postFromPage(tree, {type: 'ready'});
    expect(byTestId(tree, 'youtube-loading').length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(byTestId(tree, 'youtube-loading')).toHaveLength(0);
  });

  test('embedding refused: says so in Vietnamese, no pointless retry', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    await postFromPage(tree, {type: 'error', code: 150});
    expect(byTestId(tree, 'youtube-player')).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Chủ kênh không cho phát');
    expect(byTestId(tree, 'youtube-retry')).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Mở bằng YouTube');
  });

  test('nothing from the player in 15 s: a weak signal, and "Thử lại" loads it again', async () => {
    jest.useFakeTimers();
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(JSON.stringify(tree.toJSON())).toContain('Mạng yếu');
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'youtube-retry')[0].props.onPress();
    });
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
  });

  test('a message from a page already replaced is ignored', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    const web = byTestId(tree, 'youtube-player')[0];
    await ReactTestRenderer.act(async () => {
      web.props.onMessage({nativeEvent: {data: JSON.stringify({type: 'error', code: 150, session: 99})}});
    });
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
    expect(byTestId(tree, 'youtube-error')).toHaveLength(0);
  });

  test('switching to another video brings its still back at once, over a fresh player', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    await postFromPage(tree, {type: 'state', state: 1});
    expect(byTestId(tree, 'youtube-loading')).toHaveLength(0);
    const firstCover = tree.root.findAll(n => n.props.pointerEvents !== undefined && n.props.style)[0];
    await ReactTestRenderer.act(async () => {
      tree.update(<YouTubePlayer videoId="9bZkp7q19f0" autoPlay />);
    });
    expect(byTestId(tree, 'youtube-loading').length).toBeGreaterThan(0);
    expect(byTestId(tree, 'youtube-player')[0].props.source.html).toContain('videoId:"9bZkp7q19f0"');
    const secondCover = tree.root.findAll(n => n.props.pointerEvents !== undefined && n.props.style)[0];
    expect(secondCover.props.pointerEvents).toBe('auto');
    expect(secondCover).not.toBe(firstCover);
  });

  test('one video at a time: starting a second player stops the first', async () => {
    const tree = await render(
      <>
        <YouTubePlayer videoId="dQw4w9WgXcQ" />
        <YouTubePlayer videoId="9bZkp7q19f0" />
      </>,
    );
    const posters = byTestId(tree, 'youtube-poster');
    await ReactTestRenderer.act(async () => {
      posters[0].props.onPress();
    });
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'youtube-poster')[1].props.onPress();
    });
    const players = byTestId(tree, 'youtube-player');
    expect(players).toHaveLength(1);
    expect(players[0].props.source.html).toContain('videoId:"9bZkp7q19f0"');
  });

  test('YouTube’s own logo link opens the YouTube app, not the site inside the frame', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    const web = byTestId(tree, 'youtube-player')[0];
    expect(web.props.onShouldStartLoadWithRequest({url: 'https://www.youtube-nocookie.com/', isTopFrame: true})).toBe(true);
    expect(web.props.onShouldStartLoadWithRequest({url: 'https://ads.example/x', isTopFrame: false})).toBe(true);
    expect(
      web.props.onShouldStartLoadWithRequest({url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', isTopFrame: true}),
    ).toBe(false);
    expect(open).toHaveBeenCalledWith('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    open.mockClear();
    expect(web.props.onShouldStartLoadWithRequest({url: 'https://ads.example/x', isTopFrame: true})).toBe(false);
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  test('the app going to the background pauses the video where it is', async () => {
    const injected = (webview as unknown as {__injected: string[]}).__injected;
    injected.length = 0;
    // AppState is a jest mock in the React Native preset; read what was subscribed.
    const listen = AppState.addEventListener as unknown as jest.Mock;
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    const onChange = listen.mock.calls.filter(([event]) => event === 'change').pop()![1];
    await ReactTestRenderer.act(async () => {
      onChange('background');
    });
    expect(injected).toEqual([PAUSE_PLAYER_SCRIPT]);
    expect(byTestId(tree, 'youtube-player')).toHaveLength(1);
    expect(youtubePlayerHtml('dQw4w9WgXcQ')).toContain('window.player=new YT.Player');
  });

  test('the WebView never scrolls or zooms itself', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" autoPlay />);
    const web = byTestId(tree, 'youtube-player')[0];
    expect(web.props.scrollEnabled).toBe(false);
    expect(web.props.overScrollMode).toBe('never');
    expect(web.props.setBuiltInZoomControls).toBe(false);
    expect(web.props.allowsFullscreenVideo).toBe(true);
  });
});

describe('màn hình', () => {
  test('the compact row shows the crop’s video and opens the video screen', async () => {
    const tree = await render(<CropVideoRow cropTypeId="tomato" />);
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('Video cách trồng');
    expect(json).toContain(cropTypeById('tomato')!.video!.title);
    expect(json).toContain(`https://i.ytimg.com/vi/${cropTypeById('tomato')!.video!.youtube_id}/mqdefault.jpg`);
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'crop-video-tomato')[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('CropVideo', {cropTypeId: 'tomato', categoryId: null});
  });

  test('the row follows a category grown differently, and stays away from farmer-made crops', async () => {
    const tree = await render(<CropVideoRow cropTypeId="chili" categoryId="chili_chi_thien" />);
    expect(JSON.stringify(tree.toJSON())).toContain(videoFor(cropTypeById('chili'), 'chili_chi_thien')!.title);
    const none = await render(<CropVideoRow cropTypeId="sau_rieng" cropName="Sầu riêng" />);
    expect(none.toJSON()).toBeNull();
  });

  test('the video screen names the channel, how far to trust it, and the other video of the crop', async () => {
    mockRoute.params = {cropTypeId: 'chili', categoryId: 'chili_chi_dia'};
    const tree = await render(<CropVideoScreen />);
    const json = JSON.stringify(tree.toJSON());
    const hot = videoFor(cropTypeById('chili'), 'chili_chi_dia')!;
    expect(byTestId(tree, 'crop-video-title')[0].props.children).toBe(hot.title);
    expect(json).toContain(SOURCE_KIND_LABELS[hot.source_kind]);
    expect(json).toContain('Liều lượng phân, thuốc và lịch bón theo quy trình của tỉnh');
    expect(json).toContain('Ớt ngọt (ớt chuông)');
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'crop-video-choice-0')[0].props.onPress();
    });
    expect(byTestId(tree, 'crop-video-title')[0].props.children).toBe(cropTypeById('chili')!.video!.title);
  });

  test('the video screen for an unknown crop says there is no video', async () => {
    mockRoute.params = {cropTypeId: 'sau_rieng'};
    const tree = await render(<CropVideoScreen />);
    expect(JSON.stringify(tree.toJSON())).toContain('Chưa có video');
  });

  test('the library lists every catalogue crop, a screenful at a time', async () => {
    const tree = await render(<CropVideoLibraryScreen />);
    const list = tree.root.findByType(FlatList);
    expect(list.props.data.map((c: {id: string}) => c.id)).toEqual(allCropTypes().map(c => c.id));
    expect(list.props.initialNumToRender).toBeLessThan(allCropTypes().length);
    expect(shownText(tree)).toContain('Hoa cúc');
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'video-library-chrysanthemum')[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('CropVideo', {cropTypeId: 'chrysanthemum', categoryId: null});

    const chiliRow = await render(list.props.renderItem({item: cropTypeById('chili'), index: 11}));
    expect(shownText(chiliRow)).toContain('2 video theo loại');
  });

  test('Công cụ has a way in to the videos', async () => {
    const tree = await render(<ToolsScreen />);
    await ReactTestRenderer.act(async () => {
      byTestId(tree, 'tool-CropVideos')[0].props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('CropVideos');
  });
});

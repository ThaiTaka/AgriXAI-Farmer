/**
 * V2.1 components: the capture bar, the photo strip and the embedded YouTube
 * player — rendered against the jest stand-ins in __mocks__ for the picker,
 * the file system and the WebView.
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

const scripted = {state: 'idle' as string};
jest.mock('../src/sync/SyncContext', () => ({useSync: () => ({state: scripted.state})}));
jest.mock('../src/auth/AuthContext', () => ({useAuth: () => ({session: {token: 'login-token', user: {id: 'u1'}}})}));
jest.mock('../src/api/media', () => ({
  mediaToken: jest.fn(async () => 'media-token'),
  mediaUrl: (id: string, token?: string) => `http://api/media/${id}${token ? `?t=${token}` : ''}`,
}));

import * as fs from '@dr.pogodin/react-native-fs';
import * as picker from 'react-native-image-picker';

import {MediaCaptureBar} from '../src/components/MediaCaptureBar';
import {MediaStrip} from '../src/components/MediaStrip';
import {YouTubePlayer} from '../src/components/YouTubePlayer';
import type {MediaRef} from '../src/domain/media';
import {captureMedia} from '../src/media/mediaStore';
import {size} from '../src/theme';

const files = (fs as unknown as {__files: Set<string>}).__files;
const setNext = (picker as unknown as {__setNext: (r: object) => void}).__setNext;

async function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
  });
  return tree;
}

const byLabel = (tree: ReactTestRenderer.ReactTestRenderer, label: string) =>
  tree.root.findAll(n => typeof n.type !== 'string' && n.props.accessibilityLabel === label)[0];

beforeEach(() => {
  files.clear();
  scripted.state = 'idle';
});

describe('captureMedia', () => {
  test('moves the picked photo out of the cache into the documents folder', async () => {
    files.add('/data/agrilog/cache/rn_image_picker_lib_temp_1.jpg');
    setNext({assets: [{uri: 'file:///data/agrilog/cache/rn_image_picker_lib_temp_1.jpg', type: 'image/jpeg'}]});
    const [ref] = await captureMedia('photo');
    expect(ref).toMatchObject({kind: 'image', mime: 'image/jpeg', uploaded: false});
    expect(files.has(`/data/agrilog/files/media/${ref.id}.jpg`)).toBe(true);
    expect(files.has('/data/agrilog/cache/rn_image_picker_lib_temp_1.jpg')).toBe(false);
    expect(picker.launchCamera).toHaveBeenCalledWith(expect.objectContaining({mediaType: 'photo', maxWidth: 1600}));
  });

  test('videos are capped at a minute; cancel returns nothing; errors are worded', async () => {
    setNext({assets: [{uri: 'file:///c/v.mp4', type: 'video/mp4', duration: 12}]});
    const [video] = await captureMedia('video');
    expect(video.kind).toBe('video');
    expect(picker.launchCamera).toHaveBeenLastCalledWith(expect.objectContaining({durationLimit: 60, videoQuality: 'low'}));

    setNext({didCancel: true});
    expect(await captureMedia('library')).toEqual([]);

    setNext({errorCode: 'permission'});
    await expect(captureMedia('photo')).rejects.toThrow('chưa được phép dùng camera');
  });
});

describe('MediaCaptureBar', () => {
  test('three worded buttons at field size; photosOnly drops video', async () => {
    const tree = await render(<MediaCaptureBar onAdd={() => {}} />);
    const text = JSON.stringify(tree.toJSON());
    expect(text).toContain('Chụp ảnh');
    expect(text).toContain('Quay video');
    expect(text).toContain('Chọn trong máy');
    const photo = tree.root.findByProps({testID: 'capture-photo'});
    const style = [photo.props.style({pressed: false})].flat(3).reduce((a, b) => ({...a, ...b}), {});
    expect(style.minHeight).toBeGreaterThanOrEqual(size.minTouchTarget);

    const only = await render(<MediaCaptureBar photosOnly onAdd={() => {}} />);
    expect(JSON.stringify(only.toJSON())).not.toContain('Quay video');
  });

  test('hands the stored refs to the screen', async () => {
    const onAdd = jest.fn();
    setNext({assets: [{uri: 'file:///c/a.jpg', type: 'image/jpeg'}]});
    const tree = await render(<MediaCaptureBar onAdd={onAdd} />);
    await ReactTestRenderer.act(async () => {
      tree.root.findByProps({testID: 'capture-photo'}).props.onPress();
    });
    expect(onAdd).toHaveBeenCalledWith([expect.objectContaining({kind: 'image'})]);
  });
});

describe('MediaStrip', () => {
  const local: MediaRef = {id: 'aaaa1111', kind: 'image', mime: 'image/jpeg', uploaded: false};
  const remote: MediaRef = {id: 'bbbb2222', kind: 'image', mime: 'image/jpeg', uploaded: true};
  const elsewhere: MediaRef = {id: 'cccc3333', kind: 'video', mime: 'video/mp4', uploaded: false};

  test('local file first, server copy through a media token, and "chờ tải lên" otherwise', async () => {
    files.add('/data/agrilog/files/media/aaaa1111.jpg');
    const tree = await render(<MediaStrip refs={[local, remote, elsewhere]} />);
    const uris = tree.root.findAll(n => n.props.source?.uri).map(n => n.props.source.uri);
    expect(uris).toContain('file:///data/agrilog/files/media/aaaa1111.jpg');
    expect(uris).toContain('http://api/media/bbbb2222?t=media-token');
    // A photo taken on this phone and not yet uploaded is flagged.
    expect(tree.root.findAll(n => typeof n.type === 'string' && n.props.accessibilityLabel === 'Chưa tải lên máy chủ').length).toBe(2);
  });

  test('composer mode offers an × per tile', async () => {
    const onRemove = jest.fn();
    const tree = await render(<MediaStrip refs={[local]} onRemove={onRemove} />);
    ReactTestRenderer.act(() => byLabel(tree, 'Bỏ ảnh/video này').props.onPress());
    expect(onRemove).toHaveBeenCalledWith(local);
  });

  test('renders nothing for an empty list', async () => {
    const tree = await render(<MediaStrip refs={[]} />);
    expect(tree.toJSON()).toBeNull();
  });
});

describe('YouTubePlayer', () => {
  test('plays inside the app from YouTube’s own origin', async () => {
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" title="Bón thúc" />);
    const web = tree.root.findByProps({testID: 'youtube-player'});
    expect(web.props.source.baseUrl).toBe('https://www.youtube-nocookie.com');
    expect(web.props.source.html).toContain('/embed/dQw4w9WgXcQ');
    expect(JSON.stringify(tree.toJSON())).toContain('Mở bằng YouTube');
  });

  test('offline: says so instead of a grey box', async () => {
    scripted.state = 'offline';
    const tree = await render(<YouTubePlayer videoId="dQw4w9WgXcQ" />);
    expect(tree.root.findAllByProps({testID: 'youtube-player'})).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Cần có mạng để xem video');
  });
});

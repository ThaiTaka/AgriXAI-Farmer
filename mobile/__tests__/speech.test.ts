/**
 * The offline recogniser wrapper, against a stand-in for the native module
 * (android/.../speech/OfflineSpeechModule.kt): one utterance per listen, the
 * whole sentence decoded at the end, capitals turned into the lower case the
 * parser reads, errors in plain Vietnamese.
 */

import {DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform} from 'react-native';

const native = {
  loadModel: jest.fn(async () => undefined),
  start: jest.fn(async (_options: Record<string, number>) => undefined),
  stop: jest.fn(),
  cancel: jest.fn(),
};
NativeModules.OfflineSpeech = native;

// Loaded after the stand-in is in place: the wrapper looks the module up once.
const {listen, SpeechError, tidyTranscript} = require('../src/voice/speech') as typeof import('../src/voice/speech');

const emit = (event: 'partial' | 'result' | 'timeout' | 'error', text?: string) =>
  DeviceEventEmitter.emit(`OfflineSpeech.${event}`, text === undefined ? {} : {text});

beforeEach(() => {
  native.start.mockClear();
  native.stop.mockClear();
  native.cancel.mockClear();
});

test('streams the words so far and settles with the sentence, in lower case', async () => {
  const partials: string[] = [];
  const session = await listen({onPartial: t => partials.push(t)});
  emit('partial', 'BÁN NĂM');
  emit('partial', 'BÁN NĂM MƯƠI BÓ');
  emit('result', 'BÁN NĂM MƯƠI BÓ HOA CÚC ĐƯỢC MỘT TRIỆU RƯỠI');
  await expect(session.result).resolves.toBe('bán năm mươi bó hoa cúc được một triệu rưỡi');
  expect(partials).toEqual(['bán năm', 'bán năm mươi bó']);
});

test('asks the native side to wait for about a second of quiet, and gives up on silence', async () => {
  const session = await listen();
  const options = native.start.mock.calls[0][0];
  expect(options.endSilenceMs).toBeGreaterThanOrEqual(800);
  expect(options.noSpeechTimeoutMs).toBeGreaterThan(options.endSilenceMs);
  expect(options.maxMs).toBeGreaterThan(options.noSpeechTimeoutMs);
  emit('timeout');
  await expect(session.result).resolves.toBe('');
});

test('finish() stops the microphone and settles with the whole decoded sentence, not the last partial', async () => {
  const session = await listen();
  emit('partial', 'THUÊ BA NGƯỜI');
  session.finish();
  expect(native.stop).toHaveBeenCalledTimes(1);
  emit('result', 'THUÊ BA NGƯỜI SÁU TRĂM NGHÌN');
  await expect(session.result).resolves.toBe('thuê ba người sáu trăm nghìn');
});

test('cancel() drops a half-said sentence and frees the microphone', async () => {
  const session = await listen();
  emit('partial', 'MUA HAI BAO');
  session.cancel();
  expect(native.cancel).toHaveBeenCalledTimes(1);
  await expect(session.result).resolves.toBe('');
  // Events of the dropped sentence change nothing; the next listen works.
  emit('result', 'MUA HAI BAO URÊ');
  const next = await listen();
  next.cancel();
  await next.result;
});

test('one sentence at a time', async () => {
  const session = await listen();
  await expect(listen()).rejects.toEqual(expect.objectContaining({kind: 'busy'}));
  session.cancel();
  await session.result;
});

test('a refused microphone is a plain sentence, not a stack trace', async () => {
  native.start.mockRejectedValueOnce(Object.assign(new Error('RECORD_AUDIO not granted'), {code: 'permission'}));
  await expect(listen()).rejects.toEqual(expect.objectContaining({kind: 'permission'}));
  const session = await listen();
  session.cancel();
  await session.result;
});

test('on Android the permission is asked before the microphone opens', async () => {
  const os = jest.replaceProperty(Platform, 'OS', 'android');
  const check = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const request = jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  try {
    await expect(listen()).rejects.toEqual(expect.objectContaining({kind: 'permission'}));
    expect(request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    expect(native.start).not.toHaveBeenCalled();
  } finally {
    os.restore();
    check.mockRestore();
    request.mockRestore();
  }
});

test('a missing model says so, and is looked for again next time', async () => {
  native.start.mockRejectedValueOnce(Object.assign(new Error('asr-vi/encoder.onnx is not in the APK'), {code: 'model'}));
  const failed = await listen().catch(error => error);
  expect(failed).toBeInstanceOf(SpeechError);
  expect(failed.kind).toBe('model');
  expect(failed.message).toMatch(/mô hình giọng nói/);
  const loads = native.loadModel.mock.calls.length;
  const session = await listen();
  expect(native.loadModel.mock.calls.length).toBe(loads + 1);
  session.cancel();
  await session.result;
});

test('an engine error rejects the sentence', async () => {
  const session = await listen();
  emit('error', 'the microphone stopped (-3)');
  await expect(session.result).rejects.toBeInstanceOf(SpeechError);
});

test('the model writes capitals; the screen and the parser read lower case', () => {
  expect(tidyTranscript('  MUA HAI  BAO URÊ CÀ MAU ')).toBe('mua hai bao urê cà mau');
  expect(tidyTranscript('ĐỔ XĂNG MÁY BƠM')).toBe('đổ xăng máy bơm');
});

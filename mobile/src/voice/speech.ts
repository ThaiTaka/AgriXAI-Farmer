/**
 * Offline speech recognition — a Vietnamese Zipformer model on the phone.
 *
 * Everything runs on the device: the recogniser (sherpa-onnx Zipformer
 * transducer trained on ~70.000 h of Vietnamese, Apache-2.0) and a
 * voice-activity detector are packed into the APK by
 * scripts/fetch-speech-model.js, and audio never leaves the phone. Native side:
 * android/app/src/main/java/com/thaitaka/agrilogapp/speech/OfflineSpeechModule.kt.
 *
 * One utterance at a time: `listen` opens the microphone, streams the words
 * heard so far, and settles with the sentence once the farmer has spoken and
 * then kept quiet for about a second — or taps stop. A breath in the middle
 * ("thuê ba người… sáu trăm nghìn") does not end it (ADR 0014).
 */

import type {EmitterSubscription} from 'react-native';
import {DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform} from 'react-native';

interface OfflineSpeechNative {
  loadModel(): Promise<void>;
  start(options: {endSilenceMs: number; noSpeechTimeoutMs: number; maxMs: number}): Promise<void>;
  stop(): void;
  cancel(): void;
}

const native = NativeModules.OfflineSpeech as OfflineSpeechNative | undefined;

/** Quiet after the last word that ends the sentence, ms. */
const END_SILENCE_MS = 1000;
/** How long to wait for the farmer to start speaking, ms. */
const NO_SPEECH_TIMEOUT_MS = 10_000;
/** The longest sentence, ms. */
const MAX_UTTERANCE_MS = 20_000;

export type SpeechErrorKind = 'model' | 'permission' | 'busy' | 'engine';

export class SpeechError extends Error {
  constructor(
    readonly kind: SpeechErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'SpeechError';
  }
}

const MODEL_MISSING = 'Chưa có mô hình giọng nói trên máy. Cài lại ứng dụng bản có mô hình tiếng Việt.';
const PERMISSION_NEEDED = 'Cần cho phép dùng micro để ghi bằng giọng nói.';

/**
 * The recogniser writes capitals without punctuation ("BÁN NĂM MƯƠI BÓ");
 * the screen and the ledger parser read lower case.
 */
export function tidyTranscript(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
}

let modelReady: Promise<void> | null = null;

/** Loads the model once per app run (a second or two on a mid-range phone). */
export function ensureModel(): Promise<void> {
  if (!native) return Promise.reject(new SpeechError('model', MODEL_MISSING));
  if (!modelReady) {
    modelReady = native.loadModel().catch(error => {
      modelReady = null;
      console.warn('[voice] model failed to load', error);
      throw new SpeechError('model', MODEL_MISSING);
    });
  }
  return modelReady;
}

/** Starts loading the model early (when the voice screen opens); errors wait for `listen`. */
export function preloadModel(): void {
  ensureModel().catch(() => undefined);
}

async function microphoneAllowed(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
  if (await PermissionsAndroid.check(permission)) return true;
  return (await PermissionsAndroid.request(permission)) === PermissionsAndroid.RESULTS.GRANTED;
}

export interface ListenHandlers {
  /** Words recognised so far, updated while the farmer speaks. */
  onPartial?: (text: string) => void;
}

export interface Listening {
  /** The sentence, once the farmer pauses or `finish` is called; '' if nothing was heard. */
  result: Promise<string>;
  /** Stop listening now and settle with the whole sentence heard so far. */
  finish: () => void;
  /** Stop listening and drop what was heard (the screen was left). */
  cancel: () => void;
}

let active = false;

/** Starts the microphone for one utterance. */
export async function listen({onPartial}: ListenHandlers = {}): Promise<Listening> {
  if (!native) throw new SpeechError('model', MODEL_MISSING);
  if (active) throw new SpeechError('busy', 'Đang nghe rồi.');
  active = true;
  try {
    if (!(await microphoneAllowed())) throw new SpeechError('permission', PERMISSION_NEEDED);
    await ensureModel();
  } catch (error) {
    active = false;
    throw error;
  }

  let partial = '';
  let settle!: (text: string) => void;
  let fail!: (error: SpeechError) => void;
  const result = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  // The native module sends its events through RCTDeviceEventEmitter.
  const subscriptions: EmitterSubscription[] = [
    DeviceEventEmitter.addListener('OfflineSpeech.partial', ({text}: {text: string}) => {
      partial = tidyTranscript(text);
      onPartial?.(partial);
    }),
    DeviceEventEmitter.addListener('OfflineSpeech.result', ({text}: {text?: string}) => done(tidyTranscript(text ?? ''))),
    DeviceEventEmitter.addListener('OfflineSpeech.timeout', () => done(partial)),
    DeviceEventEmitter.addListener('OfflineSpeech.error', ({text}: {text?: string}) => {
      cleanup();
      fail(new SpeechError('engine', `Không nghe được: ${text ?? 'lỗi micro'}`));
    }),
  ];

  let finished = false;
  function cleanup() {
    if (finished) return;
    finished = true;
    active = false;
    subscriptions.forEach(s => s.remove());
  }
  function done(text: string) {
    if (finished) return;
    cleanup();
    settle(text || partial);
  }

  try {
    await native.start({endSilenceMs: END_SILENCE_MS, noSpeechTimeoutMs: NO_SPEECH_TIMEOUT_MS, maxMs: MAX_UTTERANCE_MS});
  } catch (error) {
    cleanup();
    const code = (error as {code?: string} | null)?.code;
    if (code === 'permission') throw new SpeechError('permission', PERMISSION_NEEDED);
    if (code === 'model') {
      modelReady = null;
      throw new SpeechError('model', MODEL_MISSING);
    }
    if (code === 'busy') throw new SpeechError('busy', 'Đang nghe rồi.');
    throw new SpeechError('engine', `Không bật được micro: ${String((error as Error)?.message ?? error)}`);
  }

  return {
    result,
    // The native side decodes the whole recording and answers with "result".
    finish: () => {
      if (!finished) native.stop();
    },
    cancel: () => {
      if (finished) return;
      native.cancel();
      cleanup();
      settle('');
    },
  };
}

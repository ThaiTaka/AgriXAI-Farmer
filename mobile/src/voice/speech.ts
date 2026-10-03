/**
 * Offline speech recognition — Vosk with the small Vietnamese model.
 *
 * Everything runs on the phone: the model (vosk-model-small-vn-0.4, 32 MB,
 * Apache-2.0) is packed into the APK by react-native-vosk from
 * mobile/assets/model-vn (fetched by scripts/fetch-vosk-model.js), and audio
 * never leaves the device. Out in a field with no signal the farmer can still
 * speak an entry.
 *
 * One utterance at a time: `listen` starts the microphone, streams partial
 * text, and settles with the sentence once the farmer pauses (Vosk's
 * "result after silence") or taps stop.
 */

import {loadModel, onError, onFinalResult, onPartialResult, onResult, onTimeout, start, stop} from 'react-native-vosk';

import vocabulary from './vocabulary.json';

const MODEL = 'model-vn';

/**
 * The words a ledger sentence is made of. Open vocabulary, the small model
 * hears "nghìn" as "nghiện" and "hai" as "hay"; held to these words it gets
 * the numbers, units and fertiliser names right (ADR 0010). Anything else
 * becomes [unk] and is dropped.
 */
export const GRAMMAR: readonly string[] = [...vocabulary.words, ...vocabulary.phrases, '[unk]'];

/** How long to wait for speech before giving up, ms. */
const LISTEN_TIMEOUT_MS = 12_000;

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

let modelReady: Promise<void> | null = null;

/** Loads the model once per app run (a few hundred ms on a mid-range phone). */
export function ensureModel(): Promise<void> {
  if (!modelReady) {
    modelReady = loadModel(MODEL).catch(error => {
      modelReady = null;
      console.warn('[voice] model failed to load', error);
      throw new SpeechError('model', 'Chưa có mô hình giọng nói trên máy. Cài lại ứng dụng bản có mô hình tiếng Việt.');
    });
  }
  return modelReady;
}

export interface ListenHandlers {
  /** Words recognised so far, updated while the farmer speaks. */
  onPartial?: (text: string) => void;
}

export interface Listening {
  /** The sentence, once the farmer pauses or `finish` is called; '' if nothing was heard. */
  result: Promise<string>;
  /** Stop listening now and settle with what was heard. */
  finish: () => void;
}

let active = false;

/** Starts the microphone for one utterance. */
export async function listen({onPartial}: ListenHandlers = {}): Promise<Listening> {
  if (active) throw new SpeechError('busy', 'Đang nghe rồi.');
  await ensureModel();
  active = true;

  let partial = '';
  let settle!: (text: string) => void;
  let fail!: (error: SpeechError) => void;
  const result = new Promise<string>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const subscriptions = [
    onPartialResult(text => {
      partial = text;
      onPartial?.(text);
    }),
    // Vosk reports the sentence after a pause; one utterance is all we want.
    onResult(text => done(text)),
    onFinalResult(text => done(text)),
    onTimeout(() => done(partial)),
    onError(error => {
      cleanup();
      fail(new SpeechError('engine', `Không nghe được: ${String(error)}`));
    }),
  ];

  let finished = false;
  function cleanup() {
    if (finished) return;
    finished = true;
    active = false;
    subscriptions.forEach(s => s.remove());
    try {
      stop();
    } catch {
      // already stopped
    }
  }
  function done(text: string) {
    if (finished) return;
    cleanup();
    settle((text || partial).trim());
  }

  try {
    await start({grammar: [...GRAMMAR], timeout: LISTEN_TIMEOUT_MS});
  } catch (error) {
    cleanup();
    const denied = /permission/i.test(String(error));
    throw new SpeechError(
      denied ? 'permission' : 'engine',
      denied ? 'Cần cho phép dùng micro để ghi bằng giọng nói.' : `Không bật được micro: ${String(error)}`,
    );
  }

  return {result, finish: () => done(partial)};
}

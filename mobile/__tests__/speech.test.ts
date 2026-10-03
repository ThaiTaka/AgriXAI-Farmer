/**
 * The offline recogniser wrapper, against the jest stand-in in
 * __mocks__/react-native-vosk.js: one utterance per listen, the domain
 * grammar always passed, errors in plain Vietnamese.
 */

import * as Vosk from 'react-native-vosk';

import {GRAMMAR, listen, SpeechError} from '../src/voice/speech';

const emit = (Vosk as unknown as {__emit: (name: string, value?: string) => void}).__emit;
const start = Vosk.start as unknown as jest.Mock;
const stop = Vosk.stop as unknown as jest.Mock;

const flush = () => new Promise<void>(resolve => setImmediate(() => resolve()));

beforeEach(() => {
  start.mockClear();
  stop.mockClear();
});

test('streams partial text and settles with the sentence after the pause', async () => {
  const partials: string[] = [];
  const session = await listen({onPartial: t => partials.push(t)});
  emit('partial', 'bán năm');
  emit('partial', 'bán năm mươi bó');
  emit('result', 'bán năm mươi bó hoa cúc');
  await expect(session.result).resolves.toBe('bán năm mươi bó hoa cúc');
  expect(partials).toEqual(['bán năm', 'bán năm mươi bó']);
  expect(stop).toHaveBeenCalled();
});

test('starts with the domain grammar and a timeout', async () => {
  const session = await listen();
  const options = start.mock.calls[0][0];
  expect(options.grammar).toEqual(GRAMMAR);
  expect(options.grammar).toContain('[unk]');
  expect(options.grammar).toContain('phú mỹ');
  expect(options.timeout).toBeGreaterThan(0);
  session.finish();
  await expect(session.result).resolves.toBe('');
});

test('finish() settles with what was heard so far', async () => {
  const session = await listen();
  emit('partial', 'mua hai bao');
  session.finish();
  await expect(session.result).resolves.toBe('mua hai bao');
});

test('a refused microphone is a plain sentence, not a stack trace', async () => {
  start.mockRejectedValueOnce('Record permission not granted');
  await expect(listen()).rejects.toEqual(expect.objectContaining({kind: 'permission'}));
  // The failed start released the recogniser: the next listen works.
  const session = await listen();
  session.finish();
  await session.result;
});

test('an engine error rejects the utterance', async () => {
  const session = await listen();
  emit('error', 'AudioRecord failed');
  await expect(session.result).rejects.toBeInstanceOf(SpeechError);
  await flush();
});

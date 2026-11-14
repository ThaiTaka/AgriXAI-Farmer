package com.thaitaka.agrilogapp.speech

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OfflineTransducerModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import com.k2fsa.sherpa.onnx.WaveReader
import com.thaitaka.agrilogapp.BuildConfig
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Offline Vietnamese speech recognition for "Nói để ghi".
 *
 * A Zipformer transducer (sherpa-onnx, model trained on ~70.000 h of Vietnamese)
 * and the Silero voice-activity detector, both packed in the APK under
 * assets/asr-vi by scripts/fetch-speech-model.js. Audio never leaves the phone.
 *
 * One utterance per start(): the microphone stays open until the farmer has
 * said something and then kept quiet for `endSilenceMs`, or taps stop. A short
 * breath inside the sentence ("thuê ba người… sáu trăm nghìn") does not end it,
 * and the whole recording is decoded at once — the price after the pause is
 * never cut off. While the farmer speaks, the words so far are decoded every
 * PARTIAL_EVERY_MS and sent as "partial" events.
 *
 * Debug builds only: a 16 kHz mono WAV pushed to
 * /sdcard/Android/data/<package>/files/asr-input.wav is heard instead of the
 * microphone on the next start() (then deleted), so a recorded sentence can be
 * run through the real pipeline on an emulator.
 */
class OfflineSpeechModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  /** Loads the models and runs every decode — one at a time, in order. */
  private val worker: ExecutorService = Executors.newSingleThreadExecutor()

  @Volatile private var recognizer: OfflineRecognizer? = null
  @Volatile private var vad: Vad? = null
  @Volatile private var session: Session? = null

  @ReactMethod
  fun loadModel(promise: Promise) {
    worker.execute {
      try {
        ensureLoaded()
        promise.resolve(null)
      } catch (e: Throwable) {
        Log.e(TAG, "speech model failed to load", e)
        promise.reject("model", e.message ?: e.toString(), e)
      }
    }
  }

  @ReactMethod
  fun start(options: ReadableMap, promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO)
    if (granted != PackageManager.PERMISSION_GRANTED) {
      promise.reject("permission", "RECORD_AUDIO not granted")
      return
    }
    val next = Session(
        endSilenceMs = options.intOr("endSilenceMs", 1000),
        noSpeechMs = options.intOr("noSpeechTimeoutMs", 10_000),
        maxMs = options.intOr("maxMs", 20_000),
    )
    synchronized(this) {
      if (session != null) {
        promise.reject("busy", "already listening")
        return
      }
      session = next
    }
    worker.execute {
      try {
        ensureLoaded()
        next.open()
      } catch (e: Throwable) {
        Log.e(TAG, "could not start listening", e)
        next.close()
        session = null
        val code = if (e is ModelMissing) "model" else if (e is SecurityException) "permission" else "engine"
        promise.reject(code, e.message ?: e.toString(), e)
        return@execute
      }
      promise.resolve(null)
      Thread(next::run, "agrilog-speech").start()
    }
  }

  /** Stop listening now and decode what was said so far. */
  @ReactMethod
  fun stop() {
    session?.requestStop()
  }

  /** Stop listening and drop the utterance (the screen was left). */
  @ReactMethod
  fun cancel() {
    session?.cancel()
  }

  override fun invalidate() {
    session?.cancel()
    worker.shutdown()
    super.invalidate()
  }

  private class ModelMissing(message: String) : Exception(message)

  /** Runs on [worker] only, so loading never races itself and never blocks the module thread. */
  private fun ensureLoaded() {
    if (recognizer != null && vad != null) return
    val assets = reactContext.assets
    // sherpa-onnx ends the process when an asset it is told to read is
    // missing, so look first and fail with a sentence instead.
    for (name in MODEL_FILES) {
      try {
        assets.open("$MODEL_DIR/$name").close()
      } catch (e: Exception) {
        throw ModelMissing("$MODEL_DIR/$name is not in the APK — run `node scripts/fetch-speech-model.js` and rebuild")
      }
    }
    if (recognizer == null) {
      recognizer = OfflineRecognizer(
          assets,
          OfflineRecognizerConfig(
              featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
              modelConfig = OfflineModelConfig(
                  transducer = OfflineTransducerModelConfig(
                      encoder = "$MODEL_DIR/encoder.onnx",
                      decoder = "$MODEL_DIR/decoder.onnx",
                      joiner = "$MODEL_DIR/joiner.onnx",
                  ),
                  tokens = "$MODEL_DIR/tokens.txt",
                  numThreads = 2,
              ),
              decodingMethod = "greedy_search",
          ),
      )
    }
    if (vad == null) {
      vad = Vad(
          assets,
          VadModelConfig(
              sileroVadModelConfig = SileroVadModelConfig(
                  model = "$MODEL_DIR/silero_vad.onnx",
                  threshold = 0.5f,
                  minSilenceDuration = 0.25f,
                  minSpeechDuration = 0.25f,
                  windowSize = VAD_WINDOW,
                  // Our own buffer keeps the whole utterance; the detector
                  // must not cut a long sentence into pieces.
                  maxSpeechDuration = 30f,
              ),
              sampleRate = SAMPLE_RATE,
              numThreads = 1,
          ),
      )
    }
  }

  private fun decode(audio: FloatArray): String {
    val engine = recognizer ?: return ""
    val stream = engine.createStream()
    try {
      stream.acceptWaveform(audio, SAMPLE_RATE)
      // A little silence after the last word gives the encoder its right context.
      stream.acceptWaveform(FloatArray(samplesFor(300)), SAMPLE_RATE)
      engine.decode(stream)
      return engine.getResult(stream).text.trim()
    } finally {
      stream.release()
    }
  }

  private fun emit(event: String, text: String? = null) {
    if (!reactContext.hasActiveReactInstance()) return
    val params = Arguments.createMap().apply { if (text != null) putString("text", text) }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(event, params)
  }

  private inner class Session(val endSilenceMs: Int, val noSpeechMs: Int, val maxMs: Int) {
    @Volatile private var stopRequested = false
    @Volatile private var cancelled = false
    @Volatile private var finished = false
    @Volatile private var partialQueued = false
    private var record: AudioRecord? = null
    private var pushed: FloatArray? = null
    private var pushedAt = 0
    private val shorts = ShortArray(CHUNK)
    private val heard = Samples(samplesFor(4000))

    fun requestStop() {
      stopRequested = true
    }

    fun cancel() {
      cancelled = true
      stopRequested = true
    }

    @SuppressLint("MissingPermission") // checked in start()
    fun open() {
      val file = reactContext.getExternalFilesDir(null)?.let { File(it, DEBUG_INPUT) }
      if (BuildConfig.DEBUG && file != null && file.isFile) {
        val wave = WaveReader.readWave(file.absolutePath)
        file.delete()
        require(wave.sampleRate == SAMPLE_RATE) { "$DEBUG_INPUT must be 16 kHz mono" }
        pushed = wave.samples
        Log.i(TAG, "debug build: hearing $DEBUG_INPUT instead of the microphone")
        return
      }
      val minBuffer = AudioRecord.getMinBufferSize(
          SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      val mic = AudioRecord(
          MediaRecorder.AudioSource.VOICE_RECOGNITION,
          SAMPLE_RATE,
          AudioFormat.CHANNEL_IN_MONO,
          AudioFormat.ENCODING_PCM_16BIT,
          maxOf(minBuffer, CHUNK * 2 * 4),
      )
      if (mic.state != AudioRecord.STATE_INITIALIZED) {
        mic.release()
        throw IllegalStateException("the microphone could not be opened")
      }
      mic.startRecording()
      record = mic
    }

    fun close() {
      record?.let {
        try {
          it.stop()
        } catch (_: IllegalStateException) {
          // never started
        }
        it.release()
      }
      record = null
    }

    /** Fills `into` with the next chunk of audio; returns how many samples, < 0 on failure. */
    private fun read(into: FloatArray): Int {
      val file = pushed
      if (file != null) {
        // Real time, so the end-of-speech timer and the partial text behave
        // as they do with a voice; after the recording, silence.
        Thread.sleep(CHUNK_MS)
        val n = maxOf(0, minOf(into.size, file.size - pushedAt))
        System.arraycopy(file, pushedAt, into, 0, n)
        pushedAt += n
        into.fill(0f, n, into.size)
        return into.size
      }
      val mic = record ?: return -1
      val got = mic.read(shorts, 0, shorts.size)
      for (i in 0 until maxOf(got, 0)) into[i] = shorts[i] / 32768f
      return got
    }

    fun run() {
      val detector = vad!!
      detector.reset()
      val chunk = FloatArray(CHUNK)
      val window = FloatArray(VAD_WINDOW)
      var windowFill = 0
      var speechStart = -1
      var lastSpeech = -1
      var nextPartial = 0
      var timedOut = false
      try {
        while (!stopRequested) {
          val n = read(chunk)
          if (n < 0) throw IllegalStateException("the microphone stopped ($n)")
          if (n == 0) continue
          val base = heard.size
          heard.append(chunk, n)
          var i = 0
          while (i < n) {
            val take = minOf(VAD_WINDOW - windowFill, n - i)
            System.arraycopy(chunk, i, window, windowFill, take)
            windowFill += take
            i += take
            if (windowFill < VAD_WINDOW) continue
            windowFill = 0
            detector.acceptWaveform(window)
            if (detector.isSpeechDetected()) {
              val end = base + i
              // Speech is reported once it has lasted minSpeechDuration;
              // keep that and a little before it.
              if (speechStart < 0) speechStart = maxOf(0, end - samplesFor(250 + PREROLL_MS))
              lastSpeech = end
            }
            while (!detector.empty()) detector.pop()
          }
          val now = heard.size
          if (speechStart < 0) {
            if (now >= samplesFor(noSpeechMs)) {
              timedOut = true
              break
            }
            continue
          }
          if (now - lastSpeech >= samplesFor(endSilenceMs) || now >= samplesFor(maxMs)) break
          if (now >= nextPartial && !partialQueued) {
            nextPartial = now + samplesFor(PARTIAL_EVERY_MS)
            partialQueued = true
            val soFar = heard.copy(speechStart, now)
            worker.execute {
              try {
                val text = if (finished) "" else decode(soFar)
                if (!finished && text.isNotEmpty()) emit(EVENT_PARTIAL, text)
              } catch (e: Throwable) {
                Log.w(TAG, "partial decode failed", e)
              } finally {
                partialQueued = false
              }
            }
          }
        }
      } catch (e: Throwable) {
        Log.e(TAG, "listening failed", e)
        close()
        end()
        if (!cancelled) emit(EVENT_ERROR, e.message ?: e.toString())
        return
      }
      close()
      if (cancelled) {
        end()
        return
      }
      if (speechStart < 0) {
        end()
        emit(if (timedOut) EVENT_TIMEOUT else EVENT_RESULT, if (timedOut) null else "")
        return
      }
      val utterance = heard.copy(speechStart, minOf(heard.size, lastSpeech + samplesFor(TAIL_MS)))
      worker.execute {
        val startedAt = System.nanoTime()
        val text = try {
          decode(utterance)
        } catch (e: Throwable) {
          Log.e(TAG, "decode failed", e)
          end()
          emit(EVENT_ERROR, e.message ?: e.toString())
          return@execute
        }
        Log.i(TAG, "decoded ${utterance.size * 1000L / SAMPLE_RATE} ms of speech in ${(System.nanoTime() - startedAt) / 1_000_000} ms")
        end()
        emit(EVENT_RESULT, text)
      }
    }

    private fun end() {
      finished = true
      synchronized(this@OfflineSpeechModule) {
        if (session === this) session = null
      }
    }
  }

  /** A growable float buffer: everything heard since start(). */
  private class Samples(initial: Int) {
    private var data = FloatArray(initial)
    var size = 0
      private set

    fun append(src: FloatArray, n: Int) {
      if (size + n > data.size) data = data.copyOf(maxOf(data.size * 2, size + n))
      System.arraycopy(src, 0, data, size, n)
      size += n
    }

    fun copy(from: Int, to: Int): FloatArray = data.copyOfRange(from, to)
  }

  private fun ReadableMap.intOr(key: String, fallback: Int) =
      if (hasKey(key) && !isNull(key)) getDouble(key).toInt() else fallback

  companion object {
    const val NAME = "OfflineSpeech"
    private const val TAG = "AgriLogSpeech"
    private const val MODEL_DIR = "asr-vi"
    private val MODEL_FILES = listOf("encoder.onnx", "decoder.onnx", "joiner.onnx", "tokens.txt", "silero_vad.onnx")
    private const val DEBUG_INPUT = "asr-input.wav"

    private const val SAMPLE_RATE = 16_000
    private const val CHUNK_MS = 100L
    private const val CHUNK = SAMPLE_RATE / 10
    private const val VAD_WINDOW = 512
    private const val PREROLL_MS = 300
    private const val TAIL_MS = 200
    private const val PARTIAL_EVERY_MS = 700

    const val EVENT_PARTIAL = "OfflineSpeech.partial"
    const val EVENT_RESULT = "OfflineSpeech.result"
    const val EVENT_TIMEOUT = "OfflineSpeech.timeout"
    const val EVENT_ERROR = "OfflineSpeech.error"

    private fun samplesFor(ms: Int) = SAMPLE_RATE / 1000 * ms
  }
}

/**
 * Màn hình 04 — Đang phân tích.
 *
 * Design reference: screen "04 Đang phân tích" — pulsing leaf disc, step list,
 * progress bar.
 *
 * This screen is where Điều 3 actually lands. With a connection it uploads and
 * hands the result to the result screen. With no connection it writes a row to
 * `pending_diagnoses` and moves on **without an error, a toast, or a dead end** —
 * the farmer sees the result screen in its waiting state and the queue processor
 * finishes the job later.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StatusBar, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaView} from 'react-native-safe-area-context';

import {NetworkError} from '../api/client';
import {analysePhoto} from '../api/diagnoses';
import {useAuth, useChangeAuthor} from '../auth/AuthContext';
import {GhostButton} from '../components/buttons';
import {LeafMark} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import {enqueuePhoto, newDiagnosisId} from '../db/repositories/diagnosisRepository';
import type {RootStackParamList} from '../navigation/types';
import {colors, glass, gradients, radius, spacing, text} from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Analyzing'>;

const STEPS = ['Chuẩn bị ảnh', 'Gửi lên máy chủ', 'Mô hình phân tích'] as const;

const PROGRESS_COLORS = [...gradients.progress.colors] as string[];
const CARD_COLORS = [...glass.soft.gradientColors] as string[];

export function AnalyzingScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const {session} = useAuth();
  const author = useChangeAuthor();

  const [step, setStep] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  /**
   * The analysis must run EXACTLY once per mount.
   *
   * Without this guard the effect re-runs whenever any dependency changes
   * identity, and each run uploads the same photo again. The second upload then
   * loses the race, is reported as a network failure, and quietly queues a photo
   * that was already analysed — producing a duplicate diagnosis a few seconds
   * later. Refs hold the inputs so the effect can legitimately depend on nothing.
   */
  const startedRef = useRef(false);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const tokenRef = useRef(session?.token ?? null);
  tokenRef.current = session?.token ?? null;
  const authorRef = useRef(author);
  authorRef.current = author;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let alive = true;
    const current = paramsRef.current;
    const token = tokenRef.current;
    // One analysis, one id — minted here so the uploaded file, the result screen
    // and the saved row all agree, and a second save cannot duplicate the row.
    const diagnosisId = newDiagnosisId();

    (async () => {
      setStep(1);

      if (!token) {
        setFailure('Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi thử chẩn đoán.');
        return;
      }

      try {
        const result = await analysePhoto({
          photoPath: current.photoUri,
          photoMime: current.photoMime,
          plotId: current.plotId,
          clientId: diagnosisId,
          token,
        });
        if (!alive) return;

        setStep(2);
        navigation.replace('DiagnosisResult', {
          mode: 'fresh',
          plotId: current.plotId,
          photoUri: current.photoUri,
          result,
          diagnosisId,
        });
      } catch (error) {
        if (!alive) return;

        if (error instanceof NetworkError) {
          // Check `alive` BEFORE queuing, not after. A request that failed while
          // this screen was going away must not leave a photo in the queue for a
          // diagnosis the farmer has already been shown.
          if (!alive) return;

          // The whole point of Điều 3: no signal is not a failure. Queue the
          // photo and continue — no alert, no toast, no dead end.
          const queued = await enqueuePhoto(
            {
              photoPath: current.photoUri,
              photoMime: current.photoMime,
              plotId: current.plotId,
            },
            authorRef.current,
          );
          if (!alive) return;
          navigation.replace('DiagnosisResult', {
            mode: 'pending',
            pendingId: queued.id,
            plotId: current.plotId,
            photoUri: current.photoUri,
          });
          return;
        }

        // A real server-side rejection (bad file, too large, expired token) is
        // worth telling the farmer about — retrying it forever would not help.
        setFailure((error as Error)?.message ?? 'Không phân tích được ảnh này.');
      }
    })();

    return () => {
      alive = false;
    };
    // Intentionally empty: this runs once per mount and reads its inputs from
    // refs. Listing params/session/author here would re-upload the same photo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: [1, 1.07]});
  const opacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.9, 1]});

  if (failure) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.center}>
            <Text style={[text('sectionTitleLg'), styles.title]}>Không phân tích được</Text>
            <Text style={[text('body', colors.text.alpha['72']), styles.caption]}>{failure}</Text>
            <GhostButton
              label="Chụp lại"
              onPress={() => navigation.goBack()}
              style={styles.retry}
            />
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Animated.View style={[styles.disc, {transform: [{scale}], opacity}]}>
            <LeafMark size={64} leafA={colors.lime['500']} leafB={colors.green['700']} />
          </Animated.View>

          <Text style={[text('sectionTitleLg'), styles.title]}>Đang phân tích ảnh…</Text>
          <Text style={[text('bodySm', colors.text.alpha['72']), styles.caption]}>
            Thường mất 2–4 giây tuỳ đường mạng.
          </Text>

          <View style={styles.steps}>
            {STEPS.map((label, index) => {
              const done = index < step;
              const active = index === step;
              return (
                <LinearGradient
                  key={label}
                  colors={CARD_COLORS}
                  start={glass.soft.gradientStart}
                  end={glass.soft.gradientEnd}
                  style={[styles.step, active && styles.stepActive]}>
                  <View style={[styles.mark, done ? styles.markDone : styles.markIdle]}>
                    <Text style={text('caption', colors.neutral.white)}>
                      {done ? '✓' : String(index + 1)}
                    </Text>
                  </View>
                  <Text
                    style={text(
                      'bodySm',
                      done || active ? colors.text.primary : colors.text.alpha['62'],
                    )}>
                    {label}
                  </Text>
                </LinearGradient>
              );
            })}
          </View>

          <View style={styles.track}>
            <LinearGradient
              colors={PROGRESS_COLORS}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={[styles.fill, {width: `${((step + 1) / (STEPS.length + 1)) * 100}%`}]}
            />
          </View>

          <Text style={[text('caption', colors.text.alpha['62']), styles.note]}>
            Mất mạng cũng không sao — ảnh sẽ được xếp hàng và tự gửi khi có mạng trở lại.
          </Text>
        </View>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['17'],
  },
  disc: {
    width: 136,
    height: 136,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: glass.control.borderColor,
    backgroundColor: 'rgba(255,255,255,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['17'],
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing['4'],
  },
  caption: {
    textAlign: 'center',
    marginBottom: spacing['17'],
  },
  steps: {
    width: '100%',
    gap: spacing['7'],
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['9'],
    paddingHorizontal: spacing['11'],
    paddingVertical: spacing['10'],
    borderRadius: radius['3xl'],
    borderWidth: 1,
    borderColor: glass.soft.borderColor,
  },
  stepActive: {
    borderColor: colors.green['500'],
  },
  mark: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markIdle: {
    backgroundColor: 'rgba(18,48,29,0.35)',
  },
  markDone: {
    backgroundColor: colors.green['700'],
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.track,
    marginTop: spacing['16'],
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  note: {
    marginTop: spacing['11'],
    textAlign: 'center',
  },
  retry: {
    marginTop: spacing['13'],
    paddingHorizontal: spacing['15'],
  },
});

/**
 * Giai đoạn 0 — màn hình kiểm tra nền tảng.
 *
 * Mục đích duy nhất: xác nhận design token (sinh từ shared/design/tokens.json)
 * và font Open Sans nhúng kèm đã hiển thị đúng trên thiết bị thật.
 * Màn hình Đăng nhập / Trang chủ thật được xây ở Giai đoạn 1.
 */

import React from 'react';
import {ScrollView, StatusBar, StyleSheet, Text, View, useColorScheme} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';

import {colors, gradients, halo, radius, severity, size, spacing, surface, text} from './src/theme';

const SEVERITY_KEYS = ['none', 'mild', 'moderate', 'severe'] as const;

const FONT_SAMPLES = [
  {family: 'OpenSans-Regular', label: 'Thân văn bản · 400'},
  {family: 'OpenSans-Medium', label: 'Nhấn nhẹ · 500'},
  {family: 'OpenSans-SemiBold', label: 'Phụ / meta · 600'},
  {family: 'OpenSans-Bold', label: 'Tiêu đề thẻ · 700'},
  {family: 'OpenSans-ExtraBold', label: 'Tiêu đề màn hình · 800'},
];

const APP_BG = [...gradients.appBackground.colors] as string[];
const APP_BG_STOPS = [...(gradients.appBackground.locations ?? [0, 0.52, 1])] as number[];

/**
 * The three blurred glows that sit behind the glass layer.
 * React Native has no CSS blur filter, so the radial glows are approximated by
 * large translucent circles at reduced opacity — same placement, same hues.
 */
function Halos() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.halo, styles.haloGreen]} />
      <View style={[styles.halo, styles.haloLime]} />
      <View style={[styles.halo, styles.haloAmber]} />
    </View>
  );
}

function GlassCard({children}: {children: React.ReactNode}) {
  return (
    <LinearGradient
      colors={['rgba(255,255,255,0.81)', 'rgba(255,255,255,0.38)']}
      start={{x: 0.18, y: 0}}
      end={{x: 0.82, y: 1}}
      style={[styles.card, surface('card')]}>
      {children}
    </LinearGradient>
  );
}

export default function App() {
  const isDark = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <LinearGradient
        colors={APP_BG}
        locations={APP_BG_STOPS}
        start={{x: 0.1, y: 0}}
        end={{x: 0.9, y: 1}}
        style={styles.root}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor="transparent"
          translucent
        />
        <Halos />
        <SafeAreaView style={styles.root}>
          <ScrollView contentContainerStyle={styles.scroll}>
            <Text style={text('screenTitle')}>AgriLog v2</Text>
            <Text style={[text('metaSm', colors.text.alpha['74']), styles.subtitle]}>
              Giai đoạn 0 · nền tảng đã dựng xong
            </Text>

            <GlassCard>
              <Text style={text('eyebrow', colors.green['700'])}>Design token</Text>
              <Text style={[text('cardTitleLg'), styles.cardHeading]}>Thẻ kính — glass.card</Text>
              <Text style={text('body', colors.text.alpha['74'])}>
                Nền gradient trắng trong mờ, viền sáng mảnh, bóng mềm. Giá trị lấy từ
                shared/design/tokens.json — không hard-code trong component.
              </Text>
            </GlassCard>

            <Text style={[text('groupTitle'), styles.sectionTitle]}>Mức độ bệnh</Text>
            <View style={styles.chipRow}>
              {SEVERITY_KEYS.map(key => (
                <View key={key} style={[styles.chip, {backgroundColor: severity[key].bg}]}>
                  <Text style={text('badge', severity[key].fg)}>{severity[key].label}</Text>
                </View>
              ))}
            </View>
            <Text style={[text('caption', colors.text.alpha['68']), styles.note]}>
              Mức Nặng cố ý dùng nền đặc để đọc được khi liếc nhanh ngoài nắng.
            </Text>

            <Text style={[text('groupTitle'), styles.sectionTitle]}>
              Chữ — Open Sans nhúng kèm
            </Text>
            <GlassCard>
              {FONT_SAMPLES.map(sample => (
                <Text
                  key={sample.family}
                  style={[styles.fontSample, {fontFamily: sample.family}]}>
                  Cà chua mốc sương muộn — {sample.label}
                </Text>
              ))}
            </GlassCard>

            <Text style={[text('caption', colors.text.alpha['62']), styles.footer]}>
              Vùng chạm tối thiểu {size.minTouchTarget}dp · ô nhập cao tối thiểu{' '}
              {size.inputMinHeight}px.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    padding: spacing['11'],
    paddingTop: spacing['13'],
    paddingBottom: spacing['18'],
    gap: spacing['6'],
  },
  subtitle: {
    marginBottom: spacing['8'],
  },
  card: {
    padding: spacing['12'],
    borderRadius: radius['6xl'],
    gap: spacing['2'],
  },
  cardHeading: {
    marginTop: spacing['1'],
  },
  sectionTitle: {
    marginTop: spacing['10'],
    marginBottom: spacing['4'],
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['4'],
  },
  chip: {
    paddingHorizontal: spacing['9'],
    paddingVertical: spacing['3'],
    borderRadius: radius.pill,
  },
  note: {
    marginTop: spacing['2'],
  },
  fontSample: {
    fontSize: 15,
    color: colors.text.primary,
    marginBottom: spacing['1'],
  },
  footer: {
    marginTop: spacing['13'],
  },
  halo: {
    position: 'absolute',
    borderRadius: radius.pill,
    opacity: 0.9,
  },
  haloGreen: {
    top: halo.green.top,
    left: halo.green.left,
    width: halo.green.size,
    height: halo.green.size,
    backgroundColor: 'rgba(84,169,106,0.28)',
  },
  haloLime: {
    top: halo.lime.top,
    right: halo.lime.right,
    width: halo.lime.size,
    height: halo.lime.size,
    backgroundColor: 'rgba(195,210,74,0.24)',
  },
  haloAmber: {
    bottom: halo.amber.bottom,
    left: halo.amber.left,
    width: halo.amber.size,
    height: halo.amber.size,
    backgroundColor: 'rgba(242,161,4,0.18)',
  },
});

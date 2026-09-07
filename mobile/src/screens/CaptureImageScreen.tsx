/**
 * Màn hình 03 — Chụp / chọn ảnh chẩn đoán.
 *
 * Design reference: screen "03 Chụp ảnh" — dark photo frame with corner marks,
 * shooting-tip chips, a plot chip row, then the gradient primary action and the
 * translucent "tải ảnh từ thư viện" pill.
 *
 * Photos are downscaled to 600×600 at pick time. A modern phone camera produces
 * a 4–8 MB file; sending that over one bar of rural signal is the difference
 * between a diagnosis arriving and a diagnosis timing out.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useState} from 'react';
import {
  Alert,
  Image,
  PermissionsAndroid,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {Asset, ImageLibraryOptions} from 'react-native-image-picker';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Path} from 'react-native-svg';

import {useCurrentUser} from '../auth/AuthContext';
import {GhostButton, IconButton, PrimaryButton} from '../components/buttons';
import {CameraIcon, ChevronLeft} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import type Plot from '../db/models/Plot';
import {observePlots} from '../db/repositories/plotRepository';
import {useObservable} from '../db/useObservable';
import type {RootStackParamList} from '../navigation/types';
import {colors, glass, radius, size, spacing, text} from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CaptureImage'>;

/** Long edge the photo is downscaled to before upload. */
const MAX_EDGE = 600;

const PICKER_OPTIONS: ImageLibraryOptions = {
  mediaType: 'photo',
  maxWidth: MAX_EDGE,
  maxHeight: MAX_EDGE,
  quality: 0.8,
  includeBase64: false,
};

const TIPS = ['Chụp gần 20–30 cm', 'Đủ sáng, không ngược nắng', 'Lấy nét vào vết bệnh'];

interface Picked {
  uri: string;
  mime: string;
  width?: number;
  height?: number;
  fileSize?: number;
}

export function CaptureImageScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);
  const [plotId, setPlotId] = useState<string | null>(params?.plotId ?? null);
  const [photo, setPhoto] = useState<Picked | null>(null);

  const selectedPlot = plots.find(p => p.id === plotId) ?? null;

  const accept = useCallback((asset: Asset | undefined) => {
    if (!asset?.uri) return;
    setPhoto({
      uri: asset.uri,
      mime: asset.type ?? 'image/jpeg',
      width: asset.width,
      height: asset.height,
      fileSize: asset.fileSize,
    });
  }, []);

  const takePhoto = useCallback(async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
        title: 'Cho phép dùng máy ảnh',
        message: 'AgriLog cần máy ảnh để chụp lá cây và chẩn đoán bệnh.',
        buttonPositive: 'Đồng ý',
        buttonNegative: 'Không',
      });
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Chưa có quyền máy ảnh',
          'Bạn vẫn có thể chọn ảnh có sẵn trong thư viện để chẩn đoán.',
        );
        return;
      }
    }

    const response = await launchCamera({...PICKER_OPTIONS, saveToPhotos: false});
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Không mở được máy ảnh', response.errorMessage ?? 'Thử chọn ảnh từ thư viện.');
      return;
    }
    accept(response.assets?.[0]);
  }, [accept]);

  const pickFromLibrary = useCallback(async () => {
    const response = await launchImageLibrary(PICKER_OPTIONS);
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Không mở được thư viện ảnh', response.errorMessage ?? 'Thử lại sau.');
      return;
    }
    accept(response.assets?.[0]);
  }, [accept]);

  const proceed = useCallback(() => {
    if (!photo) return;
    if (!plotId) {
      Alert.alert('Chọn lô đất', 'Chọn lô đất để gắn kết quả chẩn đoán này vào.');
      return;
    }
    navigation.navigate('Analyzing', {
      plotId,
      photoUri: photo.uri,
      photoMime: photo.mime,
    });
  }, [photo, plotId, navigation]);

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <IconButton accessibilityLabel="Quay lại" onPress={() => navigation.goBack()}>
              <ChevronLeft />
            </IconButton>
            <Text style={text('screenHeading')}>Chụp ảnh chẩn đoán</Text>
          </View>

          <View style={styles.frame}>
            {photo ? (
              <Image
                source={{uri: photo.uri}}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="Ảnh lá đã chọn"
              />
            ) : (
              <View style={styles.placeholder}>
                <CameraIcon size={44} body="rgba(255,255,255,0.72)" lens="#081711" />
                <Text style={[text('metaSm', 'rgba(255,255,255,0.78)'), styles.placeholderText]}>
                  Chưa có ảnh — chụp hoặc chọn từ thư viện
                </Text>
              </View>
            )}

            <Svg
              viewBox="0 0 370 312"
              preserveAspectRatio="none"
              style={StyleSheet.absoluteFill}
              pointerEvents="none">
              <Path d="M96 84h-24v-24" fill="none" stroke="#F1F6EF" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
              <Path d="M274 84h24v-24" fill="none" stroke="#F1F6EF" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
              <Path d="M96 228h-24v24" fill="none" stroke="#F1F6EF" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
              <Path d="M274 228h24v24" fill="none" stroke="#F1F6EF" strokeWidth={4} strokeLinecap="round" opacity={0.9} />
            </Svg>

            <View style={styles.hintWrap} pointerEvents="none">
              <Text style={[text('metaSm'), styles.hint]}>
                {photo ? 'Ảnh đã sẵn sàng' : 'Đưa một lá vào giữa khung'}
              </Text>
            </View>
          </View>

          <View style={styles.tips}>
            {TIPS.map(tip => (
              <View key={tip} style={styles.tipChip}>
                <Text style={text('caption', colors.lime['800'])}>{tip}</Text>
              </View>
            ))}
          </View>

          <Text style={[text('meta', colors.text.alpha['74']), styles.sectionLabel]}>
            Gán vào lô đất
          </Text>
          {plots.length === 0 ? (
            <Text style={[text('caption', colors.text.alpha['68']), styles.noPlots]}>
              Chưa có lô đất nào. Thêm lô đất trước khi chẩn đoán để kết quả được lưu đúng chỗ.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.plotScroll}
              contentContainerStyle={styles.plotRow}>
              {plots.map(plot => {
                const selected = plot.id === plotId;
                return (
                  <Pressable
                    key={plot.id}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    onPress={() => setPlotId(plot.id)}
                    style={[styles.plotChip, selected ? styles.plotChipOn : styles.plotChipOff]}>
                    <Text
                      numberOfLines={1}
                      style={text('meta', selected ? colors.neutral.white : colors.text.alpha['74'])}>
                      {plot.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {photo ? (
            <PrimaryButton
              label="Tiếp tục"
              onPress={proceed}
              withArrow
              style={styles.primary}
            />
          ) : (
            <PrimaryButton
              label="Chụp ảnh"
              onPress={takePhoto}
              withArrow
              icon={<CameraIcon size={24} body="#2E6F40" lens="#F1F6EF" />}
              style={styles.primary}
            />
          )}

          <GhostButton
            label={photo ? 'Chọn ảnh khác' : 'Tải ảnh từ thư viện'}
            onPress={pickFromLibrary}
            style={styles.secondary}
          />
          {photo ? (
            <GhostButton label="Chụp lại" onPress={takePhoto} style={styles.secondary} />
          ) : null}

          <Text style={[text('caption', colors.text.alpha['62']), styles.footnote]}>
            Ảnh được thu nhỏ về {MAX_EDGE}×{MAX_EDGE} trước khi gửi để tiết kiệm dữ liệu —
            giới hạn 10 MB mỗi ảnh.
            {selectedPlot ? ` Kết quả sẽ lưu vào lô "${selectedPlot.name}".` : ''}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['18'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    marginBottom: spacing['11'],
  },
  frame: {
    width: '100%',
    height: 312,
    borderRadius: radius['8xl'],
    overflow: 'hidden',
    backgroundColor: colors.neutral.photoBackdrop,
    borderWidth: 1,
    borderColor: glass.control.borderColor,
    marginBottom: spacing['11'],
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['6'],
    paddingHorizontal: spacing['15'],
  },
  placeholderText: {
    textAlign: 'center',
  },
  hintWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: spacing['11'],
    alignItems: 'center',
  },
  hint: {
    paddingHorizontal: spacing['11'],
    paddingVertical: spacing['4'],
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.78)',
    color: colors.text.primary,
  },
  tips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['3'],
    marginBottom: spacing['13'],
  },
  tipChip: {
    paddingHorizontal: spacing['9'],
    paddingVertical: spacing['3'],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(195,210,74,.14)',
    borderWidth: 1,
    borderColor: 'rgba(195,210,74,.22)',
  },
  sectionLabel: {
    marginBottom: spacing['6'],
  },
  noPlots: {
    marginBottom: spacing['11'],
  },
  plotScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: spacing['13'],
  },
  plotRow: {
    gap: spacing['4'],
    alignItems: 'center',
  },
  plotChip: {
    minHeight: size.minTouchTarget,
    maxWidth: 220,
    paddingHorizontal: spacing['12'],
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plotChipOff: {
    borderColor: glass.control.borderColor,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  plotChipOn: {
    borderColor: colors.green['700'],
    backgroundColor: colors.green['700'],
  },
  primary: {
    marginBottom: spacing['6'],
  },
  secondary: {
    marginBottom: spacing['6'],
  },
  footnote: {
    marginTop: spacing['8'],
  },
});

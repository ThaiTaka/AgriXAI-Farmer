/**
 * V2.1 — Danh sách hướng dẫn chăm sóc (video), lọc theo cây.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {SelectChip} from '../../components/form';
import {VideoIcon} from '../../components/icons';
import {IconTile} from '../../components/IconTile';
import {ListRow} from '../../components/ListRow';
import {Screen} from '../../components/Screen';
import type CareGuide from '../../db/models/CareGuide';
import {observeCareGuides} from '../../db/repositories/careGuideRepository';
import {useObservableReady} from '../../db/useObservable';
import {isYoutubeId, parseSteps} from '../../domain/careGuide';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {cropNameOf} from '../../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CareGuides'>;

export function CareGuideListScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const [crop, setCrop] = useState<string | null>(params?.cropType ?? null);
  const {value: guides, ready} = useObservableReady<CareGuide[]>(() => observeCareGuides(null), [], []);

  const crops = useMemo(() => [...new Set(guides.map(g => g.cropType))], [guides]);
  const shown = crop ? guides.filter(g => g.cropType === crop) : guides;

  return (
    <Screen>
      <AppHeader title="Hướng dẫn chăm sóc" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {crops.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipRow}>
            <SelectChip label="Tất cả" selected={crop === null} onPress={() => setCrop(null)} style={styles.chip} />
            {crops.map(c => (
              <SelectChip key={c} label={cropNameOf(c)} selected={crop === c} onPress={() => setCrop(c)} style={styles.chip} />
            ))}
          </ScrollView>
        ) : null}

        {!ready ? (
          <ActivityIndicator color={colors.primary.default} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<VideoIcon size={28} />}
            title="Chưa có hướng dẫn"
            body={
              crop
                ? `Chưa có hướng dẫn cho ${cropNameOf(crop).toLowerCase()}. Quản trị viên đăng thêm trên trang quản trị; hướng dẫn mới tự về máy khi đồng bộ.`
                : 'Quản trị viên đăng hướng dẫn có video trên trang quản trị; hướng dẫn tự về máy khi đồng bộ.'
            }
          />
        ) : (
          <Card flush style={styles.card}>
            {shown.map((g, index) => {
              const steps = parseSteps(g.stepsJson).length;
              const bits = [
                cropNameOf(g.cropType),
                isYoutubeId(g.youtubeId) ? 'có video' : null,
                steps ? `${steps} bước` : null,
              ].filter(Boolean);
              return (
                <ListRow
                  key={g.id}
                  testID={`guide-${g.id}`}
                  title={g.title}
                  subtitle={bits.join(' · ')}
                  last={index === shown.length - 1}
                  leading={
                    <IconTile size={40}>
                      <VideoIcon />
                    </IconTile>
                  }
                  onPress={() => navigation.navigate('CareGuide', {guideId: g.id})}
                />
              );
            })}
          </Card>
        )}
        <View style={styles.footer}>
          <Text style={text('bodySm', colors.text.muted)}>
            Chữ và các bước đọc được khi không có mạng. Video và ảnh cần mạng để tải lần đầu.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  chipRow: {
    marginBottom: space.lg,
  },
  chips: {
    gap: space.sm,
    paddingRight: space.lg,
  },
  chip: {
    flex: 0,
    paddingHorizontal: space.md,
  },
  card: {
    overflow: 'hidden',
  },
  footer: {
    marginTop: space.lg,
  },
});

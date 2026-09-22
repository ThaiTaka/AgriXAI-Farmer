/**
 * F5–F6 — Quy trình chăm sóc.
 *
 * Pick a crop + variety (three-step picker) or one of your plots, and the
 * screen shows the sourced protocol for that crop/category as a four-stage
 * accordion with tick-off tasks. Crops without an official protocol show
 * "Chưa có dữ liệu" with the reason and where to look — never a made-up
 * schedule.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {PickerField, SelectChip} from '../../components/form';
import {ChevronRight, ClipboardIcon, ExternalLinkIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import type Plot from '../../db/models/Plot';
import {observePlots} from '../../db/repositories/plotRepository';
import {useObservable} from '../../db/useObservable';
import type {CareProtocol} from '../../domain/careProtocol';
import {citation, protocolAvailability, stageForGrowth, stageForMonth} from '../../domain/careProtocol';
import type {PickedVariety, RootStackParamList} from '../../navigation/types';
import {colors, size, space, text} from '../../theme';
import {inferGrowthStage} from '../../utils/growthStage';
import {cropNameOf, cropTypeById} from '../../utils/staticData';
import {CareStageAccordion} from './CareStageAccordion';
import {ProtocolUnavailable} from './ProtocolUnavailable';
import {useCategoryOf} from './useCategoryOf';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'CareProtocol'>;

interface Selection {
  cropType: string;
  cropName: string;
  categoryId: string | null;
  varietyId: string | null;
  varietyName: string | null;
  plotId: string | null;
  plantedAt: number | null;
}

export function CareProtocolScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(params?.protocolId ?? null);

  // Opened from a plot: use what the plot already knows.
  useEffect(() => {
    if (!params?.plotId) return;
    const plot = plots.find(p => p.id === params.plotId);
    if (plot) setSelection(fromPlot(plot));
  }, [params?.plotId, plots]);

  // Back from the picker: the chosen crop/variety, no plot.
  useEffect(() => {
    const picked: PickedVariety | undefined = params?.pickedVariety;
    if (!picked) return;
    setSelection({
      cropType: picked.cropType,
      cropName: picked.cropName,
      categoryId: picked.categoryId,
      varietyId: picked.varietyId,
      varietyName: picked.varietyName,
      plotId: null,
      plantedAt: null,
    });
    setProtocolId(null);
  }, [params?.pickedVariety]);

  const resolvedCategory = useCategoryOf(selection?.varietyId);
  const categoryId = selection?.categoryId ?? resolvedCategory;

  const availability = useMemo(
    () => (selection ? protocolAvailability(selection.cropType, categoryId) : null),
    [selection, categoryId],
  );
  const protocols = availability?.protocols ?? [];
  const protocol: CareProtocol | undefined =
    protocols.find(p => p.id === protocolId) ?? protocols[0];

  const currentStage = useMemo(() => {
    if (!protocol) return null;
    if (protocol.stage_model === 'calendar') {
      return stageForMonth(protocol, new Date().getMonth() + 1) ?? null;
    }
    const inferred = selection?.plantedAt ? inferGrowthStage(selection.plantedAt) : null;
    return inferred ? (stageForGrowth(protocol, inferred.stage) ?? null) : null;
  }, [protocol, selection?.plantedAt]);

  const openPicker = useCallback(() => {
    navigation.navigate('VarietyCropType', {selectedId: selection?.varietyId ?? null, returnTo: 'CareProtocol'});
  }, [navigation, selection?.varietyId]);

  const cropValue = selection
    ? selection.varietyName
      ? `${selection.cropName} · ${selection.varietyName}`
      : selection.cropName
    : '';

  return (
    <Screen>
      <AppHeader eyebrow="Chăm sóc theo giai đoạn" title="Quy trình chăm sóc" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <PickerField
          testID="care-crop"
          label="Cây trồng & giống"
          value={cropValue}
          placeholder="Chọn loại cây → loại → giống"
          onPress={openPicker}
          icon={<ChevronRight />}
          style={styles.field}
        />

        {plots.length > 0 ? (
          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Hoặc chọn lô đất của bạn</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {plots.map(plot => (
                <SelectChip
                  key={plot.id}
                  label={`${plot.name} · ${cropNameOf(plot.cropType, plot.cropName)}`}
                  selected={selection?.plotId === plot.id}
                  onPress={() => {
                    setSelection(fromPlot(plot));
                    setProtocolId(null);
                  }}
                  style={styles.chip}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!selection ? (
          <EmptyState
            icon={<ClipboardIcon color={colors.gray['400']} />}
            title="Chọn cây để xem quy trình"
            body="Quy trình gồm 4 giai đoạn với công việc, liều lượng và thời điểm bón, lấy từ nguồn chính thức và ghi rõ nguồn."
          />
        ) : !protocol ? (
          <ProtocolUnavailable cropName={selection.cropName} entry={availability?.unavailable ?? null} />
        ) : (
          <>
            {protocols.length > 1 ? (
              // Chip cuộn ngang thay vì segment chia đều: tên cơ quan ban hành
              // quá dài để cắt đều ba phần mà còn đọc được.
              <View style={styles.field}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {protocols.map(p => (
                    <SelectChip
                      key={p.id}
                      label={shortName(p)}
                      selected={protocol.id === p.id}
                      onPress={() => setProtocolId(p.id)}
                      style={styles.chip}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <Card style={styles.sourceCard} testID="care-source">
              <View style={styles.sourceHead}>
                <Text style={[text('cardTitle'), styles.sourceTitle]} numberOfLines={3}>
                  {protocol.name}
                </Text>
                <Badge label={protocol.stage_model === 'calendar' ? '4 đợt/năm' : '4 giai đoạn'} tone="green" />
              </View>
              <Text style={[text('bodySm', colors.text.muted), styles.sourceLine]}>{citation(protocol)}</Text>
              {currentStage ? (
                <Text style={[text('bodySm', colors.text.secondary), styles.sourceLine]}>
                  {protocol.stage_model === 'calendar'
                    ? `Tháng ${new Date().getMonth() + 1} rơi vào: ${currentStage.stage_name_vi}`
                    : `Ước tính từ ngày trồng: ${currentStage.stage_name_vi}`}
                </Text>
              ) : selection.plotId && protocol.stage_model === 'growth' ? (
                <Text style={[text('bodySm', colors.text.muted), styles.sourceLine]}>
                  Nhập ngày trồng cho lô để ứng dụng đánh dấu giai đoạn hiện tại.
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Mở nguồn"
                onPress={() => Linking.openURL(protocol.source.url).catch(() => {})}
                style={({pressed}) => [styles.sourceLink, pressed && styles.sourceLinkPressed]}>
                <Text style={[text('bodySm', colors.primary.default), styles.sourceLinkText]} numberOfLines={1}>
                  {protocol.source.url}
                </Text>
                <ExternalLinkIcon />
              </Pressable>
            </Card>

            <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>
              {selection.plotId ? 'Công việc cho lô này' : 'Công việc theo giai đoạn'}
            </Text>
            <CareStageAccordion
              protocol={protocol}
              plotId={selection.plotId}
              currentStageCode={currentStage?.stage_code ?? null}
            />

            {protocol.base_application.note ? (
              <Card style={styles.noteCard}>
                <Text style={text('eyebrow', colors.text.muted)}>Bón lót / hữu cơ</Text>
                <Text style={[text('bodySm', colors.text.secondary), styles.noteBody]}>
                  {protocol.base_application.note}
                </Text>
              </Card>
            ) : null}

            {protocol.extra_rules.length > 0 ? (
              <Card style={styles.noteCard}>
                <Text style={text('eyebrow', colors.text.muted)}>Quy tắc bổ sung của nguồn</Text>
                {protocol.extra_rules.map((rule, index) => (
                  <Text key={index} style={[text('bodySm', colors.text.secondary), styles.noteBody]}>
                    • {rule}
                  </Text>
                ))}
              </Card>
            ) : null}

            <Text style={[text('caption', colors.text.muted), styles.disclaimer]}>{protocol.disclaimer}</Text>
            <Text style={[text('caption', colors.text.muted), styles.disclaimer]}>
              Công việc gợi ý chỉ để bạn đối chiếu; đánh dấu "Đã làm" là xác nhận của bạn — ứng dụng không
              tự ghi nhật ký. Lưu trên máy, đồng bộ khi có mạng.
            </Text>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function fromPlot(plot: Plot): Selection {
  return {
    cropType: plot.cropType,
    cropName: cropNameOf(plot.cropType, plot.cropName),
    categoryId: null,
    varietyId: plot.varietyId,
    varietyName: plot.varietyName,
    plotId: plot.id,
    plantedAt: plot.plantedAt,
  };
}

/** Segment label: publisher's short name + year. */
function shortName(protocol: CareProtocol): string {
  const year = protocol.source.published_at?.slice(0, 4);
  const crop = cropTypeById(protocol.crop_type)?.name ?? protocol.crop_name;
  const publisher = protocol.source.publisher.split(/[—(,]/)[0].trim();
  const words = publisher.split(/\s+/);
  // Cắt 4 từ hay để lại từ nối treo ("Báo Nông nghiệp và") — bỏ nó đi.
  const short = words.length > 4 ? words.slice(0, 4).join(' ').replace(/\s+(và|các|của|thuộc|tại)$/i, '') : publisher;
  return year ? `${short} ${year}` : `${crop} · ${short}`;
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  field: {
    marginBottom: space.lg,
  },
  label: {
    marginBottom: space.sm,
  },
  chips: {
    gap: space.sm,
    paddingRight: space.lg,
  },
  chip: {
    flex: 0,
    paddingHorizontal: space.md,
  },
  sourceCard: {
    marginBottom: space.lg,
  },
  sourceHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  sourceTitle: {
    flex: 1,
  },
  sourceLine: {
    marginTop: space.sm,
  },
  sourceLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
    minHeight: size.minTouchTarget,
    paddingVertical: space.sm,
  },
  sourceLinkPressed: {
    opacity: 0.7,
  },
  sourceLinkText: {
    flex: 1,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  noteCard: {
    marginTop: space.md,
  },
  noteBody: {
    marginTop: space.xs,
  },
  disclaimer: {
    marginTop: space.lg,
  },
});

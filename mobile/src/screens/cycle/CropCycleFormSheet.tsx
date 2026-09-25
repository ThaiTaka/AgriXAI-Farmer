/**
 * Vụ trồng — one sheet, four jobs:
 *
 *   create  bắt đầu vụ mới (the crop going in now)
 *   past    ghi lại vụ đã qua (a finished season written down after the fact)
 *   end     kết thúc vụ (harvest date, yield, harvest photos)
 *   edit    sửa một vụ (anything, including deleting it)
 *
 * The name fills itself in ("Vụ Xuân 2026 — Cà chua") until the farmer types
 * their own. Creating a season with a different crop moves the plot to that
 * crop, so the care tab follows the new season.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../../auth/AuthContext';
import {DangerButton, IconButton, PrimaryButton} from '../../components/buttons';
import {DateField} from '../../components/DateField';
import {Field, SelectChip} from '../../components/form';
import {CloseIcon} from '../../components/icons';
import {MediaCaptureBar} from '../../components/MediaCaptureBar';
import {MediaStrip} from '../../components/MediaStrip';
import type CropCycle from '../../db/models/CropCycle';
import type Plot from '../../db/models/Plot';
import {
  createCycle,
  deleteCycle,
  endCycle,
  plotAreaM2,
  recordPastCycle,
  updateCycle,
} from '../../db/repositories/cropCycleRepository';
import {plotToInput, updatePlot} from '../../db/repositories/plotRepository';
import type {CycleLike, Season} from '../../domain/cultivation';
import {cycleSeason, recommendCrops, seasonOf, SEASONS, suggestCycleName} from '../../domain/cultivation';
import {parseDecimal} from '../../domain/labor';
import type {MediaRef} from '../../domain/media';
import {parseMediaRefs, serializeMediaRefs} from '../../domain/media';
import {deleteLocalMedia} from '../../media/mediaStore';
import {colors, radius, space, text} from '../../theme';
import {allCropTypes, cropNameOf} from '../../utils/staticData';

export type CycleSheetMode = 'create' | 'past' | 'end' | 'edit';

interface Props {
  visible: boolean;
  onClose: () => void;
  plot: Plot;
  cycle?: CropCycle;
  mode: CycleSheetMode;
  /** The plot's seasons so far — the suggestion follows the season picked in the form. */
  history?: readonly CycleLike[];
}

const TITLES: Record<CycleSheetMode, string> = {
  create: 'Bắt đầu vụ mới',
  past: 'Ghi lại vụ đã qua',
  end: 'Kết thúc vụ',
  edit: 'Sửa vụ trồng',
};

const DAY = 86_400_000;

export function CropCycleFormSheet({visible, onClose, plot, cycle, mode, history = []}: Props) {
  const author = useChangeAuthor();
  const editing = mode === 'edit' && cycle;
  const finished = mode === 'past' || mode === 'end' || (mode === 'edit' && cycle?.endedAt != null);

  const initial = useMemo(() => {
    const now = Date.now();
    return {
      name: editing ? cycle.name : '',
      cropType: cycle?.cropType ?? plot.cropType,
      cropName: cycle?.cropName ?? (cycle ? null : plot.cropName),
      varietyName: cycle?.varietyName ?? (mode === 'create' ? (plot.varietyName ?? '') : ''),
      startedAt: cycle?.startedAt ?? (mode === 'past' ? now - 120 * DAY : now),
      endedAt: cycle?.endedAt ?? now,
      season: (cycle ? cycleSeason(cycle) : seasonOf(mode === 'past' ? now - 120 * DAY : now)) as Season,
      yieldKg: cycle?.yieldKg != null ? String(cycle.yieldKg) : '',
      areaM2: String(Math.round(cycle?.areaM2 ?? plotAreaM2(plot) ?? 0) || ''),
      notes: cycle?.notes ?? '',
      media: parseMediaRefs(cycle?.mediaJson),
    };
    // Re-seeded each time the sheet opens for a (possibly different) cycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cycle?.id, mode]);

  const [name, setName] = useState(initial.name);
  const [nameTouched, setNameTouched] = useState(false);
  const [cropType, setCropType] = useState(initial.cropType);
  const [cropName, setCropName] = useState<string | null>(initial.cropName);
  const [varietyName, setVarietyName] = useState(initial.varietyName);
  const [season, setSeason] = useState<Season>(initial.season);
  const [seasonTouched, setSeasonTouched] = useState(false);
  const [startedAt, setStartedAt] = useState(initial.startedAt);
  const [endedAt, setEndedAt] = useState(initial.endedAt);
  const [yieldKg, setYieldKg] = useState(initial.yieldKg);
  const [areaM2, setAreaM2] = useState(initial.areaM2);
  const [notes, setNotes] = useState(initial.notes);
  const [media, setMedia] = useState<MediaRef[]>(initial.media);
  const [removed, setRemoved] = useState<MediaRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(initial.name);
    setNameTouched(Boolean(initial.name));
    setCropType(initial.cropType);
    setCropName(initial.cropName);
    setVarietyName(initial.varietyName);
    setSeason(initial.season);
    setSeasonTouched(Boolean(cycle));
    setStartedAt(initial.startedAt);
    setEndedAt(initial.endedAt);
    setYieldKg(initial.yieldKg);
    setAreaM2(initial.areaM2);
    setNotes(initial.notes);
    setMedia(initial.media);
    setRemoved([]);
    setError(null);
  }, [initial, cycle]);

  const displayCrop = cropNameOf(cropType, cropName);
  const autoName = suggestCycleName(season, startedAt, displayCrop);
  const shownName = nameTouched ? name : autoName;

  // Catalogue crops, plus this plot's own crop when the farmer invented it.
  const crops = useMemo(() => {
    const list = allCropTypes().map(c => ({id: c.id, name: c.name}));
    if (!list.some(c => c.id === plot.cropType)) list.unshift({id: plot.cropType, name: cropNameOf(plot.cropType, plot.cropName)});
    if (cycle && !list.some(c => c.id === cycle.cropType)) list.unshift({id: cycle.cropType, name: cropNameOf(cycle.cropType, cycle.cropName)});
    return list;
  }, [plot.cropType, plot.cropName, cycle]);

  const pickCrop = (id: string, label: string) => {
    setCropType(id);
    setCropName(id === plot.cropType ? plot.cropName : cropNameOf(id) === label ? null : label);
  };

  const changeStart = (value: number) => {
    setStartedAt(value);
    if (!seasonTouched) setSeason(seasonOf(value));
  };

  const close = () => {
    // Photos taken in this sheet but never saved would otherwise stay on disk.
    const saved = new Set(initial.media.map(m => m.id));
    deleteLocalMedia(media.filter(m => !saved.has(m.id))).catch(() => {});
    onClose();
  };

  const submit = async () => {
    setError(null);
    const finalName = shownName.trim();
    const yieldNum = yieldKg.trim() ? parseDecimal(yieldKg) : null;
    const areaNum = areaM2.trim() ? parseDecimal(areaM2) : null;
    if (mode !== 'end' && !finalName) return setError('Tên vụ không được để trống.');
    if (yieldKg.trim() && (yieldNum == null || yieldNum < 0)) return setError('Sản lượng phải là một số không âm.');
    if (areaM2.trim() && (areaNum == null || areaNum <= 0)) return setError('Diện tích phải lớn hơn 0.');
    const start = cycle && mode === 'end' ? cycle.startedAt : startedAt;
    if (finished && endedAt < start) return setError('Ngày kết thúc không được trước ngày xuống giống.');

    const mediaJson = serializeMediaRefs(media);
    setLoading(true);
    try {
      if (mode === 'create') {
        const cropChanged = cropType !== plot.cropType;
        await createCycle(
          plot,
          {
            name: finalName,
            cropType,
            cropName: cropName ?? displayCrop,
            varietyId: cropChanged ? null : plot.varietyId,
            varietyName: varietyName.trim() || null,
            stage: 'seedling',
            startedAt,
            season,
            areaM2: areaNum,
            notes: notes.trim() || null,
          },
          author,
        );
        if (cropChanged) {
          await updatePlot(
            plot,
            {
              ...plotToInput(plot),
              cropType,
              cropName: cropName ?? displayCrop,
              varietyId: null,
              varietyName: varietyName.trim() || null,
              plantedAt: startedAt,
            },
            author,
          );
        }
      } else if (mode === 'past') {
        await recordPastCycle(
          plot,
          {
            name: finalName,
            cropType,
            cropName: cropName ?? displayCrop,
            varietyId: null,
            varietyName: varietyName.trim() || null,
            startedAt,
            endedAt,
            season,
            areaM2: areaNum,
            yieldKg: yieldNum,
            notes: notes.trim() || null,
            mediaJson,
          },
          author,
        );
      } else if (mode === 'end') {
        if (!cycle) throw new Error('Không tìm thấy vụ để kết thúc.');
        await endCycle(cycle, endedAt, yieldNum, author, mediaJson);
      } else if (cycle) {
        await updateCycle(
          cycle,
          {
            name: finalName,
            cropType,
            cropName: cropName ?? displayCrop,
            varietyName: varietyName.trim() || null,
            season,
            startedAt,
            endedAt: cycle.endedAt != null ? endedAt : null,
            areaM2: areaNum,
            yieldKg: yieldNum,
            notes: notes.trim() || null,
            mediaJson,
          },
          author,
        );
      }
      await deleteLocalMedia(removed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đã có lỗi xảy ra.');
    } finally {
      setLoading(false);
    }
  };

  const onDelete = () => {
    if (!cycle) return;
    Alert.alert('Xoá vụ trồng', `Xoá "${cycle.name}" khỏi lịch sử trồng trọt của lô?`, [
      {text: 'Huỷ', style: 'cancel'},
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await deleteCycle(cycle, author);
          await deleteLocalMedia(parseMediaRefs(cycle.mediaJson));
          onClose();
        },
      },
    ]);
  };

  const top = useMemo(() => recommendCrops(history, season, cropNameOf)[0], [history, season]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} presentationStyle="pageSheet">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[text('heading'), styles.headerTitle]}>{TITLES[mode]}</Text>
          <IconButton accessibilityLabel="Đóng" onPress={close}>
            <CloseIcon />
          </IconButton>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {error ? <Text style={[text('bodySm', colors.text.danger), styles.error]}>{error}</Text> : null}

          {mode === 'end' && cycle ? (
            <Text style={[text('body', colors.text.secondary), styles.lead]}>{cycle.name}</Text>
          ) : null}

          {mode === 'create' && top ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn gợi ý: ${top.cropName}`}
              testID="cycle-suggestion"
              onPress={() => pickCrop(top.cropType, top.cropName)}
              style={({pressed}) => [styles.suggestion, pressed && styles.suggestionPressed]}>
              <Text style={text('caption', colors.primary.default)}>GỢI Ý TỪ LỊCH SỬ CỦA LÔ</Text>
              <Text style={text('cardTitle')}>Trồng {top.cropName}</Text>
              <Text style={text('bodySm', colors.text.secondary)}>{top.reason}</Text>
            </Pressable>
          ) : null}

          <View style={styles.fields}>
            {mode !== 'end' ? (
              <>
                <View>
                  <Text style={[text('meta', colors.text.secondary), styles.label]}>Cây trồng</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                    {crops.map(c => (
                      <SelectChip
                        key={c.id}
                        label={c.name}
                        selected={cropType === c.id}
                        onPress={() => pickCrop(c.id, c.name)}
                        style={styles.chip}
                      />
                    ))}
                  </ScrollView>
                  {mode === 'create' && cropType !== plot.cropType ? (
                    <Text style={[text('bodySm', colors.text.secondary), styles.hint]}>
                      Lô sẽ chuyển sang trồng {displayCrop}; tab Chăm sóc theo quy trình của cây mới.
                    </Text>
                  ) : null}
                </View>
                <Field
                  label="Giống cây"
                  value={varietyName}
                  onChangeText={setVarietyName}
                  placeholder="Không bắt buộc — VD: MV1"
                />
                <DateField
                  label="Ngày xuống giống"
                  value={startedAt}
                  onChange={changeStart}
                  maximumDate={mode === 'past' ? new Date() : undefined}
                />
                <View>
                  <Text style={[text('meta', colors.text.secondary), styles.label]}>Mùa vụ</Text>
                  <View style={styles.seasonRow}>
                    {SEASONS.map(s => (
                      <SelectChip
                        key={s.code}
                        label={s.label.replace('Vụ ', '')}
                        selected={season === s.code}
                        onPress={() => {
                          setSeason(s.code);
                          setSeasonTouched(true);
                        }}
                      />
                    ))}
                  </View>
                  <Text style={[text('bodySm', colors.text.secondary), styles.hint]}>
                    Tự chọn theo tháng xuống giống ({SEASONS.find(s => s.code === season)?.months}); đổi nếu vụ của
                    bạn gọi khác.
                  </Text>
                </View>
                <Field
                  label="Tên vụ"
                  value={shownName}
                  onChangeText={v => {
                    setName(v);
                    setNameTouched(true);
                  }}
                  testID="cycle-name"
                />
              </>
            ) : null}

            {finished ? (
              <>
                <DateField label="Ngày kết thúc (thu hoạch xong)" value={endedAt} onChange={setEndedAt} maximumDate={new Date()} />
                <Field
                  label="Sản lượng thu hoạch (kg)"
                  value={yieldKg}
                  onChangeText={setYieldKg}
                  keyboardType="numeric"
                  placeholder="VD: 1200"
                  hint="Ghi sản lượng để ứng dụng tính năng suất và gợi ý cây cho vụ sau."
                  testID="cycle-yield"
                />
              </>
            ) : null}

            {mode !== 'end' ? (
              <Field
                label="Diện tích trồng (m²)"
                value={areaM2}
                onChangeText={setAreaM2}
                keyboardType="numeric"
                hint="Mặc định là diện tích lô. Sửa nếu vụ này chỉ trồng một phần lô."
              />
            ) : null}

            {finished ? (
              <View>
                <Text style={[text('meta', colors.text.secondary), styles.label]}>Ảnh thu hoạch</Text>
                <MediaCaptureBar photosOnly onAdd={refs => setMedia(prev => [...prev, ...refs])} />
                <MediaStrip
                  refs={media}
                  onRemove={ref => {
                    setMedia(prev => prev.filter(m => m.id !== ref.id));
                    if (initial.media.some(m => m.id === ref.id)) setRemoved(prev => [...prev, ref]);
                    else deleteLocalMedia([ref]).catch(() => {});
                  }}
                  style={styles.hint}
                />
              </View>
            ) : null}

            {mode !== 'end' ? (
              <Field label="Ghi chú" value={notes} onChangeText={setNotes} multiline placeholder="Không bắt buộc" />
            ) : null}
          </View>

          <View style={styles.footer}>
            <PrimaryButton label={mode === 'edit' ? 'Lưu thay đổi' : TITLES[mode]} onPress={submit} loading={loading} testID="cycle-submit" />
            {mode === 'edit' ? <DangerButton label="Xoá vụ này" onPress={onDelete} style={styles.delete} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  lead: {
    marginTop: space.sm,
  },
  suggestion: {
    marginTop: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.selected,
    backgroundColor: colors.surface.selected,
    gap: space.xs,
  },
  suggestionPressed: {
    opacity: 0.8,
  },
  fields: {
    gap: space.lg,
    marginTop: space.md,
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
  seasonRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  hint: {
    marginTop: space.sm,
  },
  footer: {
    marginTop: space.xl,
  },
  delete: {
    marginTop: space.md,
  },
  error: {
    marginBottom: space.md,
    backgroundColor: colors.badge.redBg,
    padding: space.md,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});

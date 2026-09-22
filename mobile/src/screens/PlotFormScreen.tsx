/**
 * Màn hình 09 — Thêm / sửa lô đất.
 *
 * Saving writes to SQLite and pops straight back (Điều 1) — the screen never
 * waits for the network, and there is no spinner tied to an HTTP call.
 *
 * The crop + variety field opens the three-step picker (crop type → category →
 * variety); the picker navigates back here with `pickedVariety` merged into the
 * route params, which the effect below folds into the form.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor} from '../auth/AuthContext';
import {AppHeader} from '../components/AppHeader';
import {PrimaryButton, SecondaryButton} from '../components/buttons';
import {Field, PickerField, SelectChip} from '../components/form';
import {CalendarIcon, ChevronRight} from '../components/icons';
import {Screen} from '../components/Screen';
import {collections} from '../db';
import type Plot from '../db/models/Plot';
import type {PlotStatus} from '../db/models/Plot';
import {
  createPlot,
  PLOT_STATUS_LABELS,
  resolvePlotCode,
  updatePlot,
} from '../db/repositories/plotRepository';
import type {RootStackParamList} from '../navigation/types';
import {colors, size, space, text} from '../theme';
import {formatDate} from '../utils/format';
import {isWellFormedPlotCode} from '../utils/plotCode';
import {cropNameOf} from '../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PlotForm'>;

const STATUSES: PlotStatus[] = ['active', 'fallow', 'harvested'];

interface FormState {
  code: string;
  name: string;
  region: string;
  area: string;
  areaUnit: 'm2' | 'ha';
  cropType: string;
  cropName: string;
  varietyId: string | null;
  varietyName: string;
  plantedAt: number | null;
  status: PlotStatus;
  notes: string;
}

const EMPTY: FormState = {
  code: '',
  name: '',
  region: '',
  area: '',
  areaUnit: 'm2',
  cropType: '',
  cropName: '',
  varietyId: null,
  varietyName: '',
  plantedAt: null,
  status: 'active',
  notes: '',
};

export function PlotFormScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const author = useChangeAuthor();
  const editingId = params?.plotId;
  const picked = params?.pickedVariety;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState<Plot | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit mode: load the row once and pre-fill every field.
  useEffect(() => {
    if (!editingId) return;
    let alive = true;
    (async () => {
      try {
        const plot = await collections.plots.find(editingId);
        if (!alive) return;
        setExisting(plot);
        setForm({
          code: plot.code,
          name: plot.name,
          region: plot.region ?? '',
          area: plot.area ? String(plot.area) : '',
          areaUnit: plot.areaUnit === 'ha' ? 'ha' : 'm2',
          cropType: plot.cropType,
          cropName: cropNameOf(plot.cropType, plot.cropName),
          varietyId: plot.varietyId,
          varietyName: plot.varietyName ?? '',
          plantedAt: plot.plantedAt,
          status: plot.status,
          notes: plot.notes ?? '',
        });
      } catch (error) {
        console.warn('[plotForm] could not load plot', error);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editingId]);

  // The picker hands its result back through the route params.
  useEffect(() => {
    if (!picked) return;
    setForm(prev => ({
      ...prev,
      cropType: picked.cropType,
      cropName: picked.cropName,
      varietyId: picked.varietyId,
      varietyName: picked.varietyName ?? '',
    }));
    setErrors(prev => (prev.cropType ? {...prev, cropType: undefined} : prev));
  }, [picked]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({...prev, [key]: value}));
    setErrors(prev => (prev[key] ? {...prev, [key]: undefined} : prev));
  }, []);

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) next.name = 'Tên lô đất là bắt buộc.';

    // A code the plot already carries (issued by the back office, e.g.
    // "PUC-001-HB") is valid as it is; only a newly typed code has to follow
    // the app's own PUC-YYMM-XXXX shape.
    const codeUnchanged = existing != null && form.code.trim() === (existing.code ?? '');
    if (form.code.trim() && !codeUnchanged && !isWellFormedPlotCode(form.code)) {
      next.code = 'Sai định dạng. Đúng phải là PUC-YYMM-XXXX, hoặc để trống để tự sinh.';
    }

    if (form.area.trim()) {
      const parsed = Number(form.area.replace(',', '.'));
      if (!Number.isFinite(parsed) || parsed <= 0) {
        next.area = 'Diện tích phải là số lớn hơn 0.';
      }
    } else {
      next.area = 'Nhập diện tích lô đất.';
    }

    if (!form.cropType) next.cropType = 'Chọn cây trồng cho lô đất.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form, existing]);

  const onSave = useCallback(async () => {
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const input = {
        code: await resolvePlotCode(form.code),
        name: form.name.trim(),
        region: form.region.trim() || null,
        area: Number(form.area.replace(',', '.')),
        areaUnit: form.areaUnit,
        cropType: form.cropType,
        cropName: form.cropName || null,
        varietyId: form.varietyId,
        varietyName: form.varietyName || null,
        plantedAt: form.plantedAt,
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (existing) {
        await updatePlot(existing, input, author);
      } else {
        await createPlot(input, author);
      }
      navigation.goBack();
    } catch (error) {
      console.error('[plotForm] save failed', error);
      setErrors({name: 'Không lưu được. Thử lại.'});
    } finally {
      setSaving(false);
    }
  }, [saving, validate, form, existing, author, navigation]);

  const openPicker = useCallback(() => {
    navigation.navigate('VarietyCropType', {selectedId: form.varietyId});
  }, [navigation, form.varietyId]);

  const title = editingId ? 'Sửa lô đất' : 'Thêm lô đất';
  const maxDate = useMemo(() => new Date(), []);
  const cropValue = form.cropName
    ? form.varietyName
      ? `${form.cropName} · ${form.varietyName}`
      : form.cropName
    : '';

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader title={title} onBack={() => navigation.goBack()} />

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Field
            testID="plot-name"
            label="Tên lô đất"
            value={form.name}
            onChangeText={value => set('name', value)}
            placeholder="Ví dụ: Vườn nhà trên"
            error={errors.name}
            style={styles.field}
          />

          <Field
            testID="plot-code"
            label="Mã vùng trồng (PUC)"
            value={form.code}
            onChangeText={value => set('code', value)}
            placeholder="Để trống — hệ thống tự sinh"
            autoCapitalize="characters"
            hint="Định dạng PUC-YYMM-XXXX."
            error={errors.code}
            style={styles.field}
          />

          <Field
            label="Khu vực"
            value={form.region}
            onChangeText={value => set('region', value)}
            placeholder="Xã / phường, tỉnh"
            style={styles.field}
          />

          <View style={[styles.row, styles.field]}>
            <Field
              testID="plot-area"
              label={`Diện tích (${form.areaUnit === 'ha' ? 'ha' : 'm²'})`}
              value={form.area}
              onChangeText={value => set('area', value)}
              placeholder="1200"
              keyboardType="numeric"
              error={errors.area}
              style={styles.rowItem}
            />
            <View style={styles.rowItemNarrow}>
              <Text style={[text('meta', colors.text.secondary), styles.unitLabel]}>Đơn vị</Text>
              <View style={styles.unitRow}>
                <SelectChip
                  label="m²"
                  selected={form.areaUnit === 'm2'}
                  onPress={() => set('areaUnit', 'm2')}
                  style={styles.unitChip}
                />
                <SelectChip
                  label="ha"
                  selected={form.areaUnit === 'ha'}
                  onPress={() => set('areaUnit', 'ha')}
                  style={styles.unitChip}
                />
              </View>
            </View>
          </View>

          <PickerField
            testID="plot-variety"
            label="Cây trồng & giống"
            value={cropValue}
            placeholder="Chọn loại cây → loại → giống"
            onPress={openPicker}
            icon={<ChevronRight />}
            error={errors.cropType}
            hint={
              errors.cropType
                ? undefined
                : 'Chọn theo 3 bước; có thể thêm giống mới hoặc cây trồng chưa có trong danh mục.'
            }
            style={styles.field}
          />

          <PickerField
            testID="plot-planted-at"
            label="Ngày trồng"
            value={form.plantedAt ? formatDate(form.plantedAt) : ''}
            placeholder="Chọn ngày xuống giống"
            onPress={() => setShowDatePicker(true)}
            icon={<CalendarIcon />}
            hint="Dùng để gợi ý công việc theo giai đoạn cây ở tab Chăm sóc."
            style={styles.field}
          />

          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.unitLabel]}>Trạng thái</Text>
            <View style={styles.statusRow}>
              {STATUSES.map(status => (
                <SelectChip
                  key={status}
                  label={PLOT_STATUS_LABELS[status]}
                  selected={form.status === status}
                  onPress={() => set('status', status)}
                  style={styles.statusChip}
                />
              ))}
            </View>
          </View>

          <Field
            label="Ghi chú"
            value={form.notes}
            onChangeText={value => set('notes', value)}
            placeholder="Đặc điểm đất, nguồn nước, điều cần lưu ý…"
            multiline
            style={styles.field}
          />

          <PrimaryButton
            testID="plot-save"
            label={editingId ? 'Lưu thay đổi' : 'Lưu lô đất'}
            onPress={onSave}
            loading={saving}
            style={styles.save}
          />
          <SecondaryButton label="Huỷ" onPress={() => navigation.goBack()} style={styles.cancel} />

          <Text style={[text('caption', colors.text.muted), styles.footnote]}>
            Lưu vào máy ngay cả khi không có mạng. Dữ liệu tự đồng bộ lên hệ thống khi có mạng
            trở lại.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker ? (
        <DateTimePicker
          value={form.plantedAt ? new Date(form.plantedAt) : new Date()}
          mode="date"
          maximumDate={maxDate}
          onChange={(event, selected) => {
            setShowDatePicker(false);
            if (event.type === 'set' && selected) {
              set('plantedAt', selected.getTime());
            }
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  field: {
    marginBottom: space.lg,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  rowItem: {
    flex: 1,
  },
  rowItemNarrow: {
    width: 128,
  },
  unitLabel: {
    marginBottom: space.sm,
  },
  unitRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  // Cao bằng ô Diện tích cùng hàng, đồng thời đủ vùng chạm 48.
  unitChip: {
    minHeight: size.inputMinHeight,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  statusChip: {
    flex: 0,
    minHeight: size.minTouchTarget,
    paddingHorizontal: space.md,
  },
  save: {
    marginTop: space.sm,
  },
  cancel: {
    marginTop: space.md,
  },
  footnote: {
    marginTop: space.lg,
    textAlign: 'center',
  },
});

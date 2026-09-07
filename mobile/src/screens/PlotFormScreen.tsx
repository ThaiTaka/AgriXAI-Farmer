/**
 * Màn hình 09 — Thêm / sửa lô đất.
 *
 * Design reference: screen "09 Thêm / sửa lô đất". Same field order and pill
 * inputs; the variety picker and the planting date are the two fields Giai đoạn 1
 * adds on top of the mock.
 *
 * Saving writes to SQLite and pops straight back (Điều 1) — the screen never
 * waits for the network, and there is no spinner tied to an HTTP call.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../auth/AuthContext';
import {GhostButton, IconButton, PrimaryButton} from '../components/buttons';
import {Field, PickerField, SelectChip} from '../components/form';
import {GlassSurface} from '../components/GlassSurface';
import {CalendarIcon, ChevronLeft, ChevronRight} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import {VarietyPicker} from '../components/VarietyPicker';
import {collections} from '../db';
import type {VarietyOption} from '../db/repositories/varietyRepository';
import type Plot from '../db/models/Plot';
import type {PlotStatus} from '../db/models/Plot';
import {
  createPlot,
  PLOT_STATUS_LABELS,
  resolvePlotCode,
  updatePlot,
} from '../db/repositories/plotRepository';
import type {RootStackParamList} from '../navigation/types';
import {colors, radius, spacing, text} from '../theme';
import {formatDate} from '../utils/format';
import {isWellFormedPlotCode} from '../utils/plotCode';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'PlotForm'>;

const STATUSES: PlotStatus[] = ['active', 'fallow', 'harvested'];
const CROP_TYPE = 'ca_chua';
const CROP_NAME = 'Cà chua';

interface FormState {
  code: string;
  name: string;
  region: string;
  area: string;
  areaUnit: 'm2' | 'ha';
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

  const [form, setForm] = useState<FormState>(EMPTY);
  const [existing, setExisting] = useState<Plot | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [showVarietyPicker, setShowVarietyPicker] = useState(false);
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

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({...prev, [key]: value}));
    setErrors(prev => (prev[key] ? {...prev, [key]: undefined} : prev));
  }, []);

  const validate = useCallback((): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) next.name = 'Tên lô đất là bắt buộc.';

    if (form.code.trim() && !isWellFormedPlotCode(form.code)) {
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

    setErrors(next);
    return Object.keys(next).length === 0;
  }, [form]);

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
        cropType: CROP_TYPE,
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

  const onPickVariety = useCallback((variety: VarietyOption) => {
    setForm(prev => ({...prev, varietyId: variety.id, varietyName: variety.name}));
    setShowVarietyPicker(false);
  }, []);

  const title = editingId ? 'Sửa lô đất' : 'Thêm lô đất';
  const maxDate = useMemo(() => new Date(), []);

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.root}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <IconButton accessibilityLabel="Quay lại" onPress={() => navigation.goBack()}>
              <ChevronLeft />
            </IconButton>
            <Text style={text('screenHeading')}>{title}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <GlassSurface level="card" style={styles.card}>
              <Field
                testID="plot-name"
                label="Tên lô đất"
                value={form.name}
                onChangeText={value => set('name', value)}
                placeholder="Ví dụ: Vườn nhà trên"
                error={errors.name}
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
              />

              <Field
                label="Khu vực"
                value={form.region}
                onChangeText={value => set('region', value)}
                placeholder="Xã / phường, tỉnh"
              />

              <View style={styles.row}>
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
                  <Text style={[text('metaSm', colors.text.alpha['74']), styles.unitLabel]}>
                    Đơn vị
                  </Text>
                  <View style={styles.unitRow}>
                    <SelectChip
                      label="m²"
                      selected={form.areaUnit === 'm2'}
                      onPress={() => set('areaUnit', 'm2')}
                    />
                    <SelectChip
                      label="ha"
                      selected={form.areaUnit === 'ha'}
                      onPress={() => set('areaUnit', 'ha')}
                    />
                  </View>
                </View>
              </View>

              <Field label="Cây trồng" value={CROP_NAME} editable={false} />

              <PickerField
                testID="plot-variety"
                label="Giống cây"
                value={form.varietyName}
                placeholder="Chọn giống hoặc thêm giống mới"
                onPress={() => setShowVarietyPicker(true)}
                icon={<ChevronRight />}
              />

              <PickerField
                testID="plot-planted-at"
                label="Ngày trồng"
                value={form.plantedAt ? formatDate(form.plantedAt) : ''}
                placeholder="Chọn ngày xuống giống"
                onPress={() => setShowDatePicker(true)}
                icon={<CalendarIcon />}
                hint="Dùng để gợi ý công việc theo giai đoạn cây ở tab Lịch chăm sóc."
              />

              <View>
                <Text style={[text('metaSm', colors.text.alpha['74']), styles.unitLabel]}>
                  Trạng thái
                </Text>
                <View style={styles.statusRow}>
                  {STATUSES.map(status => (
                    <SelectChip
                      key={status}
                      label={PLOT_STATUS_LABELS[status]}
                      selected={form.status === status}
                      onPress={() => set('status', status)}
                    />
                  ))}
                </View>
              </View>

              <Field
                label="Ghi chú"
                value={form.notes}
                onChangeText={value => set('notes', value)}
                placeholder="Giống, ngày xuống giống, đặc điểm cần lưu ý…"
                multiline
              />
            </GlassSurface>

            <PrimaryButton
              label={editingId ? 'Lưu thay đổi' : 'Lưu lô đất'}
              onPress={onSave}
              loading={saving}
              style={styles.save}
            />
            <GhostButton label="Huỷ" onPress={() => navigation.goBack()} style={styles.cancel} />

            <Text style={[text('caption', colors.text.alpha['60']), styles.footnote]}>
              Lưu vào máy ngay cả khi không có mạng. Dữ liệu tự đồng bộ lên hệ thống khi có
              mạng trở lại.
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <VarietyPicker
        visible={showVarietyPicker}
        cropType={CROP_TYPE}
        cropName={CROP_NAME}
        selectedId={form.varietyId}
        onSelect={onPickVariety}
        onClose={() => setShowVarietyPicker(false)}
      />

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
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['10'],
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
  },
  card: {
    padding: spacing['12'],
    borderRadius: radius['6xl'],
    gap: spacing['11'],
  },
  row: {
    flexDirection: 'row',
    gap: spacing['7'],
  },
  rowItem: {
    flex: 1,
  },
  rowItemNarrow: {
    width: 132,
  },
  unitLabel: {
    marginBottom: spacing['2'],
  },
  unitRow: {
    flexDirection: 'row',
    gap: spacing['3'],
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing['3'],
  },
  save: {
    marginTop: spacing['13'],
  },
  cancel: {
    marginTop: spacing['6'],
  },
  footnote: {
    marginTop: spacing['11'],
  },
});

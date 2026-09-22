/**
 * F1 — Tính lượng phân bón.
 *
 * Crop + variety (three-step picker or one of your plots) → area in the unit
 * the farmer thinks in → one of the protocol's scenarios → a card per
 * fertiliser with the scaled amount and, where the catalogue has a price, the
 * estimated cost. Everything is computed on the device from the bundled
 * protocol file; "Lưu kế hoạch" writes to SQLite and syncs later.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {Field, PickerField, SegmentedControl, SelectChip} from '../../components/form';
import {CalculatorIcon, ChevronRight, ExternalLinkIcon} from '../../components/icons';
import {NumberText} from '../../components/NumberText';
import {Screen} from '../../components/Screen';
import type Plot from '../../db/models/Plot';
import {savePlan} from '../../db/repositories/planRepository';
import {observePlots} from '../../db/repositories/plotRepository';
import {useObservable} from '../../db/useObservable';
import {AREA_UNITS, areaUnitInfo, plotAreaUnit, toSquareMetres, type AreaUnit} from '../../domain/areaUnits';
import type {CareProtocol, Scenario} from '../../domain/careProtocol';
import {citation, conversionFactors, conversionNote, protocolAvailability} from '../../domain/careProtocol';
import type {CalcResult} from '../../domain/fertilizerCalc';
import {calculate, formatRange} from '../../domain/fertilizerCalc';
import type {PickedVariety, RootStackParamList} from '../../navigation/types';
import {useSync} from '../../sync/SyncContext';
import {colors, radius, size, space, text} from '../../theme';
import {formatNumber, formatVnd, formatVndRange} from '../../utils/format';
import {cropNameOf, fertilizerProduct} from '../../utils/staticData';
import {ProtocolUnavailable} from '../care/ProtocolUnavailable';
import {useCategoryOf} from '../care/useCategoryOf';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FertilizerCalculator'>;

interface Selection {
  cropType: string;
  cropName: string;
  categoryId: string | null;
  varietyId: string | null;
  varietyName: string | null;
  plotId: string | null;
}

export function FertilizerCalculatorScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const author = useChangeAuthor();
  const {state: syncState, pending: pendingSync} = useSync();
  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [area, setArea] = useState('');
  const [unit, setUnit] = useState<AreaUnit>('m2');
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const applyPlot = useCallback((plot: Plot) => {
    setSelection({
      cropType: plot.cropType,
      cropName: cropNameOf(plot.cropType, plot.cropName),
      categoryId: null,
      varietyId: plot.varietyId,
      varietyName: plot.varietyName,
      plotId: plot.id,
    });
    if (plot.area > 0) {
      setArea(String(plot.area));
      setUnit(plotAreaUnit(plot.areaUnit));
    }
    setProtocolId(null);
    setScenarioId(null);
    setResult(null);
    setSavedId(null);
  }, []);

  useEffect(() => {
    if (!params?.plotId) return;
    const plot = plots.find(p => p.id === params.plotId);
    if (plot && selection?.plotId !== plot.id) applyPlot(plot);
    // Only react to the plot list changing, not to every selection edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.plotId, plots]);

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
    });
    setProtocolId(null);
    setScenarioId(null);
    setResult(null);
    setSavedId(null);
  }, [params?.pickedVariety]);

  const resolvedCategory = useCategoryOf(selection?.varietyId);
  const categoryId = selection?.categoryId ?? resolvedCategory;
  const availability = useMemo(
    () => (selection ? protocolAvailability(selection.cropType, categoryId) : null),
    [selection, categoryId],
  );
  const protocols = availability?.protocols ?? [];
  const protocol: CareProtocol | undefined = protocols.find(p => p.id === protocolId) ?? protocols[0];
  const scenario: Scenario | undefined =
    protocol?.scenarios.find(s => s.id === scenarioId) ?? protocol?.scenarios[0];

  const areaM2 = useMemo(() => {
    const parsed = Number(area.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? toSquareMetres(parsed, unit) : 0;
  }, [area, unit]);

  const compute = useCallback(() => {
    if (!protocol || !scenario) return;
    if (!(areaM2 > 0)) {
      setError('Nhập diện tích lớn hơn 0.');
      return;
    }
    setError(null);
    try {
      setResult(
        calculate({
          protocol,
          scenario,
          areaM2,
          factors: conversionFactors(protocol.crop_type),
          findProduct: fertilizerProduct,
        }),
      );
      setSavedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tính được.');
    }
  }, [protocol, scenario, areaM2]);

  const onSave = useCallback(async () => {
    if (!selection || !protocol || !scenario || !result || saving) return;
    setSaving(true);
    try {
      const plan = await savePlan(
        {
          plotId: selection.plotId,
          cropType: selection.cropType,
          cropName: selection.cropName,
          categoryId,
          varietyId: selection.varietyId,
          varietyName: selection.varietyName,
          protocolId: protocol.id,
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          areaInput: Number(area.replace(',', '.')),
          areaUnit: unit,
          result,
          note: null,
        },
        author,
      );
      setSavedId(plan.id);
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại.');
    } finally {
      setSaving(false);
    }
  }, [selection, protocol, scenario, result, saving, categoryId, area, unit, author]);

  const openPicker = useCallback(() => {
    navigation.navigate('VarietyCropType', {selectedId: selection?.varietyId ?? null, returnTo: 'FertilizerCalculator'});
  }, [navigation, selection?.varietyId]);

  const cropValue = selection
    ? selection.varietyName
      ? `${selection.cropName} · ${selection.varietyName}`
      : selection.cropName
    : '';
  const unitInfo = areaUnitInfo(unit);

  return (
    <Screen>
      <AppHeader eyebrow="Tư vấn phân bón" title="Tính lượng phân bón" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PickerField
          testID="calc-crop"
          label="Cây trồng & giống"
          value={cropValue}
          placeholder="Chọn loại cây → loại → giống"
          onPress={openPicker}
          icon={<ChevronRight />}
          style={styles.field}
        />

        {plots.length > 0 ? (
          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Hoặc lấy từ lô đất</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {plots.map(plot => (
                <SelectChip
                  key={plot.id}
                  label={`${plot.name} · ${formatNumber(plot.area)} ${plot.areaUnit === 'ha' ? 'ha' : 'm²'}`}
                  selected={selection?.plotId === plot.id}
                  onPress={() => applyPlot(plot)}
                  style={styles.chip}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.field}>
          <Field
            testID="calc-area"
            label={`Diện tích (${unitInfo.short})`}
            value={area}
            onChangeText={value => {
              setArea(value);
              setError(null);
            }}
            placeholder="500"
            keyboardType="numeric"
            error={error}
            hint={areaM2 > 0 && unit !== 'm2' ? `= ${formatNumber(areaM2)} m²` : undefined}
          />
          <View style={styles.unitRow}>
            {AREA_UNITS.map(u => (
              <SelectChip key={u.code} label={u.short} selected={unit === u.code} onPress={() => setUnit(u.code)} style={styles.unitChip} />
            ))}
          </View>
        </View>

        {!selection ? (
          <EmptyState
            icon={<CalculatorIcon color={colors.gray['400']} />}
            title="Chọn cây để tính"
            body="Lượng phân được nhân theo diện tích từ quy trình có nguồn của từng loại cây; giá lấy từ danh mục phân bón."
          />
        ) : !protocol || !scenario ? (
          <ProtocolUnavailable cropName={selection.cropName} entry={availability?.unavailable ?? null} />
        ) : (
          <>
            {protocols.length > 1 ? (
              <View style={styles.field}>
                <Text style={[text('meta', colors.text.secondary), styles.label]}>Nguồn quy trình</Text>
                <SegmentedControl
                  items={protocols.map(p => ({key: p.id, label: p.source.publisher.split(/[—(,]/)[0].trim().split(/\s+/).slice(0, 4).join(' ')}))}
                  value={protocol.id}
                  onChange={id => {
                    setProtocolId(id);
                    setScenarioId(null);
                    setResult(null);
                  }}
                />
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[text('meta', colors.text.secondary), styles.label]}>Phương án bón</Text>
              <View style={styles.scenarios}>
                {protocol.scenarios.map(s => (
                  <Pressable
                    key={s.id}
                    testID={`scenario-${s.id}`}
                    accessibilityRole="radio"
                    accessibilityState={{selected: s.id === scenario.id}}
                    onPress={() => {
                      setScenarioId(s.id);
                      setResult(null);
                    }}
                    style={({pressed}) => [
                      styles.scenario,
                      s.id === scenario.id ? styles.scenarioSelected : null,
                      pressed && s.id !== scenario.id && styles.scenarioPressed,
                    ]}>
                    <Text style={text('bodyStrong', s.id === scenario.id ? colors.primary.default : colors.text.primary)}>
                      {s.name}
                    </Text>
                    {s.description ? (
                      <Text style={[text('caption', colors.text.muted), styles.scenarioBody]} numberOfLines={3}>
                        {s.description}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
              <Text style={[text('caption', colors.text.muted), styles.refNote]}>
                Định mức nguồn tính cho {formatNumber(protocol.reference_area.value)} {protocol.reference_area.unit === 'ha' ? 'ha' : 'm²'}
                {protocol.basis === 'nutrient' ? ' · nguồn cho N–P₂O₅–K₂O nguyên chất, ứng dụng quy đổi ra phân đơn' : ''}.
              </Text>
            </View>

            <PrimaryButton testID="calc-run" label="Tính lượng cần" onPress={compute} icon={<CalculatorIcon size={20} color={colors.white} />} />

            {result ? (
              <View style={styles.result} testID="calc-result">
                <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>
                  Lượng cần cho {formatNumber(result.areaM2)} m²
                </Text>

                {result.lines.map(line => (
                  <Card key={line.key} style={styles.line} testID={`calc-line-${line.key}`}>
                    <View style={styles.lineRow}>
                      <View style={styles.lineBody}>
                        <Text style={text('bodyStrong')} numberOfLines={2}>
                          {line.name}
                        </Text>
                        {line.nutrient ? (
                          <Text style={[text('caption', colors.text.muted), styles.lineMeta]} numberOfLines={2}>
                            Quy đổi từ {formatRange(line.nutrientMin ?? 0, line.nutrientMax ?? 0)} kg {line.sourceName} ({line.conversionPct}%)
                          </Text>
                        ) : line.note ? (
                          <Text style={[text('caption', colors.text.muted), styles.lineMeta]} numberOfLines={2}>
                            {line.note}
                          </Text>
                        ) : null}
                        <Text style={[text('caption', colors.text.muted), styles.lineMeta]} numberOfLines={2}>
                          {line.pricePerKg !== null && line.costMin !== null && line.costMax !== null
                            ? `≈ ${formatVndRange(Math.round(line.costMin), Math.round(line.costMax))} · ${formatVnd(line.pricePerKg)}/kg (${line.priceProductName})`
                            : 'Chưa có giá trong danh mục'}
                        </Text>
                      </View>
                      <View style={styles.lineValue}>
                        <NumberText size="lg" numberOfLines={1}>
                          {formatRange(line.min, line.max)}
                        </NumberText>
                        <Text style={text('caption', colors.text.muted)}>{line.unit}</Text>
                      </View>
                    </View>
                  </Card>
                ))}

                <Card style={styles.total} testID="calc-total">
                  <Text style={text('cardTitle')}>Tổng tiền (ước tính)</Text>
                  <NumberText size="lg" numberOfLines={1} style={styles.totalValue}>
                    {result.costMax > 0 ? formatVndRange(Math.round(result.costMin), Math.round(result.costMax)) : '—'}
                  </NumberText>
                  <Text style={[text('caption', colors.text.muted), styles.lineMeta]}>
                    Theo giá trung bình trong danh mục, thu thập 06–07/09/2026.
                  </Text>
                  {result.unpriced.length > 0 ? (
                    <View style={styles.unpriced}>
                      <Badge label="Chưa gồm" tone="yellow" />
                      <Text style={[text('caption', colors.text.secondary), styles.unpricedText]}>
                        {result.unpriced.join(', ')} — chưa có giá đã xác thực, không tự sinh số.
                      </Text>
                    </View>
                  ) : null}
                </Card>

                {savedId ? (
                  <Card style={styles.saved} testID="calc-saved">
                    <View style={styles.savedBadges}>
                      <Badge label="Đã lưu kế hoạch" tone="green" />
                      {syncState === 'offline' || pendingSync.some(p => p.table === 'plans' && p.pending > 0) ? (
                        <Badge label="Lưu offline — sẽ đồng bộ" tone="yellow" />
                      ) : (
                        <Badge label="Đã đồng bộ" tone="gray" />
                      )}
                    </View>
                    <Text style={[text('bodySm', colors.text.secondary), styles.lineMeta]}>
                      Kế hoạch nằm trên máy và sẽ đồng bộ khi có mạng. Kiểm tra kho để biết cần mua thêm gì.
                    </Text>
                    <View style={styles.savedActions}>
                      <SecondaryButton
                        small
                        label="Kiểm tra kho"
                        onPress={() => {
                          const first = result.lines.find(l => l.priceProductId);
                          navigation.navigate('StockCheck', {
                            fertilizerId: first?.priceProductId ?? undefined,
                            plotId: selection.plotId ?? undefined,
                            neededKg: first ? Math.round(first.max * (first.unit === 'tấn' ? 1000 : 1)) : undefined,
                          });
                        }}
                      />
                    </View>
                  </Card>
                ) : (
                  <PrimaryButton testID="calc-save" label="Lưu kế hoạch" onPress={onSave} loading={saving} style={styles.save} />
                )}

                <Text style={[text('caption', colors.text.muted), styles.disclaimer]}>{protocol.disclaimer}</Text>
                {protocol.basis === 'nutrient' && conversionNote(protocol.crop_type) ? (
                  <Text style={[text('caption', colors.text.muted), styles.disclaimer]}>{conversionNote(protocol.crop_type)}</Text>
                ) : null}
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(protocol.source.url).catch(() => {})}
                  hitSlop={8}
                  style={({pressed}) => [styles.sourceLink, pressed && styles.sourceLinkPressed]}>
                  <Text style={[text('caption', colors.primary.default), styles.sourceLinkText]} numberOfLines={2}>
                    Nguồn: {citation(protocol)} — {protocol.source.url}
                  </Text>
                  <ExternalLinkIcon size={14} />
                </Pressable>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
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
    minHeight: size.minTouchTarget,
    paddingHorizontal: space.md,
  },
  unitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.sm,
  },
  // Chọn nhầm m²/sào/ha là sai toàn bộ lượng phân — giữ đủ vùng chạm 48.
  unitChip: {
    flex: 0,
    minWidth: 64,
    minHeight: size.minTouchTarget,
    paddingHorizontal: space.md,
  },
  scenarios: {
    gap: space.sm,
  },
  scenario: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
    padding: space.md,
    minHeight: size.minTouchTarget,
    justifyContent: 'center',
  },
  scenarioSelected: {
    borderColor: colors.border.selected,
    backgroundColor: colors.surface.selected,
  },
  scenarioPressed: {
    backgroundColor: colors.surface.pressed,
  },
  scenarioBody: {
    marginTop: 2,
  },
  refNote: {
    marginTop: space.sm,
  },
  result: {
    marginTop: space.xl,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  line: {
    marginBottom: space.sm,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  lineBody: {
    flex: 1,
    minWidth: 0,
  },
  lineMeta: {
    marginTop: 2,
  },
  lineValue: {
    alignItems: 'flex-end',
  },
  total: {
    marginTop: space.sm,
    borderColor: colors.primary.default,
  },
  totalValue: {
    marginTop: space.xs,
  },
  unpriced: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    marginTop: space.md,
  },
  unpricedText: {
    flex: 1,
  },
  save: {
    marginTop: space.lg,
  },
  saved: {
    marginTop: space.lg,
  },
  savedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  savedActions: {
    flexDirection: 'row',
    marginTop: space.md,
  },
  disclaimer: {
    marginTop: space.lg,
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
});

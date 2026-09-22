/**
 * F4 — Kiểm tra kho.
 *
 * A fertiliser (from F3, from a plan, or picked here), a plot and the amount
 * to apply → "Đủ, còn dư X kg" or "Thiếu X kg, cần mua thêm", read from the
 * local stock ledger. "Mua thêm" opens the purchase form pre-filled with the
 * shortfall; "Lên kế hoạch bón" saves a one-line plan for the plot.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {Field, PickerField, SelectChip} from '../../components/form';
import {AlertIcon, CheckCircleIcon, ChevronRight} from '../../components/icons';
import {NumberText} from '../../components/NumberText';
import type {PickedProduct} from '../../components/ProductPickerSheet';
import {ProductPickerSheet} from '../../components/ProductPickerSheet';
import {Screen} from '../../components/Screen';
import type Plot from '../../db/models/Plot';
import type WarehouseIn from '../../db/models/WarehouseIn';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {savePlan} from '../../db/repositories/planRepository';
import {observePlots} from '../../db/repositories/plotRepository';
import {observeWarehouseIn, observeWarehouseOut, toInRows, toOutRows} from '../../db/repositories/warehouseRepository';
import {useObservable} from '../../db/useObservable';
import {checkStock, stockSummary} from '../../domain/warehouse';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {formatNumber, formatVnd} from '../../utils/format';
import {cropNameOf, fertilizerProduct} from '../../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StockCheck'>;

export function StockCheckScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const author = useChangeAuthor();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);
  const ins = useObservable<WarehouseIn[]>(() => observeWarehouseIn(user.id), [user.id], []);
  const outs = useObservable<WarehouseOut[]>(() => observeWarehouseOut(user.id), [user.id], []);

  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [plotId, setPlotId] = useState<string | null>(params?.plotId ?? null);
  const [needed, setNeeded] = useState(params?.neededKg ? String(params.neededKg) : '');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!params?.fertilizerId || product) return;
    const catalogue = fertilizerProduct(params.fertilizerId);
    if (catalogue) {
      setProduct({id: catalogue.id, name: catalogue.name, category: catalogue.category});
      return;
    }
    const row = ins.find(r => r.fertilizerId === params.fertilizerId);
    if (row) setProduct({id: row.fertilizerId, name: row.fertilizerName, category: row.category});
  }, [params?.fertilizerId, ins, product]);

  const inRows = useMemo(() => toInRows(ins), [ins]);
  const outRows = useMemo(() => toOutRows(outs), [outs]);
  const inStock = useMemo(
    () => stockSummary(inRows, outRows).filter(l => l.stockKg > 0).map(l => ({id: l.fertilizerId, name: l.fertilizerName, category: l.category})),
    [inRows, outRows],
  );

  const neededKg = useMemo(() => {
    const parsed = Number(needed.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [needed]);

  const check = useMemo(
    () => (product && neededKg > 0 ? checkStock(inRows, outRows, product.id, neededKg) : null),
    [product, neededKg, inRows, outRows],
  );
  const line = useMemo(
    () => (product ? stockSummary(inRows, outRows).find(l => l.fertilizerId === product.id) : undefined),
    [product, inRows, outRows],
  );
  const catalogue = product ? fertilizerProduct(product.id) : undefined;
  const latestPrice = line?.latestUnitPrice ?? catalogue?.price_per_kg_avg ?? null;
  const plot = plots.find(p => p.id === plotId) ?? null;

  const onPlan = useCallback(async () => {
    if (!product || !check || saving) return;
    setSaving(true);
    try {
      await savePlan(
        {
          plotId: plot?.id ?? null,
          cropType: plot?.cropType ?? 'khac',
          cropName: plot ? cropNameOf(plot.cropType, plot.cropName) : null,
          categoryId: null,
          varietyId: plot?.varietyId ?? null,
          varietyName: plot?.varietyName ?? null,
          protocolId: 'manual',
          scenarioId: 'stock_check',
          scenarioName: `Bón ${product.name} ${formatNumber(neededKg)} kg`,
          areaInput: plot?.area ?? 0,
          areaUnit: plot?.areaUnit ?? 'm2',
          result: {
            protocolId: 'manual',
            scenarioId: 'stock_check',
            areaM2: plot ? (plot.areaUnit === 'ha' ? plot.area * 10_000 : plot.area) : 1,
            factor: 1,
            lines: [
              {
                key: product.id,
                name: product.name,
                sourceName: product.name,
                fertilizerCategory: product.category ?? 'khac',
                unit: 'kg',
                min: neededKg,
                max: neededKg,
                nutrient: null,
                nutrientMin: null,
                nutrientMax: null,
                conversionPct: null,
                priceProductId: catalogue?.id ?? null,
                priceProductName: catalogue?.name ?? null,
                pricePerKg: latestPrice,
                costMin: latestPrice === null ? null : neededKg * latestPrice,
                costMax: latestPrice === null ? null : neededKg * latestPrice,
                note: check.enough ? `Kho đủ, còn dư ${formatNumber(check.remainingKg)} kg` : `Thiếu ${formatNumber(check.shortfallKg)} kg`,
              },
            ],
            costMin: latestPrice === null ? 0 : neededKg * latestPrice,
            costMax: latestPrice === null ? 0 : neededKg * latestPrice,
            unpriced: latestPrice === null ? [product.name] : [],
          },
          note: plot ? `Kiểm kho cho lô ${plot.code}` : 'Kiểm kho',
        },
        author,
      );
      Alert.alert('Đã lưu kế hoạch bón', 'Kế hoạch nằm trên máy và sẽ đồng bộ khi có mạng.', [
        {text: 'Đóng'},
        {text: 'Xuất kho ngay', onPress: () => navigation.navigate('Warehouse', {tab: 'out', prefill: {fertilizerId: product.id, quantityKg: neededKg}})},
      ]);
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại.');
    } finally {
      setSaving(false);
    }
  }, [product, check, saving, plot, neededKg, catalogue, latestPrice, author, navigation]);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader eyebrow="Tư vấn phân bón" title="Kiểm tra kho" onBack={() => navigation.goBack()} />

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PickerField
          testID="check-product"
          label="Phân bón"
          value={product?.name ?? ''}
          placeholder="Chọn phân bón"
          onPress={() => setPicking(true)}
          icon={<ChevronRight />}
          style={styles.field}
        />

        <View style={styles.field}>
          <Text style={[text('meta', colors.text.secondary), styles.label]}>Lô đất</Text>
          {plots.length === 0 ? (
            <Text style={text('bodySm', colors.text.muted)}>Chưa có lô đất — vẫn kiểm tra được kho chung.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <SelectChip label="Kho chung" selected={plotId === null} onPress={() => setPlotId(null)} style={styles.chip} />
              {plots.map(p => (
                <SelectChip key={p.id} label={`${p.code} · ${p.name}`} selected={plotId === p.id} onPress={() => setPlotId(p.id)} style={styles.chip} />
              ))}
            </ScrollView>
          )}
        </View>

        <Field
          testID="check-needed"
          label="Lượng cần bón (kg)"
          value={needed}
          onChangeText={value => {
            setNeeded(value);
            setError(null);
          }}
          placeholder="30"
          keyboardType="numeric"
          error={error}
          style={styles.field}
        />

        {product ? (
          <Card style={styles.stockCard} testID="check-result">
            <Text style={text('eyebrow', colors.text.muted)}>Tồn kho hiện tại</Text>
            <View style={styles.stockRow}>
              <NumberText size="lg" testID="check-stock">
                {formatNumber(line?.stockKg ?? 0)} kg
              </NumberText>
              {check ? (
                <Badge
                  label={check.enough ? 'Đủ' : 'Thiếu'}
                  tone={check.enough ? 'green' : 'yellow'}
                  icon={check.enough ? <CheckCircleIcon size={14} /> : <AlertIcon size={14} />}
                />
              ) : null}
            </View>

            {check ? (
              <>
                <View style={styles.afterRow}>
                  <Text style={text('bodySm', colors.text.muted)}>Sau khi bón {formatNumber(check.neededKg)} kg</Text>
                  <NumberText size="md" color={colors.text.muted}>
                    {check.enough ? `${formatNumber(check.remainingKg)} kg` : '0 kg'}
                  </NumberText>
                </View>
                <Text style={[text('bodyStrong', check.enough ? colors.badge.greenFg : colors.badge.yellowFg), styles.verdict]} testID="check-verdict">
                  {check.enough
                    ? `Đủ, còn dư ${formatNumber(check.remainingKg)} kg`
                    : `Thiếu ${formatNumber(check.shortfallKg)} kg, cần mua thêm`}
                </Text>
              </>
            ) : (
              <Text style={[text('bodySm', colors.text.muted), styles.verdict]}>Nhập lượng cần bón để kiểm tra.</Text>
            )}

            <View style={styles.priceRow}>
              <Text style={text('bodySm', colors.text.muted)}>
                {line?.latestUnitPrice ? 'Giá nhập gần nhất' : 'Giá tham khảo danh mục'}
              </Text>
              <NumberText size="md">{latestPrice !== null ? `${formatVnd(latestPrice)}/kg` : 'Chưa có giá'}</NumberText>
            </View>
            {check && !check.enough && latestPrice !== null ? (
              <Text style={[text('caption', colors.text.muted), styles.estimate]}>
                Mua thêm {formatNumber(check.shortfallKg)} kg ≈ {formatVnd(Math.round(check.shortfallKg * latestPrice))}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {check && !check.enough ? (
          <SecondaryButton
            testID="check-buy"
            label={`Mua thêm ${formatNumber(check.shortfallKg)} kg`}
            onPress={() => navigation.navigate('Warehouse', {tab: 'in', prefill: {fertilizerId: product!.id, quantityKg: check.shortfallKg}})}
            style={styles.action}
          />
        ) : null}
        {check ? (
          <PrimaryButton testID="check-plan" label="Lên kế hoạch bón" onPress={onPlan} loading={saving} style={styles.action} />
        ) : null}

        <Text style={[text('caption', colors.text.muted), styles.footnote]}>
          Tồn = tổng nhập − tổng xuất trên máy này. Giá nhập gần nhất lấy từ phiếu nhập; chưa có phiếu thì dùng giá trung
          bình trong danh mục.
        </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <ProductPickerSheet
        visible={picking}
        selectedId={product?.id ?? null}
        inStock={inStock}
        onClose={() => setPicking(false)}
        onPick={p => {
          setProduct(p);
          setPicking(false);
        }}
      />
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
  stockCard: {
    marginBottom: space.lg,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.xs,
  },
  afterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  verdict: {
    marginTop: space.md,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.md,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  estimate: {
    marginTop: space.xs,
  },
  action: {
    marginBottom: space.md,
  },
  footnote: {
    marginTop: space.sm,
  },
});

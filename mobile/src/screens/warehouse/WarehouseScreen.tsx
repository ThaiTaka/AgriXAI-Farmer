/**
 * Kho vật tư — Nhập / Xuất / Tồn.
 *
 * Nhập: a purchase lot (product, date, amount, unit, total price, note),
 *       booked with a linked "Phân bón" expense unless the farmer says not to.
 * Xuất: an issue priced by FIFO over the lots on the device; refused when the
 *       shed does not hold enough.
 * Tồn:  per-fertiliser table (nhập, xuất, tồn, giá TB, tổng tiền), the stock
 *       line over time, a month/quarter filter and CSV export via the share
 *       sheet. All of it from SQLite — no network needed.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, Share, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {IconButton, PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {LineChart} from '../../components/charts/LineChart';
import {SERIES} from '../../components/charts/palette';
import {DateField} from '../../components/DateField';
import {EmptyState} from '../../components/EmptyState';
import {Field, PickerField, SelectChip} from '../../components/form';
import {CheckboxIcon, ChevronRight, ShareIcon, TrashIcon, WarehouseIcon} from '../../components/icons';
import {NumberText} from '../../components/NumberText';
import {PeriodPicker} from '../../components/PeriodPicker';
import type {PickedProduct} from '../../components/ProductPickerSheet';
import {ProductPickerSheet} from '../../components/ProductPickerSheet';
import {Screen} from '../../components/Screen';
import {Tabs} from '../../components/Tabs';
import type Plot from '../../db/models/Plot';
import type WarehouseIn from '../../db/models/WarehouseIn';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {observePlots} from '../../db/repositories/plotRepository';
import {
  addStockIn,
  addStockOut,
  deleteStockRow,
  InsufficientStockError,
  observeWarehouseIn,
  observeWarehouseOut,
  toInRows,
  toOutRows,
} from '../../db/repositories/warehouseRepository';
import {useObservable} from '../../db/useObservable';
import type {PeriodFilter, StockUnit} from '../../domain/warehouse';
import {fifoCost, inPeriod, periodBounds, stockCsv, stockOf, stockSummary, stockTimeline, toKg} from '../../domain/warehouse';
import type {RootStackParamList, WarehouseTab} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {formatDate, formatNumber, formatVnd} from '../../utils/format';
import {fertilizerProduct} from '../../utils/staticData';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Warehouse'>;

const TABS = [
  {key: 'in', label: 'Nhập'},
  {key: 'out', label: 'Xuất'},
  {key: 'stock', label: 'Tồn'},
] as const;

export function WarehouseScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const [tab, setTab] = useState<WarehouseTab>(params?.tab ?? 'in');

  const ins = useObservable<WarehouseIn[]>(() => observeWarehouseIn(user.id), [user.id], []);
  const outs = useObservable<WarehouseOut[]>(() => observeWarehouseOut(user.id), [user.id], []);
  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  useEffect(() => {
    if (params?.tab) setTab(params.tab);
  }, [params?.tab]);

  return (
    <Screen>
      <AppHeader eyebrow="Vật tư" title="Kho phân bón" onBack={() => navigation.goBack()} />
      <Tabs items={TABS} value={tab} onChange={setTab} style={styles.tabs} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {tab === 'in' ? <StockInTab ins={ins} plots={plots} prefill={params?.prefill} /> : null}
        {tab === 'out' ? <StockOutTab ins={ins} outs={outs} plots={plots} prefill={params?.prefill} /> : null}
        {tab === 'stock' ? <StockTab ins={ins} outs={outs} /> : null}
      </ScrollView>
    </Screen>
  );
}

/* --------------------------------- Nhập ---------------------------------- */

function StockInTab({ins, plots, prefill}: {ins: WarehouseIn[]; plots: Plot[]; prefill?: {fertilizerId: string; quantityKg?: number}}) {
  const author = useChangeAuthor();
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState<number>(Date.now());
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<StockUnit>('kg');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const [plotId, setPlotId] = useState<string | null>(null);
  const [recordExpense, setRecordExpense] = useState(true);
  const [errors, setErrors] = useState<{product?: string; quantity?: string; price?: string}>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!prefill || product) return;
    const catalogue = fertilizerProduct(prefill.fertilizerId);
    const row = ins.find(r => r.fertilizerId === prefill.fertilizerId);
    if (catalogue) setProduct({id: catalogue.id, name: catalogue.name, category: catalogue.category});
    else if (row) setProduct({id: row.fertilizerId, name: row.fertilizerName, category: row.category});
    if (prefill.quantityKg) setQuantity(String(Math.ceil(prefill.quantityKg)));
  }, [prefill, ins, product]);

  const catalogue = product ? fertilizerProduct(product.id) : undefined;
  const quantityKg = toKg(Number(quantity.replace(',', '.')) || 0, unit);
  const priceValue = Number(price.replace(/[^\d]/g, '')) || 0;
  const perKg = quantityKg > 0 && priceValue > 0 ? priceValue / quantityKg : null;

  const onSave = useCallback(async () => {
    const next: typeof errors = {};
    if (!product) next.product = 'Chọn phân bón.';
    if (!(quantityKg > 0)) next.quantity = 'Lượng nhập phải lớn hơn 0.';
    if (priceValue < 0) next.price = 'Giá không hợp lệ.';
    setErrors(next);
    if (Object.keys(next).length > 0 || !product || saving) return;

    setSaving(true);
    try {
      await addStockIn(
        {
          fertilizerId: product.id,
          fertilizerName: product.name,
          category: product.category,
          quantity: Number(quantity.replace(',', '.')),
          unit,
          price: priceValue,
          occurredAt: date,
          note: note.trim() || null,
          plotId,
          recordExpense,
        },
        author,
      );
      setQuantity('');
      setPrice('');
      setNote('');
      Alert.alert('Đã lưu phiếu nhập', recordExpense && priceValue > 0 ? 'Đồng thời ghi một khoản chi "Phân bón" trong Thu – Chi.' : 'Lưu trên máy, đồng bộ khi có mạng.');
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại.');
    } finally {
      setSaving(false);
    }
  }, [product, quantityKg, priceValue, saving, quantity, unit, date, note, plotId, recordExpense, author]);

  const inStock = useMemo(() => {
    const seen = new Map<string, PickedProduct>();
    for (const r of ins) if (!seen.has(r.fertilizerId)) seen.set(r.fertilizerId, {id: r.fertilizerId, name: r.fertilizerName, category: r.category});
    return [...seen.values()];
  }, [ins]);

  return (
    <>
      <Card style={styles.formCard}>
        <PickerField
          testID="in-product"
          label="Phân bón"
          value={product?.name ?? ''}
          placeholder="Chọn hoặc gõ tên sản phẩm"
          onPress={() => setPicking(true)}
          icon={<ChevronRight />}
          error={errors.product}
          hint={catalogue ? `Giá tham khảo ${formatVnd(catalogue.price_min)} – ${formatVnd(catalogue.price_max)} / ${catalogue.unit}` : undefined}
          style={styles.field}
        />
        <DateField testID="in-date" label="Ngày nhập" value={date} onChange={setDate} maximumDate={new Date()} style={styles.field} />

        <View style={[styles.row, styles.field]}>
          <Field
            testID="in-quantity"
            label={`Lượng (${unit === 'tan' ? 'tấn' : 'kg'})`}
            value={quantity}
            onChangeText={v => {
              setQuantity(v);
              setErrors(e => ({...e, quantity: undefined}));
            }}
            placeholder="50"
            keyboardType="numeric"
            error={errors.quantity}
            style={styles.rowItem}
          />
          <View style={styles.rowNarrow}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Đơn vị</Text>
            <View style={styles.unitRow}>
              <SelectChip label="kg" selected={unit === 'kg'} onPress={() => setUnit('kg')} />
              <SelectChip label="tấn" selected={unit === 'tan'} onPress={() => setUnit('tan')} />
            </View>
          </View>
        </View>

        <Field
          testID="in-price"
          label="Giá (tổng tiền, ₫)"
          value={price}
          onChangeText={v => {
            setPrice(v);
            setErrors(e => ({...e, price: undefined}));
          }}
          placeholder="680000"
          keyboardType="numeric"
          error={errors.price}
          hint={perKg !== null ? `= ${formatVnd(Math.round(perKg))}/kg` : 'Để 0 nếu là phân tự có (không mua).'}
          style={styles.field}
        />

        {plots.length > 0 ? (
          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Mua cho lô (tuỳ chọn)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <SelectChip label="Kho chung" selected={plotId === null} onPress={() => setPlotId(null)} style={styles.chip} />
              {plots.map(p => (
                <SelectChip key={p.id} label={p.code} selected={plotId === p.id} onPress={() => setPlotId(p.id)} style={styles.chip} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <Field testID="in-note" label="Ghi chú" value={note} onChangeText={setNote} placeholder="Nơi mua, người bán, số hoá đơn…" style={styles.field} />

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{checked: recordExpense}}
          onPress={() => setRecordExpense(v => !v)}
          style={styles.checkRow}
          testID="in-record-expense">
          <CheckboxIcon checked={recordExpense} />
          <Text style={[text('bodySm', colors.text.secondary), styles.checkLabel]}>
            Ghi thành khoản chi "Phân bón" trong Thu – Chi
          </Text>
        </Pressable>

        <PrimaryButton testID="in-save" label="Lưu nhập" onPress={onSave} loading={saving} />
      </Card>

      <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Lịch sử nhập</Text>
      {ins.length === 0 ? (
        <EmptyState icon={<WarehouseIcon color={colors.gray['400']} />} title="Chưa có phiếu nhập" body="Phiếu nhập đầu tiên sẽ hiện ở đây: phân bón, lượng, giá, ngày." />
      ) : (
        <HistoryList rows={ins} kind="in" author={author} />
      )}

      <ProductPickerSheet
        visible={picking}
        selectedId={product?.id ?? null}
        inStock={inStock}
        allowCustom
        onClose={() => setPicking(false)}
        onPick={p => {
          setProduct(p);
          setErrors(e => ({...e, product: undefined}));
          setPicking(false);
        }}
      />
    </>
  );
}

/* --------------------------------- Xuất ---------------------------------- */

function StockOutTab({ins, outs, plots, prefill}: {ins: WarehouseIn[]; outs: WarehouseOut[]; plots: Plot[]; prefill?: {fertilizerId: string; quantityKg?: number}}) {
  const author = useChangeAuthor();
  const [product, setProduct] = useState<PickedProduct | null>(null);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState<number>(Date.now());
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [plotId, setPlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inRows = useMemo(() => toInRows(ins), [ins]);
  const outRows = useMemo(() => toOutRows(outs), [outs]);
  const inStock = useMemo(
    () => stockSummary(inRows, outRows).filter(l => l.stockKg > 0).map(l => ({id: l.fertilizerId, name: l.fertilizerName, category: l.category})),
    [inRows, outRows],
  );

  useEffect(() => {
    if (!prefill || product) return;
    const found = inStock.find(p => p.id === prefill.fertilizerId);
    if (found) setProduct(found);
    if (prefill.quantityKg) setQuantity(String(prefill.quantityKg));
  }, [prefill, inStock, product]);

  const quantityKg = Number(quantity.replace(',', '.')) || 0;
  const stock = product ? stockOf(inRows, outRows, product.id) : 0;
  const fifo = product && quantityKg > 0 ? fifoCost(inRows, outRows, product.id, quantityKg, date) : null;
  const enough = product ? quantityKg <= stock : false;

  const onSave = useCallback(async () => {
    if (!product) {
      setError('Chọn phân bón trong kho.');
      return;
    }
    if (!(quantityKg > 0)) {
      setError('Lượng xuất phải lớn hơn 0.');
      return;
    }
    if (saving) return;
    setSaving(true);
    try {
      await addStockOut(
        {
          fertilizerId: product.id,
          fertilizerName: product.name,
          category: product.category,
          quantityKg,
          occurredAt: date,
          note: note.trim() || null,
          plotId,
          planId: null,
        },
        author,
      );
      setQuantity('');
      setNote('');
      setError(null);
      Alert.alert('Đã lưu phiếu xuất', 'Giá xuất tính theo FIFO từ các lô nhập cũ nhất.');
    } catch (e) {
      setError(e instanceof InsufficientStockError ? e.message : e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setSaving(false);
    }
  }, [product, quantityKg, saving, date, note, plotId, author]);

  return (
    <>
      <Card style={styles.formCard}>
        <PickerField
          testID="out-product"
          label="Phân bón (trong kho)"
          value={product?.name ?? ''}
          placeholder="Chọn phân bón đang có trong kho"
          onPress={() => setPicking(true)}
          icon={<ChevronRight />}
          hint={product ? `Tồn hiện tại: ${formatNumber(stock)} kg` : undefined}
          style={styles.field}
        />
        <Field
          testID="out-quantity"
          label="Lượng xuất (kg)"
          value={quantity}
          onChangeText={v => {
            setQuantity(v);
            setError(null);
          }}
          placeholder="20"
          keyboardType="numeric"
          error={error}
          hint={
            fifo
              ? enough
                ? `Giá xuất (FIFO): ${formatVnd(Math.round(fifo.unitPrice))}/kg · ≈ ${formatVnd(Math.round(fifo.totalCost))}`
                : `Kho chỉ còn ${formatNumber(stock)} kg — thiếu ${formatNumber(quantityKg - stock)} kg`
              : undefined
          }
          style={styles.field}
        />
        <DateField testID="out-date" label="Ngày xuất" value={date} onChange={setDate} maximumDate={new Date()} style={styles.field} />
        {plots.length > 0 ? (
          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Bón cho lô</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <SelectChip label="Không gắn lô" selected={plotId === null} onPress={() => setPlotId(null)} style={styles.chip} />
              {plots.map(p => (
                <SelectChip key={p.id} label={`${p.code} · ${p.name}`} selected={plotId === p.id} onPress={() => setPlotId(p.id)} style={styles.chip} />
              ))}
            </ScrollView>
          </View>
        ) : null}
        <Field testID="out-note" label="Ghi chú" value={note} onChangeText={setNote} placeholder="Bón thúc đợt mấy, ai làm…" style={styles.field} />
        <PrimaryButton testID="out-save" label="Lưu xuất" onPress={onSave} loading={saving} disabled={product !== null && quantityKg > 0 && !enough} />
      </Card>

      <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Lịch sử xuất</Text>
      {outs.length === 0 ? (
        <EmptyState icon={<WarehouseIcon color={colors.gray['400']} />} title="Chưa có phiếu xuất" body="Mỗi lần lấy phân ra bón, ghi ở đây để tồn kho và chi phí theo lô luôn đúng." />
      ) : (
        <HistoryList rows={outs} kind="out" author={author} />
      )}

      <ProductPickerSheet
        visible={picking}
        selectedId={product?.id ?? null}
        inStock={inStock}
        onClose={() => setPicking(false)}
        onPick={p => {
          if (!inStock.some(s => s.id === p.id)) {
            Alert.alert('Chưa có trong kho', `${p.name} chưa có phiếu nhập nào. Nhập kho trước rồi mới xuất.`);
            return;
          }
          setProduct(p);
          setError(null);
          setPicking(false);
        }}
      />
    </>
  );
}

/* ---------------------------------- Tồn ---------------------------------- */

function StockTab({ins, outs}: {ins: WarehouseIn[]; outs: WarehouseOut[]}) {
  const [period, setPeriod] = useState<PeriodFilter>({kind: 'all'});
  const [focusId, setFocusId] = useState<string | null>(null);

  const inRows = useMemo(() => toInRows(ins), [ins]);
  const outRows = useMemo(() => toOutRows(outs), [outs]);

  // Stock at the end of the period; movements within it.
  const bounds = periodBounds(period);
  const end = bounds ? bounds[1] : Number.POSITIVE_INFINITY;
  const insToEnd = useMemo(() => inRows.filter(r => r.occurredAt < end), [inRows, end]);
  const outsToEnd = useMemo(() => outRows.filter(r => r.occurredAt < end), [outRows, end]);
  const summary = useMemo(() => stockSummary(insToEnd, outsToEnd), [insToEnd, outsToEnd]);
  const moved = useMemo(() => {
    const map = new Map<string, {inKg: number; outKg: number}>();
    for (const r of inRows) if (inPeriod(r.occurredAt, period)) map.set(r.fertilizerId, {inKg: (map.get(r.fertilizerId)?.inKg ?? 0) + r.quantityKg, outKg: map.get(r.fertilizerId)?.outKg ?? 0});
    for (const r of outRows) if (inPeriod(r.occurredAt, period)) map.set(r.fertilizerId, {inKg: map.get(r.fertilizerId)?.inKg ?? 0, outKg: (map.get(r.fertilizerId)?.outKg ?? 0) + r.quantityKg});
    return map;
  }, [inRows, outRows, period]);

  const totalValue = summary.reduce((s, l) => s + l.stockValue, 0);
  const totalStock = summary.reduce((s, l) => s + l.stockKg, 0);

  const timeline = useMemo(() => {
    const points = stockTimeline(insToEnd, outsToEnd, focusId ?? undefined);
    return bounds ? points.filter(p => p.day >= bounds[0] - 86_400_000) : points;
  }, [insToEnd, outsToEnd, focusId, bounds]);

  const exportCsv = useCallback(async () => {
    const csv = stockCsv(summary, formatVnd);
    try {
      await Share.share({title: 'ton-kho.csv', message: csv});
    } catch {
      // The farmer closed the share sheet — nothing to do.
    }
  }, [summary]);

  if (ins.length === 0) {
    return <EmptyState icon={<WarehouseIcon color={colors.gray['400']} />} title="Kho đang trống" body="Nhập phiếu mua phân đầu tiên ở tab Nhập; bảng tồn và biểu đồ sẽ hiện ở đây." />;
  }

  return (
    <>
      <PeriodPicker value={period} onChange={setPeriod} style={styles.period} />

      <Card style={styles.totals} testID="stock-totals">
        <View style={styles.totalsRow}>
          <View>
            <Text style={text('eyebrow', colors.text.muted)}>Tổng tồn</Text>
            <NumberText size="lg">{formatNumber(totalStock)} kg</NumberText>
          </View>
          <View style={styles.totalsRight}>
            <Text style={text('eyebrow', colors.text.muted)}>Giá trị tồn</Text>
            <NumberText size="lg">{formatVnd(Math.round(totalValue))}</NumberText>
          </View>
        </View>
        <Text style={[text('caption', colors.text.muted), styles.totalsNote]}>
          Tồn = Σ nhập − Σ xuất · giá TB = Σ(kg × giá) / Σ kg · giá trị = tồn × giá TB
        </Text>
      </Card>

      <Text style={[text('eyebrow', colors.text.muted), styles.sectionLabel]}>Bảng tồn</Text>
      <Card flush style={styles.table}>
        <View style={[styles.tr, styles.th]}>
          <Text style={[text('caption', colors.text.muted), styles.tdName]}>Phân bón</Text>
          <Text style={[text('caption', colors.text.muted), styles.tdNum]}>Nhập</Text>
          <Text style={[text('caption', colors.text.muted), styles.tdNum]}>Xuất</Text>
          <Text style={[text('caption', colors.text.muted), styles.tdNum]}>Tồn</Text>
        </View>
        {summary.map((line, index) => {
          const move = moved.get(line.fertilizerId) ?? {inKg: 0, outKg: 0};
          const selected = focusId === line.fertilizerId;
          return (
            <Pressable
              key={line.fertilizerId}
              testID={`stock-row-${line.fertilizerId}`}
              accessibilityRole="button"
              accessibilityState={{selected}}
              onPress={() => setFocusId(selected ? null : line.fertilizerId)}
              style={({pressed}) => [styles.tr, index === summary.length - 1 && styles.trLast, selected && styles.trSelected, pressed && styles.trPressed]}>
              <View style={styles.tdName}>
                <Text style={text('bodySm')} numberOfLines={1}>
                  {line.fertilizerName}
                </Text>
                <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                  TB {formatVnd(Math.round(line.avgPrice))}/kg · {formatVnd(Math.round(line.stockValue))}
                </Text>
              </View>
              <NumberText size="sm" color={colors.text.secondary} style={styles.tdNum}>
                {formatNumber(period.kind === 'all' ? line.inKg : move.inKg)}
              </NumberText>
              <NumberText size="sm" color={colors.text.secondary} style={styles.tdNum}>
                {formatNumber(period.kind === 'all' ? line.outKg : move.outKg)}
              </NumberText>
              <NumberText size="sm" style={styles.tdNum}>
                {formatNumber(line.stockKg)}
              </NumberText>
            </Pressable>
          );
        })}
      </Card>
      <Text style={[text('caption', colors.text.muted), styles.tableNote]}>
        Đơn vị kg. {period.kind === 'all' ? 'Toàn bộ lịch sử.' : 'Nhập/Xuất trong kỳ, Tồn tính đến cuối kỳ.'} Chạm một dòng để vẽ riêng loại đó.
      </Text>

      <Card style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={text('cardTitle')}>Tồn theo thời gian</Text>
          {focusId ? <Badge label={summary.find(l => l.fertilizerId === focusId)?.fertilizerName ?? ''} tone="green" /> : <Badge label="Tất cả" tone="gray" />}
        </View>
        <LineChart
          testID="stock-chart"
          series={[{key: 'stock', label: 'Tồn (kg)', color: SERIES[0], points: timeline.map(p => ({x: p.day, y: p.stockKg}))}]}
          formatY={v => `${formatNumber(Math.round(v))} kg`}
          formatX={formatDate}
          interpolation="step"
          emptyText="Chưa có biến động trong kỳ."
        />
      </Card>

      <SecondaryButton testID="stock-export" label="Xuất CSV" icon={<ShareIcon />} onPress={exportCsv} style={styles.export} />
      <Text style={[text('caption', colors.text.muted), styles.tableNote]}>
        CSV gửi qua bảng chia sẻ của máy (Zalo, Gmail, Drive…). Cột: phân bón, nhập, xuất, tồn, giá TB, tổng tiền.
      </Text>
    </>
  );
}

/* ------------------------------- history ---------------------------------- */

function HistoryList({rows, kind, author}: {rows: (WarehouseIn | WarehouseOut)[]; kind: 'in' | 'out'; author: {id: string; name: string}}) {
  const confirmDelete = (row: WarehouseIn | WarehouseOut) => {
    Alert.alert('Xoá phiếu', `Xoá phiếu ${kind === 'in' ? 'nhập' : 'xuất'} ${row.fertilizerName} ngày ${formatDate(row.occurredAt)}?`, [
      {text: 'Huỷ', style: 'cancel'},
      {text: 'Xoá', style: 'destructive', onPress: () => deleteStockRow(row, author).catch(e => console.warn('[warehouse] delete failed', e))},
    ]);
  };

  return (
    <Card flush style={styles.table}>
      {rows.slice(0, 50).map((row, index) => {
        const isIn = row.table === 'warehouse_in';
        const amount = isIn ? (row as WarehouseIn).price : (row as WarehouseOut).totalCost;
        return (
          <View key={row.id} style={[styles.historyRow, index === Math.min(rows.length, 50) - 1 && styles.trLast]} testID={`history-${kind}-${row.id}`}>
            <View style={styles.historyBody}>
              <Text style={text('bodyStrong')} numberOfLines={1}>
                {row.fertilizerName}
              </Text>
              <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                {formatDate(row.occurredAt)}
                {row.note ? ` · ${row.note}` : ''}
              </Text>
            </View>
            <View style={styles.historyValue}>
              <NumberText size="md" color={isIn ? colors.primary.default : colors.text.secondary}>
                {isIn ? '+' : '−'}
                {formatNumber(row.quantityKg)} kg
              </NumberText>
              <Text style={text('caption', colors.text.muted)}>{formatVnd(Math.round(amount))}</Text>
            </View>
            <IconButton accessibilityLabel="Xoá phiếu" onPress={() => confirmDelete(row)} style={styles.trash}>
              <TrashIcon />
            </IconButton>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginHorizontal: space.lg,
    marginBottom: space.lg,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  formCard: {
    marginBottom: space.xl,
  },
  field: {
    marginBottom: space.lg,
  },
  label: {
    marginBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
  },
  rowItem: {
    flex: 1,
  },
  rowNarrow: {
    width: 128,
  },
  unitRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chips: {
    gap: space.sm,
    paddingRight: space.lg,
  },
  chip: {
    flex: 0,
    paddingHorizontal: space.md,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
    minHeight: 40,
  },
  checkLabel: {
    flex: 1,
  },
  sectionLabel: {
    marginBottom: space.sm,
  },
  table: {
    overflow: 'hidden',
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  th: {
    backgroundColor: colors.surface.subtle,
    minHeight: 36,
    paddingVertical: space.sm,
  },
  trLast: {
    borderBottomWidth: 0,
  },
  trSelected: {
    backgroundColor: colors.surface.selected,
  },
  trPressed: {
    backgroundColor: colors.surface.pressed,
  },
  tdName: {
    flex: 1,
    minWidth: 0,
  },
  tdNum: {
    width: 56,
    textAlign: 'right',
  },
  tableNote: {
    marginTop: space.sm,
    marginBottom: space.lg,
  },
  period: {
    marginBottom: space.lg,
  },
  totals: {
    marginBottom: space.lg,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.md,
  },
  totalsRight: {
    alignItems: 'flex-end',
  },
  totalsNote: {
    marginTop: space.md,
  },
  chartCard: {
    marginBottom: space.lg,
  },
  chartHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.md,
  },
  export: {
    marginBottom: space.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  historyBody: {
    flex: 1,
    minWidth: 0,
  },
  historyValue: {
    alignItems: 'flex-end',
  },
  trash: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
  },
});

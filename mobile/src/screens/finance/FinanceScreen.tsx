/**
 * Thu – Chi.
 *
 * Thu / Chi: a small form each (kind, description, amount, date, note) and the
 * history with a "đã kiểm tra" tick per line. Expenses booked from a stock
 * purchase carry a "Từ kho" badge and link back to the purchase.
 * Báo cáo: month or quarter — totals, lãi/lỗ, thu vs chi by day, chi by kind,
 * CSV export through the share sheet. Everything from SQLite.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {IconButton, PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {DonutChart} from '../../components/charts/DonutChart';
import {LineChart} from '../../components/charts/LineChart';
import {EXPENSE_COLOR, EXPENSE_KIND_COLOR, INCOME_COLOR} from '../../components/charts/palette';
import {DateField} from '../../components/DateField';
import {EmptyState} from '../../components/EmptyState';
import {Field, SelectChip} from '../../components/form';
import {CheckboxIcon, CoinsIcon, ShareIcon, TrashIcon} from '../../components/icons';
import {NumberText} from '../../components/NumberText';
import {PeriodPicker} from '../../components/PeriodPicker';
import {Screen} from '../../components/Screen';
import {Tabs} from '../../components/Tabs';
import type Expense from '../../db/models/Expense';
import type Income from '../../db/models/Income';
import type Plot from '../../db/models/Plot';
import {addExpense, addIncome, deleteEntry, observeExpense, observeIncome, setChecked, toEntries} from '../../db/repositories/financeRepository';
import {observePlots} from '../../db/repositories/plotRepository';
import {useObservable} from '../../db/useObservable';
import type {ExpenseKind, IncomeKind} from '../../domain/finance';
import {EXPENSE_KINDS, expenseKindLabel, financialCsv, financialReport, INCOME_KINDS, incomeKindLabel} from '../../domain/finance';
import type {PeriodFilter} from '../../domain/warehouse';
import type {FinanceTab, RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {formatDate, formatVnd} from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Finance'>;

const TABS = [
  {key: 'income', label: 'Thu'},
  {key: 'expense', label: 'Chi'},
  {key: 'report', label: 'Báo cáo'},
] as const;

export function FinanceScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const [tab, setTab] = useState<FinanceTab>(params?.tab ?? 'income');

  const incomes = useObservable<Income[]>(() => observeIncome(user.id), [user.id], []);
  const expenses = useObservable<Expense[]>(() => observeExpense(user.id), [user.id], []);
  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);

  useEffect(() => {
    if (params?.tab) setTab(params.tab);
  }, [params?.tab]);

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AppHeader eyebrow="Tài chính nông hộ" title="Thu – Chi" onBack={() => navigation.goBack()} />
        <Tabs items={TABS} value={tab} onChange={setTab} style={styles.tabs} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {tab === 'income' ? <EntryTab side="income" rows={incomes} plots={plots} /> : null}
          {tab === 'expense' ? <EntryTab side="expense" rows={expenses} plots={plots} onOpenPurchase={id => navigation.navigate('Warehouse', {tab: 'in', prefill: {fertilizerId: id}})} /> : null}
          {tab === 'report' ? <ReportTab incomes={incomes} expenses={expenses} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/* ------------------------------ Thu / Chi -------------------------------- */

function EntryTab({side, rows, plots, onOpenPurchase}: {side: 'income' | 'expense'; rows: (Income | Expense)[]; plots: Plot[]; onOpenPurchase?: (fertilizerId: string) => void}) {
  const author = useChangeAuthor();
  const kinds = side === 'income' ? INCOME_KINDS : EXPENSE_KINDS;
  const [kind, setKind] = useState<string>(kinds[0].code);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<number>(Date.now());
  const [note, setNote] = useState('');
  const [plotId, setPlotId] = useState<string | null>(null);
  const [errors, setErrors] = useState<{description?: string; amount?: string}>({});
  const [saving, setSaving] = useState(false);

  const amountValue = Number(amount.replace(/[^\d]/g, '')) || 0;

  const onSave = useCallback(async () => {
    const next: typeof errors = {};
    if (!description.trim()) next.description = 'Nhập mô tả.';
    if (!(amountValue > 0)) next.amount = 'Số tiền phải lớn hơn 0.';
    setErrors(next);
    if (Object.keys(next).length > 0 || saving) return;
    setSaving(true);
    try {
      if (side === 'income') {
        await addIncome({kind: kind as IncomeKind, description, amount: amountValue, occurredAt: date, note: note.trim() || null, plotId}, author);
      } else {
        await addExpense({kind: kind as ExpenseKind, description, amount: amountValue, occurredAt: date, note: note.trim() || null, plotId, warehouseInId: null}, author);
      }
      setDescription('');
      setAmount('');
      setNote('');
    } catch (e) {
      Alert.alert('Không lưu được', e instanceof Error ? e.message : 'Thử lại.');
    } finally {
      setSaving(false);
    }
  }, [description, amountValue, saving, side, kind, date, note, plotId, author]);

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <Card style={styles.formCard}>
        <View style={styles.field}>
          <Text style={[text('meta', colors.text.secondary), styles.label]}>{side === 'income' ? 'Loại thu' : 'Loại chi'}</Text>
          <View style={styles.kinds}>
            {kinds.map(k => (
              <SelectChip key={k.code} label={k.label} selected={kind === k.code} onPress={() => setKind(k.code)} style={styles.kindChip} />
            ))}
          </View>
        </View>
        <Field
          testID={`${side}-description`}
          label="Mô tả"
          value={description}
          onChangeText={v => {
            setDescription(v);
            setErrors(e => ({...e, description: undefined}));
          }}
          placeholder={side === 'income' ? 'Bán 50 kg cà chua cho cửa hàng…' : 'Công bón phân (3 công)…'}
          error={errors.description}
          style={styles.field}
        />
        <Field
          testID={`${side}-amount`}
          label="Số tiền (₫)"
          value={amount}
          onChangeText={v => {
            setAmount(v);
            setErrors(e => ({...e, amount: undefined}));
          }}
          placeholder="1.500.000"
          keyboardType="numeric"
          money
          error={errors.amount}
          hint={amountValue > 0 ? `= ${formatVnd(amountValue)}` : undefined}
          style={styles.field}
        />
        <DateField testID={`${side}-date`} label="Ngày" value={date} onChange={setDate} maximumDate={new Date()} style={styles.field} />
        {plots.length > 0 ? (
          <View style={styles.field}>
            <Text style={[text('meta', colors.text.secondary), styles.label]}>Lô đất (tuỳ chọn)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <SelectChip label="Chung" selected={plotId === null} onPress={() => setPlotId(null)} style={styles.chip} />
              {plots.map(p => (
                <SelectChip key={p.id} label={p.code} selected={plotId === p.id} onPress={() => setPlotId(p.id)} style={styles.chip} />
              ))}
            </ScrollView>
          </View>
        ) : null}
        <Field testID={`${side}-note`} label="Ghi chú" value={note} onChangeText={setNote} placeholder={side === 'income' ? 'Bán cho ai, giá bao nhiêu một kg…' : 'Thuê ai, mua ở đâu…'} style={styles.field} />
        <PrimaryButton testID={`${side}-save`} label={side === 'income' ? 'Lưu khoản thu' : 'Lưu khoản chi'} onPress={onSave} loading={saving} />
      </Card>

      <View style={styles.sectionHead}>
        <Text style={text('eyebrow', colors.text.muted)}>Lịch sử {side === 'income' ? 'thu' : 'chi'}</Text>
        <NumberText size="sm" color={colors.text.secondary}>
          Tổng {formatVnd(total)}
        </NumberText>
      </View>
      {rows.length === 0 ? (
        <EmptyState icon={<CoinsIcon color={colors.gray['400']} />} title={side === 'income' ? 'Chưa có khoản thu' : 'Chưa có khoản chi'} body="Mỗi dòng gồm mô tả, số tiền, ngày và ô đánh dấu đã kiểm tra." />
      ) : (
        <Card flush style={styles.table}>
          {rows.slice(0, 60).map((row, index) => {
            const fromStock = side === 'expense' && (row as Expense).warehouseInId;
            return (
              <View key={row.id} style={[styles.entryRow, index === Math.min(rows.length, 60) - 1 && styles.trLast]} testID={`entry-${side}-${row.id}`}>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{checked: row.checked}}
                  accessibilityLabel={row.checked ? 'Đã kiểm tra' : 'Chưa kiểm tra'}
                  hitSlop={12}
                  onPress={() => setChecked(row, !row.checked, author).catch(e => console.warn('[finance] check failed', e))}>
                  <CheckboxIcon checked={row.checked} />
                </Pressable>
                <View style={styles.entryBody}>
                  <Text style={text('bodyStrong')} numberOfLines={2}>
                    {row.description}
                  </Text>
                  <View style={styles.entryMeta}>
                    <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                      {formatDate(row.occurredAt)} · {side === 'income' ? incomeKindLabel(row.kind) : expenseKindLabel(row.kind)}
                    </Text>
                    <Badge label={row.checked ? 'Đã kiểm tra' : 'Chưa kiểm tra'} tone={row.checked ? 'green' : 'gray'} />
                    {fromStock ? <Badge label="Từ kho" tone="blue" /> : null}
                  </View>
                  {row.note ? (
                    <Text style={text('caption', colors.text.muted)} numberOfLines={2}>
                      {row.note}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.entryValue}>
                  <NumberText
                    size="md"
                    numberOfLines={1}
                    color={side === 'income' ? colors.primary.default : colors.text.secondary}>
                    {side === 'income' ? '+' : '−'}
                    {formatVnd(row.amount)}
                  </NumberText>
                </View>
                <IconButton
                  accessibilityLabel="Xoá"
                  onPress={() =>
                    Alert.alert('Xoá dòng', `Xoá "${row.description}"?`, [
                      {text: 'Huỷ', style: 'cancel'},
                      {text: 'Xoá', style: 'destructive', onPress: () => deleteEntry(row, author).catch(e => console.warn('[finance] delete failed', e))},
                    ])
                  }
                  style={styles.trash}>
                  <TrashIcon />
                </IconButton>
              </View>
            );
          })}
        </Card>
      )}
      {onOpenPurchase ? (
        <Text style={[text('caption', colors.text.muted), styles.note]}>
          Khoản chi "Từ kho" được ghi tự động khi nhập kho; xoá phiếu nhập không xoá khoản chi và ngược lại.
        </Text>
      ) : null}
    </>
  );
}

/* -------------------------------- Báo cáo -------------------------------- */

function ReportTab({incomes, expenses}: {incomes: Income[]; expenses: Expense[]}) {
  const now = new Date();
  const [period, setPeriod] = useState<PeriodFilter>({kind: 'month', year: now.getFullYear(), month: now.getMonth() + 1});
  const report = useMemo(() => financialReport(toEntries(incomes), toEntries(expenses), period), [incomes, expenses, period]);
  const profitColor = report.profit >= 0 ? colors.primary.default : colors.text.danger;

  const exportCsv = useCallback(async () => {
    try {
      await Share.share({title: `thu-chi-${report.label}.csv`, message: financialCsv(report, formatVnd, formatDate)});
    } catch {
      // share sheet dismissed
    }
  }, [report]);

  const daily = report.daily;
  const hasData = report.incomes.length + report.expenses.length > 0;

  return (
    <>
      <PeriodPicker value={period} onChange={setPeriod} allowAll={false} style={styles.period} />

      <View style={styles.kpis}>
        <Card style={styles.kpi} testID="report-income">
          <Text style={text('eyebrow', colors.text.muted)}>Tổng thu</Text>
          <NumberText size="lg" numberOfLines={1}>
            {formatVnd(report.totalIncome)}
          </NumberText>
        </Card>
        <Card style={styles.kpi} testID="report-expense">
          <Text style={text('eyebrow', colors.text.muted)}>Tổng chi</Text>
          <NumberText size="lg" color={colors.text.secondary} numberOfLines={1}>
            {formatVnd(report.totalExpense)}
          </NumberText>
        </Card>
      </View>
      <Card style={[styles.profit, {borderColor: profitColor}]} testID="report-profit">
        <View style={styles.profitRow}>
          <View>
            <Text style={text('eyebrow', colors.text.muted)}>{report.profit >= 0 ? 'Lãi' : 'Lỗ'} — {report.label}</Text>
            <Text style={[text('caption', colors.text.muted), styles.formula]}>= Tổng thu − Tổng chi</Text>
          </View>
          <NumberText size="lg" color={profitColor} numberOfLines={1}>
            {formatVnd(report.profit)}
          </NumberText>
        </View>
      </Card>

      {!hasData ? (
        <EmptyState icon={<CoinsIcon color={colors.gray['400']} />} title="Không có giao dịch trong kỳ" body="Chọn kỳ khác hoặc ghi khoản thu / chi ở hai tab bên cạnh." />
      ) : (
        <>
          <Card style={styles.chartCard}>
            <Text style={[text('cardTitle'), styles.chartTitle]}>Thu và chi theo ngày</Text>
            <LineChart
              testID="report-line"
              series={[
                {key: 'income', label: 'Thu', color: INCOME_COLOR, points: daily.map(d => ({x: d.day, y: d.income}))},
                {key: 'expense', label: 'Chi', color: EXPENSE_COLOR, points: daily.map(d => ({x: d.day, y: d.expense}))},
              ]}
              formatY={v => formatVnd(Math.round(v))}
              formatX={formatDate}
            />
          </Card>

          <Card style={styles.chartCard}>
            <Text style={[text('cardTitle'), styles.chartTitle]}>Chi theo loại</Text>
            {report.expenseByKind.length === 0 ? (
              <Text style={text('bodySm', colors.text.muted)}>Không có khoản chi trong kỳ.</Text>
            ) : (
              <DonutChart
                testID="report-donut"
                slices={report.expenseByKind.map(k => ({key: k.kind, label: expenseKindLabel(k.kind), value: k.amount, color: EXPENSE_KIND_COLOR[k.kind] ?? colors.gray['400']}))}
                formatValue={formatVnd}
                centerValue={`${report.expenses.length}`}
                centerLabel="khoản chi"
              />
            )}
          </Card>
        </>
      )}

      <SecondaryButton testID="report-export" label="Xuất CSV" icon={<ShareIcon />} onPress={exportCsv} style={styles.export} />
      <Text style={[text('caption', colors.text.muted), styles.note]}>
        CSV: dòng 1 kỳ báo cáo · dòng 2 Thu, Chi, Lãi lỗ · từng giao dịch · dòng cuối tổng. Gửi qua bảng chia sẻ của máy.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  kinds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  kindChip: {
    flex: 0,
    minWidth: 96,
    paddingHorizontal: space.md,
  },
  chips: {
    gap: space.sm,
    paddingRight: space.lg,
  },
  chip: {
    flex: 0,
    paddingHorizontal: space.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  table: {
    overflow: 'hidden',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.default,
  },
  trLast: {
    borderBottomWidth: 0,
  },
  entryBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  entryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  entryValue: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: 140,
  },
  trash: {
    width: 40,
    height: 40,
    borderRadius: radius.xs,
  },
  note: {
    marginTop: space.sm,
  },
  period: {
    marginBottom: space.lg,
  },
  kpis: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.md,
  },
  kpi: {
    flex: 1,
    minWidth: 0,
  },
  profit: {
    marginBottom: space.lg,
  },
  profitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  formula: {
    marginTop: 2,
  },
  chartCard: {
    marginBottom: space.lg,
  },
  chartTitle: {
    marginBottom: space.md,
  },
  export: {
    marginBottom: space.sm,
  },
});

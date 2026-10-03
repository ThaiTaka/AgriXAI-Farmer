/**
 * Nói để ghi — speak one sentence, get the entry filled in, tap Lưu.
 *
 * Recognition runs on the phone (src/voice/speech.ts, Vosk, no network). The
 * sentence becomes a draft (src/domain/voiceEntry.ts) shown as an ordinary
 * form the farmer can correct: kind, amount, fertiliser, quantity, plot, day.
 * Nothing is written until "Lưu", and a saved entry can be taken back on the
 * spot ("Hoàn tác") — a misheard number must never sit in the books unseen.
 *
 * The example sentences double as a way in without a microphone: tapping one
 * fills the transcript exactly as if it had been spoken.
 */

import {useNavigation} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import type {BadgeTone} from '../../components/Badge';
import {Badge} from '../../components/Badge';
import {GhostButton, PrimaryButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {Field, PickerField, SelectChip} from '../../components/form';
import {AlertIcon, CheckCircleIcon, ChevronRight, MicIcon, StopIcon} from '../../components/icons';
import type {PickedProduct} from '../../components/ProductPickerSheet';
import {ProductPickerSheet} from '../../components/ProductPickerSheet';
import {Screen} from '../../components/Screen';
import type Expense from '../../db/models/Expense';
import type Income from '../../db/models/Income';
import type Plot from '../../db/models/Plot';
import type WarehouseIn from '../../db/models/WarehouseIn';
import type WarehouseOut from '../../db/models/WarehouseOut';
import {addExpense, addIncome, deleteEntry} from '../../db/repositories/financeRepository';
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
import type {ExpenseKind} from '../../domain/finance';
import {EXPENSE_KINDS} from '../../domain/finance';
import type {VoiceDraft, VoiceDraftKind} from '../../domain/voiceEntry';
import {heardSomething, matchPlot, parseVoiceEntry, quantityKg, resolveProduct, VOICE_EXAMPLES} from '../../domain/voiceEntry';
import {stockSummary} from '../../domain/warehouse';
import {colors, radius, size, space, text} from '../../theme';
import {formatNumber, formatVnd} from '../../utils/format';
import {fertilizerProduct, fertilizerProducts} from '../../utils/staticData';
import type {Listening} from '../../voice/speech';
import {listen, SpeechError} from '../../voice/speech';

type Phase = 'idle' | 'loading' | 'listening';

const KINDS: {code: Exclude<VoiceDraftKind, 'unknown'>; label: string; tone: BadgeTone}[] = [
  {code: 'income', label: 'Khoản thu', tone: 'green'},
  {code: 'expense', label: 'Khoản chi', tone: 'yellow'},
  {code: 'stock_in', label: 'Nhập kho', tone: 'blue'},
  {code: 'stock_out', label: 'Xuất kho', tone: 'purple'},
];

const DAY_MS = 86_400_000;
const DAYS = [
  {daysAgo: 0, label: 'Hôm nay'},
  {daysAgo: 1, label: 'Hôm qua'},
  {daysAgo: 2, label: 'Hôm kia'},
];

interface Form {
  kind: VoiceDraftKind;
  description: string;
  amount: string;
  kg: string;
  productId: string | null;
  plotId: string | null;
  expenseKind: ExpenseKind;
  daysAgo: number;
}

type Saved =
  | {table: 'income'; row: Income; summary: string}
  | {table: 'expense'; row: Expense; summary: string}
  | {table: 'stock'; row: WarehouseIn | WarehouseOut; summary: string};

const digits = (value: string) => value.replace(/[^\d]/g, '');

export function VoiceEntryScreen() {
  const navigation = useNavigation();
  const user = useCurrentUser();
  const author = useChangeAuthor();

  const plots = useObservable<Plot[]>(() => observePlots(user.id), [user.id], []);
  const ins = useObservable<WarehouseIn[]>(() => observeWarehouseIn(user.id), [user.id], []);
  const outs = useObservable<WarehouseOut[]>(() => observeWarehouseOut(user.id), [user.id], []);
  const inStockIds = useMemo(
    () => stockSummary(toInRows(ins), toOutRows(outs)).filter(l => l.stockKg > 0).map(l => l.fertilizerId),
    [ins, outs],
  );
  const catalogue = useMemo(() => fertilizerProducts().map(p => ({id: p.id, name: p.name, category: p.category, unit: p.unit})), []);

  const [phase, setPhase] = useState<Phase>('idle');
  const [partial, setPartial] = useState('');
  const [transcript, setTranscript] = useState('');
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const listening = useRef<Listening | null>(null);

  const read = useCallback(
    (sentence: string) => {
      const d = parseVoiceEntry(sentence);
      const product = resolveProduct(d.fertilizer, catalogue, inStockIds);
      const kg = quantityKg(d.quantity, product);
      setTranscript(d.transcript);
      setDraft(d);
      setSaved(null);
      setProblem(null);
      setForm({
        kind: d.kind,
        description: d.description,
        amount: d.amount !== null ? String(Math.round(d.amount)) : '',
        kg: kg !== null ? String(kg) : '',
        productId: product?.id ?? null,
        plotId: matchPlot(d, plots.map(p => ({id: p.id, code: p.code, name: p.name, cropName: p.cropName}))),
        expenseKind: d.expenseKind ?? 'other',
        daysAgo: d.daysAgo,
      });
    },
    [catalogue, inStockIds, plots],
  );

  const start = useCallback(async () => {
    setProblem(null);
    setSaved(null);
    // Speaking again replaces the draft; a stale one beside "Chưa nghe rõ"
    // would look like what was just heard.
    setDraft(null);
    setForm(null);
    setPartial('');
    setPhase('loading');
    try {
      const session = await listen({onPartial: setPartial});
      listening.current = session;
      setPhase('listening');
      const sentence = await session.result;
      listening.current = null;
      setPhase('idle');
      if (sentence && heardSomething(parseVoiceEntry(sentence))) read(sentence);
      else setProblem('Chưa nghe rõ. Bấm micro rồi nói to, rõ một câu — ví dụ như các câu mẫu bên dưới.');
    } catch (error) {
      listening.current = null;
      setPhase('idle');
      setProblem(error instanceof SpeechError ? error.message : 'Không nghe được, thử lại nhé.');
    }
  }, [read]);

  const stop = useCallback(() => listening.current?.finish(), []);

  // Leaving the screen ends the microphone session.
  useEffect(() => navigation.addListener('blur', () => listening.current?.finish()), [navigation]);
  useEffect(() => () => listening.current?.finish(), []);

  const product = form?.productId ? fertilizerProduct(form.productId) ?? null : null;
  const amount = form && digits(form.amount) ? Number(digits(form.amount)) : null;
  const kg = form && form.kg.trim() ? Number(form.kg.replace(',', '.')) : null;

  const blockers = useMemo(() => {
    if (!form) return [];
    const list: string[] = [];
    if (form.kind === 'unknown') list.push('Chọn loại ghi chép');
    if ((form.kind === 'income' || form.kind === 'expense') && !(amount && amount > 0)) list.push('Nhập số tiền');
    if ((form.kind === 'income' || form.kind === 'expense') && !form.description.trim()) list.push('Nhập nội dung');
    if ((form.kind === 'stock_in' || form.kind === 'stock_out') && !form.productId) list.push('Chọn loại phân');
    if ((form.kind === 'stock_in' || form.kind === 'stock_out') && !(kg && kg > 0)) list.push('Nhập số ký');
    return list;
  }, [form, amount, kg]);

  const save = useCallback(async () => {
    if (!form || blockers.length > 0) return;
    setSaving(true);
    setProblem(null);
    const occurredAt = Date.now() - form.daysAgo * DAY_MS;
    const note = `Ghi bằng giọng nói: “${transcript}”`;
    try {
      if (form.kind === 'income') {
        const row = await addIncome(
          {kind: 'product', description: form.description.trim(), amount: amount!, occurredAt, note, plotId: form.plotId},
          author,
        );
        setSaved({table: 'income', row, summary: `Đã ghi khoản thu ${formatVnd(amount!)}`});
      } else if (form.kind === 'expense') {
        const row = await addExpense(
          {kind: form.expenseKind, description: form.description.trim(), amount: amount!, occurredAt, note, plotId: form.plotId, warehouseInId: null},
          author,
        );
        setSaved({table: 'expense', row, summary: `Đã ghi khoản chi ${formatVnd(amount!)}`});
      } else if (form.kind === 'stock_in' && product) {
        const row = await addStockIn(
          {
            fertilizerId: product.id,
            fertilizerName: product.name,
            category: product.category,
            quantity: kg!,
            unit: 'kg',
            price: amount ?? 0,
            occurredAt,
            note,
            plotId: form.plotId,
            recordExpense: true,
          },
          author,
        );
        setSaved({table: 'stock', row, summary: `Đã nhập kho ${formatNumber(kg!)} kg ${product.name}`});
      } else if (form.kind === 'stock_out' && product) {
        const row = await addStockOut(
          {
            fertilizerId: product.id,
            fertilizerName: product.name,
            category: product.category,
            quantityKg: kg!,
            occurredAt,
            note,
            plotId: form.plotId,
            planId: null,
          },
          author,
        );
        setSaved({table: 'stock', row, summary: `Đã xuất kho ${formatNumber(kg!)} kg ${product.name}`});
      }
      setDraft(null);
      setForm(null);
    } catch (error) {
      setProblem(error instanceof InsufficientStockError ? error.message : 'Chưa lưu được, thử lại nhé.');
    } finally {
      setSaving(false);
    }
  }, [form, blockers, transcript, amount, kg, product, author]);

  const undo = useCallback(async () => {
    if (!saved) return;
    if (saved.table === 'stock') await deleteStockRow(saved.row, author);
    else await deleteEntry(saved.row, author);
    setSaved(null);
    read(transcript);
  }, [saved, author, read, transcript]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(f => (f ? {...f, [key]: value} : f));

  return (
    <Screen>
      <AppHeader eyebrow="Ghi nhanh" title="Nói để ghi" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.hero}>
          <MicButton phase={phase} onStart={start} onStop={stop} />
          <Text style={[text('subheading'), styles.center]} accessibilityLiveRegion="polite">
            {phase === 'loading'
              ? 'Đang chuẩn bị micro…'
              : phase === 'listening'
                ? partial || 'Đang nghe… cứ nói tự nhiên'
                : 'Bấm micro rồi nói một câu'}
          </Text>
          <Text style={[text('bodySm', colors.text.secondary), styles.center]}>
            Nhận dạng ngay trên máy, không cần mạng. Nói xong ngừng một nhịp là máy tự hiểu.
          </Text>
        </Card>

        {problem ? (
          <Card style={[styles.notice, styles.noticeWarn]}>
            <AlertIcon size={20} />
            <Text style={[text('bodySm', colors.badge.yellowFg), styles.flex]}>{problem}</Text>
          </Card>
        ) : null}

        {saved ? (
          <Card style={[styles.notice, styles.noticeOk]} testID="voice-saved">
            <CheckCircleIcon size={22} />
            <View style={styles.flex}>
              <Text style={text('cardTitle', colors.badge.greenFg)}>{saved.summary}</Text>
              <Text style={text('bodySm', colors.text.secondary)}>Sẽ tự đồng bộ lên máy chủ khi có mạng.</Text>
            </View>
            <GhostButton small label="Hoàn tác" onPress={undo} testID="voice-undo" />
          </Card>
        ) : null}

        {form && draft ? (
          <Card style={styles.card} testID="voice-draft">
            <Field
              label="Câu đã nghe (sửa được)"
              value={transcript}
              onChangeText={setTranscript}
              multiline
              numberOfLines={2}
              testID="voice-transcript"
            />
            <GhostButton small label="Đọc lại câu đã sửa" onPress={() => read(transcript)} />

            <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Ghi thành</Text>
            <View style={styles.chips}>
              {KINDS.map(k => (
                <SelectChip
                  key={k.code}
                  label={k.label}
                  selected={form.kind === k.code}
                  onPress={() => set('kind', k.code)}
                  style={styles.kindChip}
                />
              ))}
            </View>

            {form.kind === 'income' || form.kind === 'expense' ? (
              <Field label="Nội dung" value={form.description} onChangeText={v => set('description', v)} style={styles.field} />
            ) : null}

            {form.kind === 'expense' ? (
              <View style={styles.field}>
                <Text style={[text('meta', colors.text.secondary), styles.label]}>Loại chi</Text>
                <View style={styles.chips}>
                  {EXPENSE_KINDS.map(k => (
                    <SelectChip
                      key={k.code}
                      label={k.label}
                      selected={form.expenseKind === k.code}
                      onPress={() => set('expenseKind', k.code)}
                      style={styles.fitChip}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {form.kind === 'stock_in' || form.kind === 'stock_out' ? (
              <>
                <PickerField
                  label="Phân bón"
                  value={product?.name ?? ''}
                  placeholder={draft.fertilizer ? `${draft.fertilizer.spoken} — chọn đúng loại` : 'Chọn loại phân'}
                  icon={<ChevronRight />}
                  onPress={() => setPicking(true)}
                  style={styles.field}
                  testID="voice-product"
                />
                <Field
                  label="Số lượng (kg)"
                  value={form.kg}
                  onChangeText={v => set('kg', v)}
                  keyboardType="numeric"
                  hint={draft.quantity?.bags ? `${draft.quantity.bags} bao` : undefined}
                  style={styles.field}
                />
              </>
            ) : null}

            {form.kind !== 'stock_out' ? (
              <Field
                label={form.kind === 'stock_in' ? 'Tổng tiền mua' : 'Số tiền'}
                value={form.amount}
                onChangeText={v => set('amount', digits(v))}
                keyboardType="numeric"
                money
                hint={draft.unitPrice ? `${formatVnd(draft.unitPrice)} × ${formatNumber(draft.quantity?.value ?? 0)} ${draft.quantity?.unit ?? ''}` : undefined}
                style={styles.field}
                testID="voice-amount"
              />
            ) : null}

            {plots.length > 0 ? (
              <View style={styles.field}>
                <Text style={[text('meta', colors.text.secondary), styles.label]}>Lô đất</Text>
                <View style={styles.chips}>
                  <SelectChip label="Không gắn lô" selected={form.plotId === null} onPress={() => set('plotId', null)} style={styles.fitChip} />
                  {plots.map(p => (
                    <SelectChip
                      key={p.id}
                      label={p.cropName ? `${p.code || p.name} · ${p.cropName}` : p.code || p.name}
                      selected={form.plotId === p.id}
                      onPress={() => set('plotId', p.id)}
                      style={styles.fitChip}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[text('meta', colors.text.secondary), styles.label]}>Ngày</Text>
              <View style={styles.chips}>
                {DAYS.map(d => (
                  <SelectChip
                    key={d.daysAgo}
                    label={d.label}
                    selected={form.daysAgo === d.daysAgo}
                    onPress={() => set('daysAgo', d.daysAgo)}
                    style={styles.fitChip}
                  />
                ))}
              </View>
            </View>

            {blockers.length > 0 ? (
              <View style={styles.blockers}>
                {blockers.map(b => (
                  <Badge key={b} label={b} tone="yellow" />
                ))}
              </View>
            ) : null}

            <PrimaryButton
              label="Lưu"
              onPress={save}
              loading={saving}
              disabled={blockers.length > 0}
              style={styles.save}
              testID="voice-save"
            />
            <SecondaryButton label="Nói lại" onPress={start} small icon={<MicIcon size={18} />} />
          </Card>
        ) : null}

        {!form ? (
          <Card style={styles.card}>
            <Text style={[text('cardTitle'), styles.examplesTitle]}>Nói giống như</Text>
            {VOICE_EXAMPLES.map(example => (
              <Pressable
                key={example}
                accessibilityRole="button"
                accessibilityLabel={`Dùng câu mẫu: ${example}`}
                onPress={() => read(example)}
                style={({pressed}) => [styles.example, pressed && styles.examplePressed]}>
                <Text style={[text('body'), styles.flex]}>“{example}”</Text>
                <ChevronRight />
              </Pressable>
            ))}
            <Text style={[text('bodySm', colors.text.muted), styles.examplesNote]}>
              Bấm một câu mẫu để xem máy ghi thành gì. Thu, chi, nhập kho, xuất kho đều nói được; số tiền đọc bình thường
              như “một triệu rưỡi”, “hai trăm tư nghìn”.
            </Text>
          </Card>
        ) : null}
      </ScrollView>

      <ProductPickerSheet
        visible={picking}
        selectedId={form?.productId ?? null}
        inStock={inStockIds.map(id => fertilizerProduct(id)).filter(Boolean).map(p => ({id: p!.id, name: p!.name, category: p!.category}))}
        onClose={() => setPicking(false)}
        onPick={(picked: PickedProduct) => {
          setPicking(false);
          set('productId', picked.id);
          const known = catalogue.find(p => p.id === picked.id) ?? null;
          const fromBags = draft ? quantityKg(draft.quantity, known) : null;
          if (fromBags !== null && form && !form.kg) set('kg', String(fromBags));
        }}
      />
    </Screen>
  );
}

/** The big round button; a slow ring breathes around it while listening. */
function MicButton({phase, onStart, onStop}: {phase: Phase; onStart: () => void; onStop: () => void}) {
  const ring = useRef(new Animated.Value(0)).current;
  const listeningNow = phase === 'listening';

  useEffect(() => {
    if (!listeningNow) {
      ring.setValue(0);
      return undefined;
    }
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then(reduced => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.timing(ring, {toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true}),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [listeningNow, ring]);

  const scale = ring.interpolate({inputRange: [0, 1], outputRange: [1, 1.6]});
  const opacity = ring.interpolate({inputRange: [0, 1], outputRange: [0.35, 0]});

  return (
    <View style={styles.micWrap}>
      {listeningNow ? <Animated.View style={[styles.ring, {transform: [{scale}], opacity}]} /> : null}
      <Pressable
        testID="voice-mic"
        accessibilityRole="button"
        accessibilityLabel={listeningNow ? 'Dừng nghe' : 'Bắt đầu nói'}
        disabled={phase === 'loading'}
        onPress={listeningNow ? onStop : onStart}
        style={({pressed}) => [styles.mic, listeningNow && styles.micListening, pressed && styles.micPressed]}>
        {listeningNow ? <StopIcon size={30} /> : <MicIcon size={38} color={colors.white} />}
      </Pressable>
    </View>
  );
}

const MIC = 96;

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
    gap: space.lg,
  },
  hero: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space['2xl'],
  },
  center: {
    textAlign: 'center',
  },
  micWrap: {
    width: MIC * 1.7,
    height: MIC * 1.7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.primary.default,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.primary.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micListening: {
    backgroundColor: colors.badge.redFg,
  },
  micPressed: {
    opacity: 0.85,
    transform: [{scale: 0.97}],
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  noticeWarn: {
    backgroundColor: colors.badge.yellowBg,
    borderColor: colors.badge.yellowBg,
  },
  noticeOk: {
    backgroundColor: colors.badge.greenBg,
    borderColor: colors.badge.greenBg,
  },
  flex: {
    flex: 1,
  },
  card: {
    gap: space.sm,
  },
  section: {
    marginTop: space.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  // Two per row: "Khoản thu" must read in full, not "Khoản t…".
  kindChip: {
    flexGrow: 1,
    flexBasis: '45%',
  },
  // SelectChip stretches (flex: 1) to share a row; here each chip is as wide
  // as its words. `flex: 0` = size by content in React Native.
  fitChip: {
    flex: 0,
    paddingHorizontal: space.lg,
  },
  field: {
    marginTop: space.md,
  },
  label: {
    marginBottom: space.sm,
  },
  blockers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginTop: space.md,
  },
  save: {
    marginTop: space.lg,
  },
  examplesTitle: {
    marginBottom: space.xs,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: size.minTouchTarget,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface.subtle,
  },
  examplePressed: {
    backgroundColor: colors.surface.pressed,
    opacity: 0.8,
  },
  examplesNote: {
    marginTop: space.sm,
  },
});

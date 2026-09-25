/**
 * V2.1 — Chi tiết công việc.
 *
 * One care task on one plot: whether it is done, how the farmer actually did
 * it (notes, photos, a short video — "làm như thế nào"), and what hired help
 * cost. Everything is written to the phone first and syncs later; photos and
 * videos upload in the background once there is signal.
 *
 * The tasks_history row this hangs off is created the first time something is
 * recorded, so a farmer can note "thuê 2 người" before ticking the task done.
 */

import {of} from '@nozbe/watermelondb/utils/rx';
import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {GhostButton, PrimaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {Checkbox} from '../../components/Checkbox';
import {DateField} from '../../components/DateField';
import {Field, SelectChip} from '../../components/form';
import {ChevronRight, TrashIcon, VideoIcon} from '../../components/icons';
import {MediaCaptureBar} from '../../components/MediaCaptureBar';
import {MediaStrip} from '../../components/MediaStrip';
import {Screen} from '../../components/Screen';
import type CareGuide from '../../db/models/CareGuide';
import type Expense from '../../db/models/Expense';
import type TaskHistory from '../../db/models/TaskHistory';
import type TaskNote from '../../db/models/TaskNote';
import {observeCareGuides} from '../../db/repositories/careGuideRepository';
import {addLaborCost, deleteEntry, observeTaskLabor} from '../../db/repositories/financeRepository';
import type {TaskRef} from '../../db/repositories/taskHistoryRepository';
import {ensureTaskRow, observeTaskRow, setTaskDone} from '../../db/repositories/taskHistoryRepository';
import {addNote, deleteNote, observeTaskNotes} from '../../db/repositories/taskNoteRepository';
import {useObservable} from '../../db/useObservable';
import {protocolById, TASK_TYPE_LABELS} from '../../domain/careProtocol';
import type {LaborUnit} from '../../domain/labor';
import {describeLabor, LABOR_UNITS, laborAmount, parseDecimal} from '../../domain/labor';
import type {MediaRef} from '../../domain/media';
import {parseMediaRefs} from '../../domain/media';
import {deleteLocalMedia} from '../../media/mediaStore';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {formatDate, formatVnd} from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'TaskDetail'>;

export function TaskDetailScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const user = useCurrentUser();
  const author = useChangeAuthor();
  const ref: TaskRef = params;

  const protocol = protocolById(ref.protocolId);
  const stage = protocol?.stages.find(s => s.stage_code === ref.stageCode);
  const task = stage?.tasks.find(t => t.key === ref.taskKey);

  const rows = useObservable<TaskHistory[]>(
    () => observeTaskRow(user.id, ref),
    [user.id, ref.protocolId, ref.stageCode, ref.taskKey, ref.plotId],
    [],
  );
  const row = rows[0] ?? null;
  const notes = useObservable<TaskNote[]>(() => (row ? observeTaskNotes(row.id) : of([])), [row?.id], []);
  const labor = useObservable<Expense[]>(() => (row ? observeTaskLabor(row.id) : of([])), [row?.id], []);
  const guides = useObservable<CareGuide[]>(() => observeCareGuides(ref.cropType), [ref.cropType], []);
  // A guide written for this stage first, then the crop's general ones.
  const relevant = useMemo(
    () =>
      guides
        .filter(g => !g.stageCode || g.stageCode === ref.stageCode)
        .sort((a, b) => Number(b.stageCode === ref.stageCode) - Number(a.stageCode === ref.stageCode)),
    [guides, ref.stageCode],
  );

  const laborTotal = labor.reduce((s, r) => s + r.amount, 0);

  return (
    <Screen>
      <AppHeader eyebrow={stage?.stage_name_vi ?? 'Công việc'} title={ref.taskTitle} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          {task ? (
            <>
              <Badge label={TASK_TYPE_LABELS[task.type]} tone="gray" style={styles.typeBadge} />
              <Text style={text('body', colors.text.secondary)}>{task.detail}</Text>
              {task.timing ? (
                <Text style={[text('bodySm', colors.text.muted), styles.gapTop]}>Thời điểm: {task.timing}</Text>
              ) : null}
            </>
          ) : null}
          <Checkbox
            testID="task-done"
            label="Đã làm xong việc này"
            checked={row?.done ?? false}
            onChange={next => {
              setTaskDone(ref, next, author).catch(error => console.warn('[task] tick failed', error));
            }}
            style={styles.gapTop}
          />
          {/* The date sits apart from the ticked label, which the checkbox strikes through. */}
          {row?.done && row.doneAt ? (
            <Text style={text('caption', colors.primary.default)}>Đánh dấu đã làm ngày {formatDate(row.doneAt)}</Text>
          ) : null}
        </Card>

        {relevant.length > 0 ? (
          <Card flush style={styles.card}>
            {relevant.slice(0, 3).map((g, i) => (
              <Pressable
                key={g.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate('CareGuide', {guideId: g.id})}
                style={({pressed}) => [styles.guideRow, i > 0 && styles.divider, pressed && styles.pressed]}>
                <VideoIcon />
                <View style={styles.flex}>
                  <Text style={text('caption', colors.text.muted)}>Xem cách làm</Text>
                  <Text style={text('bodyStrong')} numberOfLines={2}>
                    {g.title}
                  </Text>
                </View>
                <ChevronRight />
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Ghi chú và ảnh/video</Text>
        <NoteComposer taskRef={ref} />
        {notes.map(note => (
          <NoteCard key={note.id} note={note} />
        ))}

        <Text style={[text('eyebrow', colors.text.muted), styles.section]}>Tiền thuê nhân công</Text>
        <Card style={styles.card}>
          <View style={styles.totalRow}>
            <Text style={text('bodySm', colors.text.secondary)}>Tổng tiền công việc này</Text>
            <Text style={text('subheading')} testID="labor-total">
              {formatVnd(laborTotal)}
            </Text>
          </View>
          {labor.map(cost => (
            <LaborRow key={cost.id} cost={cost} />
          ))}
          <Text style={[text('caption', colors.text.muted), styles.gapTop]}>
            Tiền công ghi ở đây cũng là một khoản chi "Công nhân" trong Thu – Chi và báo cáo tháng.
          </Text>
        </Card>
        <LaborForm taskRef={ref} />
      </ScrollView>
    </Screen>
  );
}

/* --------------------------------- notes --------------------------------- */

function NoteComposer({taskRef}: {taskRef: TaskRef}) {
  const author = useChangeAuthor();
  const [textValue, setText] = useState('');
  const [media, setMedia] = useState<MediaRef[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    if (!textValue.trim() && media.length === 0) {
      setError('Viết vài chữ hoặc thêm ít nhất một ảnh/video.');
      return;
    }
    setSaving(true);
    try {
      const row = await ensureTaskRow(taskRef, author);
      await addNote(row, {text: textValue, media}, author);
      setText('');
      setMedia([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được ghi chú.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (ref: MediaRef) => {
    setMedia(prev => prev.filter(m => m.id !== ref.id));
    deleteLocalMedia([ref]).catch(() => {});
  };

  return (
    <Card style={styles.card}>
      <Field
        label="Bạn đã làm thế nào?"
        value={textValue}
        onChangeText={setText}
        multiline
        numberOfLines={3}
        placeholder="VD: Bón quanh gốc cách 10 cm, 1 nắm phân/gốc, tưới ngay sau khi bón"
        error={error}
        testID="note-text"
      />
      <MediaCaptureBar onAdd={refs => setMedia(prev => [...prev, ...refs])} style={styles.gapTop} />
      <MediaStrip refs={media} onRemove={remove} style={styles.gapTop} testID="note-media-draft" />
      <PrimaryButton label="Lưu ghi chú" onPress={save} loading={saving} style={styles.gapTop} testID="note-save" />
    </Card>
  );
}

function NoteCard({note}: {note: TaskNote}) {
  const author = useChangeAuthor();
  const refs = useMemo(() => parseMediaRefs(note.mediaJson), [note.mediaJson]);
  const pending = refs.filter(r => !r.uploaded).length;

  const onDelete = () =>
    Alert.alert('Xoá ghi chú', 'Xoá ghi chú này cùng ảnh/video đi kèm?', [
      {text: 'Huỷ', style: 'cancel'},
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(note, author);
          await deleteLocalMedia(refs);
        },
      },
    ]);

  return (
    <Card style={styles.card} testID={`note-${note.id}`}>
      <View style={styles.noteHead}>
        <Text style={[text('caption', colors.text.muted), styles.flex]}>
          {formatDate(note.occurredAt)}
          {pending ? ` · ${pending} tệp chờ tải lên` : ''}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Xoá ghi chú" hitSlop={12} onPress={onDelete} style={styles.trash}>
          <TrashIcon />
        </Pressable>
      </View>
      {note.noteText ? <Text style={[text('body'), styles.gapTopSm]}>{note.noteText}</Text> : null}
      <MediaStrip refs={refs} style={styles.gapTopSm} />
    </Card>
  );
}

/* --------------------------------- labour -------------------------------- */

function LaborRow({cost}: {cost: Expense}) {
  const author = useChangeAuthor();
  const working = describeLabor(cost);
  return (
    <View style={[styles.laborRow, styles.divider]}>
      <View style={styles.flex}>
        <Text style={text('bodyStrong')}>{cost.description}</Text>
        {working ? <Text style={text('bodySm', colors.text.secondary)}>{working}</Text> : null}
        <Text style={text('caption', colors.text.muted)}>{formatDate(cost.occurredAt)}</Text>
      </View>
      <Text style={text('bodyStrong')}>{formatVnd(cost.amount)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xoá tiền công ${cost.description}`}
        hitSlop={12}
        style={styles.trash}
        onPress={() =>
          Alert.alert('Xoá tiền công', `Xoá "${cost.description}"? Khoản chi này cũng biến mất khỏi Thu – Chi.`, [
            {text: 'Huỷ', style: 'cancel'},
            {text: 'Xoá', style: 'destructive', onPress: () => deleteEntry(cost, author)},
          ])
        }>
        <TrashIcon />
      </Pressable>
    </View>
  );
}

function LaborForm({taskRef}: {taskRef: TaskRef}) {
  const author = useChangeAuthor();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState<LaborUnit>('hour');
  const [workers, setWorkers] = useState('1');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [occurredAt, setOccurredAt] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = laborAmount(unit, parseDecimal(workers), parseDecimal(quantity), Number(price) || 0);
  const per = LABOR_UNITS.find(u => u.code === unit)?.per ?? '';

  if (!open) {
    return (
      <GhostButton label="+ Thêm tiền thuê người" onPress={() => setOpen(true)} style={styles.addLabor} testID="labor-open" />
    );
  }

  const save = async () => {
    setError(null);
    if (total == null) {
      setError(unit === 'lump' ? 'Nhập số tiền khoán.' : 'Nhập số người, số giờ/ngày và đơn giá.');
      return;
    }
    setSaving(true);
    try {
      const row = await ensureTaskRow(taskRef, author);
      await addLaborCost(
        row,
        {
          description,
          unit,
          workers: parseDecimal(workers),
          quantity: parseDecimal(quantity),
          unitPrice: Number(price),
          occurredAt,
          note: null,
        },
        author,
      );
      setDescription('');
      setQuantity('');
      setPrice('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={styles.card} testID="labor-form">
      <Text style={text('cardTitle')}>Thêm tiền thuê người</Text>
      <Field
        label="Việc thuê làm"
        value={description}
        onChangeText={setDescription}
        placeholder={`VD: Thuê ${taskRef.taskTitle.toLowerCase()}`}
        style={styles.gapTop}
      />
      <Text style={[text('meta', colors.text.secondary), styles.gapTop]}>Trả công theo</Text>
      <View style={styles.chips}>
        {LABOR_UNITS.map(u => (
          <SelectChip key={u.code} label={u.label} selected={unit === u.code} onPress={() => setUnit(u.code)} />
        ))}
      </View>
      {unit !== 'lump' ? (
        <View style={styles.twoCol}>
          <Field
            label="Số người"
            value={workers}
            onChangeText={setWorkers}
            keyboardType="numeric"
            style={styles.flex}
            testID="labor-workers"
          />
          <Field
            label={`Số ${per} mỗi người`}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="numeric"
            placeholder="VD: 2"
            style={styles.flex}
            testID="labor-quantity"
          />
        </View>
      ) : null}
      <Field
        label={unit === 'lump' ? 'Số tiền khoán (₫)' : `Tiền công 1 người / ${per} (₫)`}
        value={price}
        onChangeText={setPrice}
        keyboardType="numeric"
        money
        placeholder={unit === 'hour' ? 'VD: 30.000' : unit === 'day' ? 'VD: 250.000' : 'VD: 500.000'}
        style={styles.gapTop}
        testID="labor-price"
      />
      <DateField label="Ngày thuê" value={occurredAt} onChange={setOccurredAt} maximumDate={new Date()} style={styles.gapTop} />
      <View style={[styles.totalRow, styles.gapTop]}>
        <Text style={text('bodySm', colors.text.secondary)}>Thành tiền</Text>
        <Text style={text('subheading', colors.primary.default)} testID="labor-preview">
          {total == null ? '—' : formatVnd(total)}
        </Text>
      </View>
      {error ? <Text style={[text('caption', colors.text.danger), styles.gapTopSm]}>{error}</Text> : null}
      <View style={styles.formActions}>
        <GhostButton label="Huỷ" onPress={() => setOpen(false)} />
        <PrimaryButton label="Lưu tiền công" onPress={save} loading={saving} style={styles.flex} testID="labor-save" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  card: {
    marginBottom: space.md,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    marginBottom: space.sm,
  },
  gapTop: {
    marginTop: space.md,
  },
  gapTopSm: {
    marginTop: space.xs,
  },
  section: {
    marginTop: space.lg,
    marginBottom: space.sm,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trash: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -space.sm,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  laborRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingTop: space.md,
    marginTop: space.md,
  },
  chips: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  twoCol: {
    flexDirection: 'row',
    gap: space.md,
    marginTop: space.md,
  },
  addLabor: {
    alignSelf: 'flex-start',
    marginLeft: -space.md,
  },
  formActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.lg,
  },
});

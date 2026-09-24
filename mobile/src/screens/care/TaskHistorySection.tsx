/**
 * Lịch sử công việc of one plot: every task of its care protocol, "Chưa làm"
 * and "Đã làm", each with what the farmer recorded on it. Tap a task to open
 * its notes, photos and labour (TaskDetail).
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useCurrentUser} from '../../auth/AuthContext';
import {Card} from '../../components/Card';
import {SegmentedControl} from '../../components/form';
import {CheckCircleIcon, ChevronRight, ClockIcon} from '../../components/icons';
import type Expense from '../../db/models/Expense';
import type TaskHistory from '../../db/models/TaskHistory';
import type TaskNote from '../../db/models/TaskNote';
import {observePlotExpenses} from '../../db/repositories/financeRepository';
import {observePlotTasks} from '../../db/repositories/taskHistoryRepository';
import {observePlotNotes} from '../../db/repositories/taskNoteRepository';
import {useObservable} from '../../db/useObservable';
import type {CareProtocol} from '../../domain/careProtocol';
import type {TaskHistoryItem} from '../../domain/taskHistory';
import {describeRecords, taskHistoryFor} from '../../domain/taskHistory';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {formatDate, formatVnd} from '../../utils/format';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TaskHistorySection({protocol, plotId}: {protocol: CareProtocol; plotId: string}) {
  const user = useCurrentUser();
  const navigation = useNavigation<Nav>();
  const rows = useObservable<TaskHistory[]>(() => observePlotTasks(user.id, plotId), [user.id, plotId], []);
  const notes = useObservable<TaskNote[]>(() => observePlotNotes(user.id, plotId), [user.id, plotId], []);
  const expenses = useObservable<Expense[]>(() => observePlotExpenses(user.id, plotId), [user.id, plotId], []);

  const history = useMemo(
    () =>
      taskHistoryFor(
        protocol,
        rows.filter(r => r.protocolId === protocol.id),
        notes,
        expenses.filter(e => e.kind === 'labor').map(e => ({taskId: e.taskId, amount: e.amount})),
      ),
    [protocol, rows, notes, expenses],
  );
  const [tab, setTab] = useState<'pending' | 'done'>('pending');
  const items = tab === 'pending' ? history.pending : history.done;

  const open = (item: TaskHistoryItem) =>
    navigation.navigate('TaskDetail', {
      protocolId: protocol.id,
      stageCode: item.stage.stage_code,
      taskKey: item.task.key,
      taskTitle: item.task.title,
      cropType: protocol.crop_type,
      plotId,
    });

  return (
    <View style={styles.root} testID="task-history">
      <Text style={[text('eyebrow', colors.text.muted), styles.label]}>Lịch sử công việc</Text>
      <SegmentedControl
        items={[
          {key: 'pending', label: `Chưa làm · ${history.pending.length}`},
          {key: 'done', label: `Đã làm · ${history.done.length}`},
        ]}
        value={tab}
        onChange={setTab}
        style={styles.segment}
      />
      {items.length === 0 ? (
        <Text style={[text('bodySm', colors.text.muted), styles.empty]}>
          {tab === 'pending' ? 'Đã làm hết công việc của quy trình.' : 'Chưa đánh dấu công việc nào là đã làm.'}
        </Text>
      ) : (
        <Card flush style={styles.card}>
          {items.map((item, index) => {
            const records = describeRecords(item, formatVnd);
            return (
              <Pressable
                key={`${item.stage.stage_code}/${item.task.key}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.task.title}, ${item.done ? 'đã làm' : 'chưa làm'}`}
                onPress={() => open(item)}
                testID={`history-${item.stage.stage_code}-${item.task.key}`}
                style={({pressed}) => [styles.row, index > 0 && styles.divider, pressed && styles.pressed]}>
                {item.done ? <CheckCircleIcon /> : <ClockIcon size={20} />}
                <View style={styles.body}>
                  <Text style={text('bodyStrong')} numberOfLines={2}>
                    {item.task.title}
                  </Text>
                  <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                    {item.stageIndex + 1}. {item.stage.stage_name_vi}
                    {item.done && item.doneAt ? ` · làm ngày ${formatDate(item.doneAt)}` : ''}
                  </Text>
                  {records ? <Text style={text('caption', colors.primary.default)}>{records}</Text> : null}
                </View>
                <ChevronRight />
              </Pressable>
            );
          })}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: space.lg,
  },
  label: {
    marginBottom: space.sm,
  },
  segment: {
    marginBottom: space.md,
  },
  card: {
    overflow: 'hidden',
  },
  empty: {
    paddingVertical: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 64,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
  },
  pressed: {
    backgroundColor: colors.surface.pressed,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});

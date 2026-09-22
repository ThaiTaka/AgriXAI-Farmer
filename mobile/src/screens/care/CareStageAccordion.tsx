import DateTimePicker from '@react-native-community/datetimepicker';
import React, {useCallback, useMemo, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {useChangeAuthor, useCurrentUser} from '../../auth/AuthContext';
import {Badge} from '../../components/Badge';
import {ProgressBar} from '../../components/ProgressBar';
import {Card} from '../../components/Card';
import {BellIcon, CheckboxIcon, ChevronRight} from '../../components/icons';
import type TaskHistory from '../../db/models/TaskHistory';
import {
  historyKey,
  observeTaskHistory,
  setTaskDone,
  setTaskReminder,
} from '../../db/repositories/taskHistoryRepository';
import {useObservable} from '../../db/useObservable';
import type {CareProtocol, CareStage} from '../../domain/careProtocol';
import {TASK_TYPE_LABELS} from '../../domain/careProtocol';
import {colors, radius, size, space, text} from '../../theme';
import {formatDate} from '../../utils/format';

interface Props {
  protocol: CareProtocol;
  /** Null when the protocol is viewed on its own, not for a plot. */
  plotId: string | null;
  /** Stage to open first (the one the plot is in). */
  currentStageCode?: string | null;
  /** Show only these stages (the plot tab shows just the current one). */
  onlyStage?: string | null;
}

/**
 * F5–F6 — the four rounds of a protocol as an accordion. Each task is a small
 * card with a "Đã làm?" checkbox and a reminder button; ticks land in
 * `tasks_history` on the device and sync later. The app never ticks a task
 * itself — the farmer's tap is the confirmation.
 */
export function CareStageAccordion({protocol, plotId, currentStageCode, onlyStage}: Props) {
  const user = useCurrentUser();
  const author = useChangeAuthor();
  const [open, setOpen] = useState<string | null>(currentStageCode ?? protocol.stages[0]?.stage_code ?? null);
  const [reminderFor, setReminderFor] = useState<{stage: CareStage; taskKey: string; title: string} | null>(null);

  const history = useObservable<TaskHistory[]>(
    () => observeTaskHistory(user.id, protocol.id, plotId),
    [user.id, protocol.id, plotId],
    [],
  );
  const byTask = useMemo(() => {
    const map = new Map<string, TaskHistory>();
    for (const row of history) map.set(historyKey(row.stageCode, row.taskKey), row);
    return map;
  }, [history]);

  const toggle = useCallback(
    (stage: CareStage, taskKey: string, title: string, done: boolean) => {
      setTaskDone(
        {protocolId: protocol.id, stageCode: stage.stage_code, taskKey, taskTitle: title, cropType: protocol.crop_type, plotId},
        done,
        author,
      ).catch(error => console.warn('[care] tick failed', error));
    },
    [protocol, plotId, author],
  );

  const stages = onlyStage ? protocol.stages.filter(s => s.stage_code === onlyStage) : protocol.stages;
  const itemName = (key: string) =>
    protocol.scenarios.flatMap(s => s.items).find(i => i.key === key)?.name ?? key;

  return (
    <View style={styles.list}>
      {stages.map(stage => {
        // Number by position in the full protocol, even when only one stage is shown.
        const index = protocol.stages.indexOf(stage);
        const expanded = onlyStage ? true : open === stage.stage_code;
        const doneCount = stage.tasks.filter(t => byTask.get(historyKey(stage.stage_code, t.key))?.done).length;
        const isCurrent = stage.stage_code === currentStageCode;
        const headline =
          stage.pct_of_total_topdress !== null
            ? `${stage.pct_of_total_topdress}% phân thúc`
            : stage.timing;

        return (
          <Card key={stage.stage_code} flush style={styles.stage} testID={`stage-${stage.stage_code}`}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{expanded}}
              accessibilityLabel={`Giai đoạn ${index + 1}: ${stage.stage_name_vi}`}
              onPress={() => !onlyStage && setOpen(expanded ? null : stage.stage_code)}
              style={({pressed}) => [styles.header, pressed && !onlyStage && styles.headerPressed]}>
              <View style={styles.stageIndex}>
                <Text style={text('cardTitle', colors.primary.default)}>{index + 1}</Text>
              </View>
              <View style={styles.headerBody}>
                <View style={styles.headerTitleRow}>
                  <Text style={[text('cardTitle'), styles.headerTitle]} numberOfLines={2}>
                    {stage.stage_name_vi}
                  </Text>
                  {isCurrent ? <Badge label="Hiện tại" tone="green" /> : null}
                </View>
                <Text style={[text('bodySm', colors.text.secondary), styles.headerMeta]} numberOfLines={2}>
                  {headline}
                  {stage.duration_days ? ` · ${stage.duration_days} ngày` : ''}
                </Text>
                <ProgressBar
                  testID={`stage-progress-${stage.stage_code}`}
                  label={stage.stage_name_vi}
                  done={doneCount}
                  total={stage.tasks.length}
                />
              </View>
              {!onlyStage ? (
                <View style={[styles.chevron, expanded && styles.chevronOpen]}>
                  <ChevronRight />
                </View>
              ) : null}
            </Pressable>

            {expanded ? (
              <View style={styles.body}>
                {stage.pct_of_total_topdress === null && stage.timing ? (
                  <Text style={[text('bodySm', colors.text.secondary), styles.timing]}>Thời điểm: {stage.timing}</Text>
                ) : null}
                {stage.applications.length > 0 ? (
                  <View style={styles.chips}>
                    {stage.applications.map(app => (
                      <Badge key={app.item_key} label={`${app.pct}% ${itemName(app.item_key)}`} tone="blue" />
                    ))}
                  </View>
                ) : null}

                {stage.tasks.map(task => {
                  const row = byTask.get(historyKey(stage.stage_code, task.key));
                  const done = row?.done ?? false;
                  return (
                    <View key={task.key} style={styles.task} testID={`task-${stage.stage_code}-${task.key}`}>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{checked: done}}
                        accessibilityLabel={`Đã làm: ${task.title}`}
                        hitSlop={8}
                        onPress={() => toggle(stage, task.key, task.title, !done)}
                        style={styles.checkbox}>
                        <CheckboxIcon checked={done} />
                      </Pressable>
                      <View style={styles.taskBody}>
                        <View style={styles.taskTitleRow}>
                          <Text style={[text('bodyStrong'), styles.taskTitle, done && styles.taskDone]}>
                            {task.title}
                          </Text>
                          <Badge label={TASK_TYPE_LABELS[task.type]} tone="gray" />
                        </View>
                        <Text style={[text('bodySm', colors.text.secondary), styles.taskDetail]}>{task.detail}</Text>
                        {task.timing ? (
                          <Text style={[text('caption', colors.text.muted), styles.taskDetail]}>Thời điểm: {task.timing}</Text>
                        ) : null}
                        <View style={styles.taskFooter}>
                          <Text style={text('caption', colors.text.muted)}>
                            {done && row?.doneAt ? `Đã làm ${formatDate(row.doneAt)}` : 'Chưa làm'}
                            {row?.remindAt ? ` · nhắc ${formatDate(row.remindAt)}` : ''}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Đặt nhắc: ${task.title}`}
                            hitSlop={6}
                            onPress={() => setReminderFor({stage, taskKey: task.key, title: task.title})}
                            style={({pressed}) => [styles.remind, pressed && styles.remindPressed]}>
                            <BellIcon size={16} />
                            <Text style={text('caption', colors.primary.default)}>
                              {row?.remindAt ? 'Đổi nhắc' : 'Đặt nhắc'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </Card>
        );
      })}

      {reminderFor ? (
        <DateTimePicker
          value={new Date(Date.now() + 86_400_000)}
          mode="date"
          minimumDate={new Date()}
          onChange={(event, selected) => {
            const target = reminderFor;
            setReminderFor(null);
            if (event.type === 'set' && selected) {
              setTaskReminder(
                {
                  protocolId: protocol.id,
                  stageCode: target.stage.stage_code,
                  taskKey: target.taskKey,
                  taskTitle: target.title,
                  cropType: protocol.crop_type,
                  plotId,
                },
                selected.getTime(),
                author,
              ).catch(error => console.warn('[care] reminder failed', error));
            }
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.md,
  },
  stage: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: 64,
  },
  headerPressed: {
    backgroundColor: colors.surface.pressed,
  },
  stageIndex: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBody: {
    flex: 1,
    minWidth: 0,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  headerTitle: {
    flexShrink: 1,
  },
  headerMeta: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
  chevron: {
    transform: [{rotate: '0deg'}],
  },
  chevronOpen: {
    transform: [{rotate: '90deg'}],
  },
  body: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border.default,
    padding: space.lg,
    gap: space.md,
  },
  timing: {},
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  task: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.surface.page,
  },
  checkbox: {
    width: size.minTouchTarget,
    height: size.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -space.md,
  },
  taskBody: {
    flex: 1,
    minWidth: 0,
  },
  taskTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
  },
  taskTitle: {
    flex: 1,
  },
  taskDone: {
    color: colors.text.muted,
    textDecorationLine: 'line-through',
  },
  taskDetail: {
    marginTop: space.xs,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  remind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: size.minTouchTarget,
    paddingHorizontal: space.sm,
    borderRadius: radius.xs,
  },
  remindPressed: {
    backgroundColor: colors.primary.soft,
  },
});

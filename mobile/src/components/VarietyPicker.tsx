import React, {useCallback, useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChangeAuthor} from '../auth/AuthContext';
import type CropVariety from '../db/models/CropVariety';
import type {VarietyOption} from '../db/repositories/varietyRepository';
import {
  createVariety,
  mergeVarieties,
  observeVarieties,
} from '../db/repositories/varietyRepository';
import {useObservable} from '../db/useObservable';
import {colors, radius, spacing, text} from '../theme';
import {GhostButton, IconButton, PrimaryButton} from './buttons';
import {Field} from './form';
import {GlassSurface} from './GlassSurface';
import {ChevronLeft, PlusIcon} from './icons';
import {ScreenBackground} from './ScreenBackground';

interface Props {
  visible: boolean;
  cropType: string;
  cropName: string;
  selectedId: string | null;
  onSelect: (variety: VarietyOption) => void;
  onClose: () => void;
}

/**
 * Variety picker.
 *
 * The catalogue is an open list: anything seeded from
 * shared/data/crop_varieties.json plus whatever the farmer has added. "+ Thêm
 * giống mới" writes straight to SQLite and selects the new row immediately —
 * no network round trip, so it works in the middle of a field (Điều 1, Mục 6.4).
 */
export function VarietyPicker({
  visible,
  cropType,
  cropName,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const author = useChangeAuthor();
  const rows = useObservable<CropVariety[]>(() => observeVarieties(cropType), [cropType], []);
  // Bundled seed entries + database rows, deduplicated. Works with no network.
  const varieties = useMemo(() => mergeVarieties(cropType, rows), [cropType, rows]);

  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setAdding(false);
    setNewName('');
    setNewNote('');
    setError(null);
  }, []);

  const submitNew = useCallback(async () => {
    const name = newName.trim();
    if (!name) {
      setError('Nhập tên giống.');
      return;
    }
    if (varieties.some(v => v.name.toLowerCase() === name.toLowerCase())) {
      setError('Giống này đã có trong danh sách.');
      return;
    }

    const created = await createVariety(
      {name, cropType, cropName, note: newNote || null},
      author,
    );
    reset();
    onSelect({
      id: created.id,
      name: created.name,
      cropType: created.cropType,
      cropName: created.cropName,
      fruit: created.fruit,
      usage: created.usage,
      note: created.note,
      isSeed: false,
      approved: false,
    });
  }, [newName, newNote, varieties, cropType, cropName, author, reset, onSelect]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScreenBackground>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <IconButton
              accessibilityLabel="Đóng"
              onPress={() => {
                reset();
                onClose();
              }}>
              <ChevronLeft />
            </IconButton>
            <Text style={[text('screenHeading'), styles.headerTitle]}>Chọn giống cây</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {adding ? (
              <GlassSurface level="card" style={styles.addCard}>
                <Text style={text('cardTitle')}>Thêm giống mới</Text>
                <Text style={[text('caption', colors.text.alpha['68']), styles.addHint]}>
                  Giống mới được lưu ngay trên máy và sẽ đồng bộ lên hệ thống khi có mạng.
                </Text>
                <Field
                  testID="variety-name"
                  label="Tên giống"
                  value={newName}
                  onChangeText={value => {
                    setNewName(value);
                    if (error) setError(null);
                  }}
                  placeholder="Ví dụ: Cà chua beef Hà Lan"
                  error={error}
                  style={styles.addField}
                />
                <Field
                  label="Mô tả (không bắt buộc)"
                  value={newNote}
                  onChangeText={setNewNote}
                  placeholder="Đặc điểm quả, thời gian sinh trưởng…"
                  multiline
                  style={styles.addField}
                />
                <PrimaryButton label="Lưu giống mới" onPress={submitNew} />
                <GhostButton label="Huỷ" onPress={reset} style={styles.addCancel} />
              </GlassSurface>
            ) : (
              <GhostButton
                label="Thêm giống mới"
                icon={<PlusIcon size={16} />}
                onPress={() => setAdding(true)}
                style={styles.addTrigger}
              />
            )}

            <View style={styles.list}>
              {varieties.map(variety => {
                const selected = variety.id === selectedId;
                return (
                  <Pressable
                    key={variety.id}
                    accessibilityRole="button"
                    accessibilityState={{selected}}
                    onPress={() => onSelect(variety)}
                    style={({pressed}) => pressed && styles.pressed}>
                    <GlassSurface
                      level="soft"
                      style={[styles.item, selected && styles.itemSelected]}>
                      <View style={styles.itemBody}>
                        <View style={styles.itemHead}>
                          <Text style={text('cardTitle')} numberOfLines={1}>
                            {variety.name}
                          </Text>
                          {!variety.isSeed ? (
                            <View style={styles.userTag}>
                              <Text style={text('badge', colors.amber['700'])}>
                                {variety.approved ? 'Tự thêm' : 'Chờ duyệt'}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        {variety.fruit ? (
                          <Text style={text('metaSm', colors.text.alpha['72'])}>
                            {variety.fruit}
                          </Text>
                        ) : null}
                        {variety.usage ? (
                          <Text style={text('caption', colors.text.alpha['68'])}>
                            Dùng: {variety.usage}
                          </Text>
                        ) : null}
                        {variety.note ? (
                          <Text style={[text('caption', colors.text.alpha['60']), styles.itemNote]}>
                            {variety.note}
                          </Text>
                        ) : null}
                      </View>
                      {selected ? (
                        <View style={styles.check}>
                          <Text style={text('badge', colors.neutral.white)}>✓</Text>
                        </View>
                      ) : null}
                    </GlassSurface>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </ScreenBackground>
    </Modal>
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
    paddingBottom: spacing['8'],
  },
  headerTitle: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
  },
  addTrigger: {
    alignSelf: 'flex-start',
    marginBottom: spacing['11'],
    paddingHorizontal: spacing['11'],
  },
  addCard: {
    padding: spacing['12'],
    borderRadius: radius['6xl'],
    marginBottom: spacing['11'],
  },
  addHint: {
    marginTop: spacing['2'],
    marginBottom: spacing['9'],
  },
  addField: {
    marginBottom: spacing['9'],
  },
  addCancel: {
    marginTop: spacing['6'],
  },
  list: {
    gap: spacing['6'],
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['4xl'],
  },
  itemSelected: {
    borderColor: colors.green['700'],
    borderWidth: 1.5,
  },
  itemBody: {
    flex: 1,
    gap: spacing['1'],
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['4'],
  },
  itemNote: {
    marginTop: spacing['2'],
  },
  userTag: {
    paddingHorizontal: spacing['4'],
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(242,161,4,0.18)',
  },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.green['700'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});

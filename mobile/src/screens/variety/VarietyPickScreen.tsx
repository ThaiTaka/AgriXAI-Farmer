/**
 * Chọn giống — bước 3/3: giống chi tiết.
 *
 * One card per variety: name + optional soft badge, a 2–3 line description, a
 * radio mark on the right. Tapping selects and pops back to the plot form.
 * Below the list: "+ Thêm giống mới" and "Không rõ giống" (record the crop only).
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import type {BadgeTone} from '../../components/Badge';
import {Badge} from '../../components/Badge';
import {GhostButton, SecondaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {PlusIcon, RadioIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import type {VarietyBadge} from '../../db/models/CropVariety';
import type {VarietyOption} from '../../db/repositories/varietyRepository';
import {
  USER_CATEGORY_ID,
  USER_CATEGORY_NAME,
  varietyOptions,
} from '../../db/repositories/varietyRepository';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {cropCategory, cropTypeById, VARIETY_BADGE_LABELS} from '../../utils/staticData';
import {AddVarietySheet} from './AddVarietySheet';
import {useVarietyCatalogue} from './useVarietyCatalogue';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'VarietyPick'>;

const BADGE_TONE: Record<VarietyBadge, BadgeTone> = {
  popular: 'green',
  new: 'blue',
  premium: 'purple',
};

export function VarietyPickScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const all = useVarietyCatalogue();
  const [adding, setAdding] = useState(false);

  const varieties = useMemo(
    () => varietyOptions(params.cropTypeId, params.categoryId, all),
    [params.cropTypeId, params.categoryId, all],
  );

  const crop = cropTypeById(params.cropTypeId);
  const category = cropCategory(params.cropTypeId, params.categoryId);
  // A farmer-made crop has no catalogue entry: take its name from any of its rows.
  const cropName = crop?.name ?? all.find(v => v.cropType === params.cropTypeId)?.cropName ?? params.cropTypeId;
  const categoryName =
    category?.category_name ?? (params.categoryId === USER_CATEGORY_ID ? USER_CATEGORY_NAME : params.categoryId);

  const returnTo = params.returnTo ?? 'PlotForm';

  const finish = useCallback(
    (variety: VarietyOption | null) => {
      navigation.popTo(
        returnTo,
        {
          pickedVariety: {
            cropType: params.cropTypeId,
            cropName,
            categoryId: params.categoryId === USER_CATEGORY_ID ? null : params.categoryId,
            varietyId: variety?.id ?? null,
            varietyName: variety?.name ?? null,
          },
        },
        {merge: true},
      );
    },
    [navigation, returnTo, params.cropTypeId, params.categoryId, cropName],
  );

  const cancel = useCallback(
    () => navigation.popTo(returnTo, undefined, {merge: true}),
    [navigation, returnTo],
  );

  return (
    <Screen>
      <AppHeader
        eyebrow={`Bước 3 / 3 · ${cropName} › ${categoryName}`}
        title="Chọn giống"
        onBack={() => navigation.goBack()}
        action={{label: 'Huỷ', onPress: cancel}}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {varieties.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu"
            body={`Chưa có giống nào trong nhóm "${categoryName}". Bạn có thể thêm giống mới bên dưới.`}
          />
        ) : (
          varieties.map(variety => {
            const selected = variety.id === params.selectedId;
            return (
              <Card
                key={variety.id}
                testID={`variety-${variety.id}`}
                accessibilityLabel={variety.name}
                selected={selected}
                onPress={() => finish(variety)}
                style={styles.item}>
                <View style={styles.itemRow}>
                  <View style={styles.itemBody}>
                    <View style={styles.titleRow}>
                      <Text style={[text('cardTitle'), styles.title]} numberOfLines={2}>
                        {variety.name}
                      </Text>
                      {variety.badge ? (
                        <Badge
                          label={VARIETY_BADGE_LABELS[variety.badge]}
                          tone={BADGE_TONE[variety.badge]}
                        />
                      ) : null}
                      {!variety.isSeed ? (
                        <Badge label={variety.approved ? 'Tự thêm' : 'Chờ duyệt'} tone="gray" />
                      ) : null}
                    </View>
                    <Text
                      style={[text('bodySm', colors.text.secondary), styles.description]}
                      numberOfLines={3}>
                      {variety.description ||
                        (variety.isSeed ? 'Chưa có dữ liệu mô tả.' : 'Chưa có mô tả.')}
                    </Text>
                    {variety.usage ? (
                      <Text style={[text('caption', colors.text.muted), styles.usage]} numberOfLines={2}>
                        Dùng: {variety.usage}
                      </Text>
                    ) : null}
                    {variety.growingNote ? (
                      <Text style={[text('caption', colors.text.muted), styles.usage]} numberOfLines={2}>
                        Canh tác: {variety.growingNote}
                      </Text>
                    ) : null}
                  </View>
                  <RadioIcon selected={selected} />
                </View>
              </Card>
            );
          })
        )}

        <View style={styles.actions}>
          <GhostButton
            testID="variety-add"
            label="Thêm giống mới"
            icon={<PlusIcon size={16} />}
            onPress={() => setAdding(true)}
          />
          <SecondaryButton
            testID="variety-skip"
            small
            label="Không rõ giống — chỉ lưu loại cây"
            onPress={() => finish(null)}
          />
        </View>
      </ScrollView>

      <AddVarietySheet
        visible={adding}
        crop={{
          id: params.cropTypeId,
          name: cropName,
          categoryId: params.categoryId,
          categoryName,
        }}
        existing={all}
        onClose={() => setAdding(false)}
        onCreated={variety => {
          setAdding(false);
          finish(variety);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  item: {
    marginBottom: space.md,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  itemBody: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  title: {
    flexShrink: 1,
  },
  description: {
    marginTop: space.xs,
  },
  usage: {
    marginTop: space.xs,
  },
  actions: {
    marginTop: space.sm,
    gap: space.sm,
  },
});

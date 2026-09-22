/**
 * Chọn giống — bước 1/3: loại cây.
 *
 * A two-column grid of crop types from the catalogue, followed by any crop the
 * farmer created themselves and a final "Cây trồng khác" tile that opens the
 * add sheet. Picking a catalogue crop goes to step 2; a farmer-made crop has a
 * single implicit category, so it jumps straight to step 3.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {CropIcon, PlusIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import type {VarietyOption} from '../../db/repositories/varietyRepository';
import {cropTypeOptions, USER_CATEGORY_ID} from '../../db/repositories/varietyRepository';
import type {RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {AddVarietySheet} from './AddVarietySheet';
import {useVarietyCatalogue} from './useVarietyCatalogue';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'VarietyCropType'>;

export function VarietyCropTypeScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const all = useVarietyCatalogue();
  const crops = useMemo(() => cropTypeOptions(all), [all]);
  const [adding, setAdding] = useState(false);

  const returnTo = params.returnTo ?? 'PlotForm';

  const cancel = useCallback(
    () => navigation.popTo(returnTo, undefined, {merge: true}),
    [navigation, returnTo],
  );

  const onCreated = useCallback(
    (variety: VarietyOption) => {
      setAdding(false);
      navigation.popTo(
        returnTo,
        {
          pickedVariety: {
            cropType: variety.cropType,
            cropName: variety.cropName,
            categoryId: variety.categoryId === USER_CATEGORY_ID ? null : variety.categoryId,
            varietyId: variety.id,
            varietyName: variety.name,
          },
        },
        {merge: true},
      );
    },
    [navigation, returnTo],
  );

  return (
    <Screen>
      <AppHeader
        eyebrow="Bước 1 / 3"
        title="Chọn loại cây"
        onBack={() => navigation.goBack()}
        action={{label: 'Huỷ', onPress: cancel}}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {crops.map(crop => (
            <Card
              key={crop.id}
              testID={`crop-${crop.id}`}
              accessibilityLabel={`${crop.name}, ${crop.categoryCount} loại`}
              onPress={() =>
                crop.isCatalogue
                  ? navigation.navigate('VarietyCategory', {
                      cropTypeId: crop.id,
                      selectedId: params.selectedId,
                      returnTo,
                    })
                  : navigation.navigate('VarietyPick', {
                      cropTypeId: crop.id,
                      categoryId: USER_CATEGORY_ID,
                      selectedId: params.selectedId,
                      returnTo,
                    })
              }
              style={styles.tile}>
              <View style={styles.tileIcon}>
                <CropIcon name={crop.icon} />
              </View>
              <Text style={text('cardTitle')} numberOfLines={1}>
                {crop.name}
              </Text>
              <Text style={[text('caption', colors.text.muted), styles.tileMeta]} numberOfLines={1}>
                {crop.isCatalogue
                  ? `${crop.categoryCount} loại · ${crop.varietyCount} giống`
                  : `${crop.varietyCount} giống tự thêm`}
              </Text>
            </Card>
          ))}

          <Card
            testID="crop-other"
            accessibilityLabel="Thêm cây trồng khác"
            onPress={() => setAdding(true)}
            style={[styles.tile, styles.tileOther]}>
            <View style={[styles.tileIcon, styles.tileIconOther]}>
              <PlusIcon size={22} color={colors.text.muted} />
            </View>
            <Text style={text('cardTitle', colors.text.secondary)} numberOfLines={1}>
              Cây trồng khác
            </Text>
            <Text style={[text('caption', colors.text.muted), styles.tileMeta]} numberOfLines={2}>
              Tự đặt tên cây và giống
            </Text>
          </Card>
        </View>

        <Text style={[text('caption', colors.text.muted), styles.footnote]}>
          Danh mục giống lấy từ Viện Eakmat (WASI), công ty giống Rạng Đông, East-West Seed, Phú
          Điền, Chánh Phong, Rijk Zwaan và các nguồn nông nghiệp công khai. Số liệu chép đúng theo
          nguồn — chỗ chưa có dữ liệu được ghi rõ.
        </Text>
      </ScrollView>

      <AddVarietySheet
        visible={adding}
        existing={all}
        onClose={() => setAdding(false)}
        onCreated={onCreated}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.lg,
  },
  tile: {
    width: '48%',
    minHeight: 132,
  },
  tileOther: {
    backgroundColor: colors.surface.page,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  tileIconOther: {
    backgroundColor: colors.surface.subtle,
  },
  tileMeta: {
    marginTop: 2,
  },
  footnote: {
    marginTop: space.xl,
  },
});

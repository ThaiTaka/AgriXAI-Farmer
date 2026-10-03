/**
 * Chọn giống — bước 1/3: loại cây.
 *
 * A two-column grid of crop types from the catalogue, followed by any crop the
 * farmer created themselves and a final "Cây trồng khác" tile that opens the
 * add sheet. Picking a catalogue crop goes to step 2; a farmer-made crop has a
 * single implicit category, so it jumps straight to step 3.
 *
 * A catalogue tile leads with the crop's photo — a farmer finds "Hoa cẩm
 * chướng" faster by sight than by reading twenty names. A crop without one
 * (farmer-made) keeps its line icon in the same-sized frame.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {cropPhoto} from '../../assets/crops';
import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {CropIcon, PlusIcon} from '../../components/icons';
import {Screen} from '../../components/Screen';
import type {VarietyOption} from '../../db/repositories/varietyRepository';
import {cropTypeOptions, USER_CATEGORY_ID} from '../../db/repositories/varietyRepository';
import {popToPicker} from '../../navigation/pickerReturn';
import type {RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {AddVarietySheet} from './AddVarietySheet';
import {CropPhotoImage} from './CropPhoto';
import {useVarietyCatalogue} from './useVarietyCatalogue';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'VarietyCropType'>;

const TILE_MEDIA_HEIGHT = 96;

export function VarietyCropTypeScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const all = useVarietyCatalogue();
  const crops = useMemo(() => cropTypeOptions(all), [all]);
  const [adding, setAdding] = useState(false);

  const returnTo = params.returnTo ?? 'PlotForm';

  const cancel = useCallback(
    () => popToPicker(navigation, returnTo),
    [navigation, returnTo],
  );

  const onCreated = useCallback(
    (variety: VarietyOption) => {
      setAdding(false);
      popToPicker(navigation, returnTo, {
        cropType: variety.cropType,
        cropName: variety.cropName,
        categoryId: variety.categoryId === USER_CATEGORY_ID ? null : variety.categoryId,
        varietyId: variety.id,
        varietyName: variety.name,
      });
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
              flush
              style={styles.tile}>
              {cropPhoto(crop.id) ? (
                <CropPhotoImage testID={`crop-photo-${crop.id}`} cropTypeId={crop.id} style={styles.tilePhoto} />
              ) : (
                <View style={styles.tileFrame}>
                  <View style={styles.tileIcon}>
                    <CropIcon name={crop.icon} />
                  </View>
                </View>
              )}
              <View style={styles.tileBody}>
                <Text style={text('cardTitle')} numberOfLines={1}>
                  {crop.name}
                </Text>
                <Text style={[text('caption', colors.text.muted), styles.tileMeta]} numberOfLines={1}>
                  {crop.isCatalogue
                    ? `${crop.categoryCount} loại · ${crop.varietyCount} giống`
                    : `${crop.varietyCount} giống tự thêm`}
                </Text>
              </View>
            </Card>
          ))}

          <Card
            testID="crop-other"
            accessibilityLabel="Thêm cây trồng khác"
            onPress={() => setAdding(true)}
            flush
            style={[styles.tile, styles.tileOther]}>
            <View style={styles.tileFrame}>
              <View style={[styles.tileIcon, styles.tileIconOther]}>
                <PlusIcon size={22} color={colors.text.muted} />
              </View>
            </View>
            <View style={styles.tileBody}>
              <Text style={text('cardTitle', colors.text.secondary)} numberOfLines={1}>
                Cây trồng khác
              </Text>
              <Text style={[text('caption', colors.text.muted), styles.tileMeta]} numberOfLines={2}>
                Tự đặt tên cây và giống
              </Text>
            </View>
          </Card>
        </View>

        <Text style={[text('bodySm', colors.text.secondary), styles.footnote]}>
          Danh mục cây trồng và giống của tỉnh Lâm Đồng, lấy từ bộ quy trình kỹ thuật của UBND tỉnh
          (QĐ 1972/QĐ-UBND, 2025), Địa chí Đà Lạt, Trung tâm Nghiên cứu Khoai tây, Rau và Hoa Đà Lạt,
          Viện KHKT Nông Lâm nghiệp Tây Nguyên và Báo Lâm Đồng. Số liệu chép đúng theo nguồn — chỗ
          chưa có dữ liệu được ghi rõ. Ảnh minh hoạ từ Wikimedia Commons; tác giả và giấy phép ghi
          dưới ảnh ở bước 2.
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
    overflow: 'hidden',
  },
  tileOther: {
    backgroundColor: colors.surface.page,
  },
  // Photo and icon frame share one height so the grid rows stay level.
  tilePhoto: {
    width: '100%',
    height: TILE_MEDIA_HEIGHT,
  },
  tileFrame: {
    height: TILE_MEDIA_HEIGHT,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  tileBody: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
  },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
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

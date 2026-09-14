/**
 * Chọn giống — bước 2/3: loại con của một loại cây.
 *
 * A single white group of full-width rows separated by hairlines: name, a
 * one-to-two-line description, the variety count and a chevron.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import {ScrollView, StyleSheet, Text} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {ListRow} from '../../components/ListRow';
import {Screen} from '../../components/Screen';
import {categoryOptions} from '../../db/repositories/varietyRepository';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {cropTypeById} from '../../utils/staticData';
import {useVarietyCatalogue} from './useVarietyCatalogue';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'VarietyCategory'>;

export function VarietyCategoryScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const all = useVarietyCatalogue();
  const crop = cropTypeById(params.cropTypeId);
  const categories = useMemo(() => categoryOptions(params.cropTypeId, all), [params.cropTypeId, all]);

  const returnTo = params.returnTo ?? 'PlotForm';
  const cancel = useCallback(
    () => navigation.popTo(returnTo, undefined, {merge: true}),
    [navigation, returnTo],
  );

  const cropName = crop?.name ?? params.cropTypeId;

  return (
    <Screen>
      <AppHeader
        eyebrow={`Bước 2 / 3 · ${cropName}`}
        title="Chọn loại"
        onBack={() => navigation.goBack()}
        action={{label: 'Huỷ', onPress: cancel}}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {crop?.description ? (
          <Text style={[text('bodySm', colors.text.muted), styles.intro]}>{crop.description}</Text>
        ) : null}

        {categories.length === 0 ? (
          <EmptyState
            title="Chưa có dữ liệu"
            body={`Chưa có loại con nào cho ${cropName}.`}
          />
        ) : (
          <Card flush style={styles.group}>
            {categories.map((category, index) => (
              <ListRow
                key={category.id}
                testID={`category-${category.id}`}
                title={category.name}
                subtitle={category.description}
                meta={`${category.varietyCount} giống`}
                last={index === categories.length - 1}
                onPress={() =>
                  navigation.navigate('VarietyPick', {
                    cropTypeId: params.cropTypeId,
                    categoryId: category.id,
                    selectedId: params.selectedId,
                    returnTo,
                  })
                }
              />
            ))}
          </Card>
        )}

        <Text style={[text('caption', colors.text.muted), styles.footnote]}>
          Cách gom "loại" là để dễ chọn trong ứng dụng, không phải phân loại thực vật học.
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  intro: {
    marginBottom: space.lg,
  },
  group: {
    overflow: 'hidden',
  },
  footnote: {
    marginTop: space.lg,
  },
});

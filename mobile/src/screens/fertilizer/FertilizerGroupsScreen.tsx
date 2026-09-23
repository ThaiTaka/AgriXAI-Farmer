/**
 * Danh mục phân bón — bước 1: sáu nhóm chính.
 *
 * Two-column grid: icon, group name, product count. A group with no verified
 * price carries a soft yellow "Chưa có dữ liệu giá" badge — the app never
 * invents a number (shared/data/fertilizer_recommendations.json, $meta.warning).
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {Screen} from '../../components/Screen';
import type {RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {
  fertilizerCategories,
  fertilizerCollectedAt,
  fertilizerProducts,
  missingPriceMessage,
} from '../../utils/staticData';
import {FertilizerGroupIcon} from './FertilizerGroupIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FertilizerGroupsScreen() {
  const navigation = useNavigation<Nav>();

  const groups = useMemo(
    () =>
      fertilizerCategories().map(category => ({
        ...category,
        products: fertilizerProducts(category.code).length,
        missingPrice: missingPriceMessage(category.code),
      })),
    [],
  );

  return (
    <Screen>
      <AppHeader
        eyebrow="Tư vấn phân bón"
        title="Bảng giá phân bón"
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[text('bodySm', colors.text.muted), styles.intro]}>
          Sáu nhóm phân theo dinh dưỡng chính. Chọn một nhóm để xem sản phẩm và khoảng giá tham
          khảo trên thị trường.
        </Text>

        <View style={styles.grid}>
          {groups.map(group => (
            <Card
              key={group.code}
              testID={`fert-group-${group.code}`}
              accessibilityLabel={
                group.missingPrice
                  ? `${group.name}, ${group.products} sản phẩm, chưa có dữ liệu giá`
                  : `${group.name}, ${group.products} sản phẩm`
              }
              onPress={() => navigation.navigate('FertilizerProducts', {categoryCode: group.code})}
              style={styles.tile}>
              <View style={styles.tileIcon}>
                <FertilizerGroupIcon code={group.code} />
              </View>
              <Text style={text('cardTitle')} numberOfLines={2}>
                {group.name}
              </Text>
              {group.missingPrice ? (
                <Badge label="Chưa có giá" tone="yellow" style={styles.tileBadge} />
              ) : (
                <Text style={[text('caption', colors.text.muted), styles.tileMeta]}>
                  {group.products} sản phẩm
                </Text>
              )}
            </Card>
          ))}
        </View>

        <Text style={[text('bodySm', colors.text.secondary), styles.footnote]}>
          Giá tham khảo thu thập ngày {fertilizerCollectedAt()} từ sfarm.vn và giacaphe.com (qua
          vietnambiz.vn); thay đổi theo vùng và thời điểm. Nguồn sự thật khi vận hành là bảng giá do
          quản trị viên cập nhật.
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.lg,
  },
  tile: {
    width: '48%',
    minHeight: 140,
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
  tileMeta: {
    marginTop: 2,
  },
  tileBadge: {
    marginTop: space.sm,
  },
  footnote: {
    marginTop: space.xl,
  },
});

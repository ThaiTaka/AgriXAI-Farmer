/**
 * Danh mục phân bón — bước 2: sản phẩm trong một nhóm.
 *
 * One card per product: name, NPK ratio, the market price range per pack and
 * per kg, a soft budget-tier badge, region + source + date. A segmented filter
 * narrows the list to one budget tier (Bình dân / Trung bình / Cao cấp) —
 * tiers are the percentile bands defined in the data file, not fixed amounts.
 *
 * A group without verified prices shows exactly that; no number is invented.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import type {BadgeTone} from '../../components/Badge';
import {Badge} from '../../components/Badge';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {SegmentedControl} from '../../components/form';
import {Screen} from '../../components/Screen';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import {formatVnd, formatVndRange} from '../../utils/format';
import type {BudgetTierCode} from '../../utils/staticData';
import {
  budgetTiers,
  fertilizerCategory,
  fertilizerProducts,
  missingPriceMessage,
} from '../../utils/staticData';
import {FertilizerGroupIcon} from './FertilizerGroupIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FertilizerProducts'>;

type Filter = 'all' | BudgetTierCode;

const TIER_TONE: Record<BudgetTierCode, BadgeTone> = {
  binh_dan: 'green',
  trung_binh: 'blue',
  cao_cap: 'purple',
};

export function FertilizerProductsScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();
  const [filter, setFilter] = useState<Filter>('all');

  const category = fertilizerCategory(params.categoryCode);
  const missing = missingPriceMessage(params.categoryCode);
  const tiers = budgetTiers();
  const tierName = (code: BudgetTierCode) => tiers.find(t => t.code === code)?.name ?? code;

  const products = useMemo(() => {
    const rows = fertilizerProducts(params.categoryCode);
    return filter === 'all' ? rows : rows.filter(p => p.budget_tier === filter);
  }, [params.categoryCode, filter]);

  const segments = useMemo(
    () => [{key: 'all' as Filter, label: 'Tất cả'}, ...tiers.map(t => ({key: t.code as Filter, label: t.name}))],
    [tiers],
  );

  return (
    <Screen>
      <AppHeader
        eyebrow="Danh mục phân bón"
        title={category?.name ?? params.categoryCode}
        onBack={() => navigation.goBack()}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {category?.description ? (
          <Text style={[text('bodySm', colors.text.muted), styles.intro]}>
            {category.description}
          </Text>
        ) : null}

        {missing ? (
          <EmptyState
            icon={<FertilizerGroupIcon code={params.categoryCode} color={colors.gray['400']} />}
            title="Chưa có dữ liệu giá"
            body={`${missing}. Nhóm này chưa có giá đã xác thực trong đợt thu thập; ứng dụng không tự sinh số. Quản trị viên có thể bổ sung giá ở trang quản trị.`}
          />
        ) : (
          <>
            <SegmentedControl items={segments} value={filter} onChange={setFilter} style={styles.filter} />

            {products.length === 0 ? (
              <EmptyState
                title="Không có sản phẩm ở mức giá này"
                body={`Trong nhóm ${category?.name ?? ''} chưa có sản phẩm thuộc mức "${filter === 'all' ? '' : tierName(filter)}". Chọn mức khác để xem.`}
              />
            ) : (
              products.map(product => (
                <Card key={product.id} testID={`fert-${product.id}`} style={styles.item}>
                  <View style={styles.titleRow}>
                    <Text style={[text('cardTitle'), styles.title]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    {product.budget_tier ? (
                      <Badge label={tierName(product.budget_tier)} tone={TIER_TONE[product.budget_tier]} />
                    ) : null}
                  </View>

                  <View style={styles.metaRow}>
                    <Badge label={product.npk_ratio} tone="gray" />
                    <Text style={text('caption', colors.text.muted)}>{product.unit}</Text>
                  </View>

                  <Text style={[text('subheading'), styles.price]}>
                    {formatVndRange(product.price_min, product.price_max)}
                    <Text style={text('bodySm', colors.text.muted)}> / {product.unit}</Text>
                  </Text>
                  {product.price_per_kg_min !== null && product.price_per_kg_max !== null ? (
                    <Text style={text('bodySm', colors.text.secondary)}>
                      ≈ {formatVndRange(product.price_per_kg_min, product.price_per_kg_max)}/kg
                      {product.price_per_kg_avg !== null
                        ? ` · trung bình ${formatVnd(product.price_per_kg_avg)}/kg`
                        : ''}
                    </Text>
                  ) : null}

                  <Text style={[text('caption', colors.text.muted), styles.source]} numberOfLines={2}>
                    {product.region} · {product.source} · cập nhật {product.updated_at}
                  </Text>
                </Card>
              ))
            )}

            <Text style={[text('caption', colors.text.muted), styles.footnote]}>
              Mức giá chia theo phân vị giá quy đổi đồng/kg của chính danh mục này:{' '}
              {tiers
                .map(t =>
                  t.max_price_per_kg
                    ? `${t.name} ≤ ${formatVnd(t.max_price_per_kg)}/kg`
                    : `${t.name} cao hơn`,
                )
                .join(' · ')}
              .
            </Text>
          </>
        )}
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
  filter: {
    marginBottom: space.lg,
  },
  item: {
    marginBottom: space.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  title: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.sm,
  },
  price: {
    marginTop: space.md,
  },
  source: {
    marginTop: space.sm,
  },
  footnote: {
    marginTop: space.sm,
  },
});

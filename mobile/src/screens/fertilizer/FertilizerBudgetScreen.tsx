/**
 * F3 — Lọc phân bón theo ngân sách.
 *
 * Three tabs, one per budget tier, across every product in the catalogue.
 * The tier of a product is its price per kg against the two thresholds in
 * the data file (≤ 12.300₫ bình dân, ≤ 14.500₫ trung bình, above that cao
 * cấp). "Chọn" hands the product to F4 to check it against the shed.
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useMemo, useState} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Badge} from '../../components/Badge';
import {PrimaryButton} from '../../components/buttons';
import {Card} from '../../components/Card';
import {EmptyState} from '../../components/EmptyState';
import {InfoTooltip} from '../../components/InfoTooltip';
import {NumberText} from '../../components/NumberText';
import {Screen} from '../../components/Screen';
import {Tabs} from '../../components/Tabs';
import type {BudgetTierCode} from '../../domain/budgetTier';
import {tierBandLabel, tierFor} from '../../domain/budgetTier';
import type {RootStackParamList} from '../../navigation/types';
import {colors, radius, space, text} from '../../theme';
import {formatVnd, formatVndRange} from '../../utils/format';
import {budgetTiers, fertilizerCategory, fertilizerCollectedAt, fertilizerProducts} from '../../utils/staticData';
import {FertilizerGroupIcon} from './FertilizerGroupIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function FertilizerBudgetScreen() {
  const navigation = useNavigation<Nav>();
  const tiers = budgetTiers();
  const [tier, setTier] = useState<BudgetTierCode>('binh_dan');

  // Classify from the price, not from the stored label, so the screen and
  // the formula can never disagree.
  const grouped = useMemo(() => {
    const map: Record<BudgetTierCode, ReturnType<typeof fertilizerProducts>> = {binh_dan: [], trung_binh: [], cao_cap: []};
    for (const product of fertilizerProducts()) {
      if (product.price_per_kg_avg === null) continue;
      map[tierFor(product.price_per_kg_avg, tiers)].push(product);
    }
    return map;
  }, [tiers]);

  const current = tiers.find(t => t.code === tier)!;
  const products = grouped[tier];

  return (
    <Screen>
      <AppHeader eyebrow="Tư vấn phân bón" title="Lọc theo ngân sách" onBack={() => navigation.goBack()} />

      {/* Không gắn count vào nhãn tab: "Trung bình (12)" bị cắt trong 1/3 bề ngang. */}
      <Tabs
        items={tiers.map(t => ({key: t.code, label: t.name}))}
        value={tier}
        onChange={setTier}
        style={styles.tabs}
      />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={[text('bodySm', colors.text.secondary), styles.introText]}>
            {current.name} — {products.length} sản phẩm
          </Text>
          <InfoTooltip
            testID="budget-info"
            title={`Mức "${current.name}" nghĩa là gì?`}
            body={
              `Mức này gồm phân có giá ${tierBandLabel(current, tiers, formatVnd)}.\n\n` +
              'Giá mỗi ký tính bằng cách lấy giá một bao chia cho số ký trong bao, nên so sánh được giữa các bao to nhỏ khác nhau.\n\n' +
              `Giá tham khảo thu thập ngày ${fertilizerCollectedAt()} và thay đổi theo vùng, theo thời điểm — hãy coi là để so sánh, không phải giá bán tại cửa hàng của bạn.`
            }
          />
        </View>

        {products.length === 0 ? (
          <EmptyState title="Không có sản phẩm ở mức này" body="Chưa có sản phẩm nào trong danh mục rơi vào khoảng giá này." />
        ) : (
          products.map(product => {
            const group = fertilizerCategory(product.category);
            return (
              <Card key={product.id} style={styles.item} testID={`budget-${product.id}`}>
                <View style={styles.row}>
                  <View style={styles.icon}>
                    <FertilizerGroupIcon code={product.category} size={22} />
                  </View>
                  <View style={styles.body}>
                    <Text style={text('bodySm', colors.text.secondary)} numberOfLines={1}>
                      {group?.name ?? product.category} · {product.npk_ratio}
                    </Text>
                    <Text style={[text('cardTitle'), styles.title]} numberOfLines={2}>
                      {product.name}
                    </Text>
                    <Text style={[text('bodySm', colors.text.secondary), styles.meta]} numberOfLines={2}>
                      {product.region} · {product.source}
                    </Text>
                  </View>
                </View>

                <View style={styles.priceRow}>
                  <View style={styles.priceBody}>
                    <NumberText size="lg" numberOfLines={1}>
                      {formatVndRange(product.price_min, product.price_max)}
                    </NumberText>
                    {/* Giá mỗi ký là con số bà con so sánh nhiều nhất: 14px, xám
                        đậm (8.8:1 trên nền trắng) thay cho 12px xám nhạt. */}
                    <Text style={[text('bodySm', colors.text.secondary), styles.perKg]}>
                      ≈ {formatVnd(product.price_per_kg_avg ?? 0)}/kg trung bình
                    </Text>
                  </View>
                  <Badge label={packLabel(product.unit)} tone="gray" variant="quiet" />
                </View>

                <PrimaryButton
                  small
                  label="Chọn phân này"
                  testID={`budget-pick-${product.id}`}
                  onPress={() => navigation.navigate('StockCheck', {fertilizerId: product.id})}
                  style={styles.pick}
                />
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

/** "bao 50kg" -> "Bao 50 kg", "gói 2kg" -> "Gói 2 kg", "kg" -> "Theo kg". */
function packLabel(unit: string): string {
  if (unit === 'kg') return 'Theo kg';
  const withSpace = unit.replace(/(\d)kg/, '$1 kg');
  return withSpace.charAt(0).toUpperCase() + withSpace.slice(1);
}

const styles = StyleSheet.create({
  tabs: {
    marginHorizontal: space.lg,
    marginBottom: space.lg,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginBottom: space.lg,
  },
  introText: {
    flex: 1,
    minWidth: 0,
  },
  item: {
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    marginTop: space.xs,
  },
  meta: {
    marginTop: space.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.md,
  },
  priceBody: {
    flex: 1,
    minWidth: 0,
  },
  perKg: {
    marginTop: space.xs,
  },
  // Nút chiếm cả bề ngang thẻ: chỉ có một hành động ở đây, và một khối xanh
  // đặc thì không thể nhầm với nhãn "Bao 50 kg" bên trên.
  pick: {
    marginTop: space.md,
    alignSelf: 'stretch',
  },
});

/**
 * Màn hình 06 — Gợi ý xử lý + thuốc.
 *
 * Design reference: screen "06 Gợi ý xử lý".
 *
 * The four cases the brief singles out are the point of this screen, and each one
 * exists to stop a farmer spending money on something that cannot work:
 *
 *   mosaic_virus, healthy      no product list at all — say so plainly instead of
 *                              padding the screen with something to buy
 *   yellow_leaf_curl_virus     the drugs listed kill the whitefly that carries the
 *                              virus, not the virus; the note sits ABOVE the list
 *                              so it is read before the product names
 *   spider_mites               a mite, not a fungus — a red warning that fungicide
 *                              will do nothing, and to reach for an acaricide
 *
 * All of it comes from shared/data/tomato_diseases.json, which ships inside the
 * app: this advice must be readable in a field with no signal.
 */

import type {RouteProp} from '@react-navigation/native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {ScrollView, StatusBar, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {GhostButton, IconButton} from '../components/buttons';
import {GlassSurface} from '../components/GlassSurface';
import {CheckIcon, ChevronLeft, WarningIcon} from '../components/icons';
import {ScreenBackground} from '../components/ScreenBackground';
import type {RootStackParamList} from '../navigation/types';
import {
  colors,
  glass,
  radius,
  severity as severityTokens,
  spacing,
  text,
} from '../theme';
import {DISEASE_TYPE_LABELS, severityForDisease, treatmentAdvice} from '../utils/diseases';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Treatment'>;

export function TreatmentRecommendationScreen() {
  const navigation = useNavigation<Nav>();
  const {params} = useRoute<Route>();

  const advice = treatmentAdvice(params.diseaseKey);

  if (!advice) {
    return (
      <ScreenBackground>
        <SafeAreaView style={styles.root} edges={['top']}>
          <Header onBack={() => navigation.goBack()} />
          <View style={styles.center}>
            <Text style={text('cardTitleLg')}>Không tìm thấy bệnh này</Text>
            <Text style={[text('body', colors.text.alpha['74']), styles.centerBody]}>
              Mã bệnh "{params.diseaseKey}" không có trong danh mục.
            </Text>
          </View>
        </SafeAreaView>
      </ScreenBackground>
    );
  }

  const {disease, hasProducts, noProductText, productNote, pestWarning} = advice;
  const token = severityTokens[severityForDisease(disease.key)];

  return (
    <ScreenBackground>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.root} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={text('pageTitle')}>{disease.name}</Text>
          <View style={styles.chips}>
            <View style={styles.typeChip}>
              <Text style={text('caption', colors.lime['800'])}>
                {DISEASE_TYPE_LABELS[disease.type]} · {disease.pathogen}
              </Text>
            </View>
            <View style={[styles.sevChip, {backgroundColor: token.bg}]}>
              <Text style={text('caption', token.fg)}>Mức độ: {token.label}</Text>
            </View>
          </View>

          {/* spider_mites — the wrong shelf entirely. Loudest thing on the screen. */}
          {pestWarning ? (
            <GlassSurface level="soft" style={styles.pestWarning}>
              <WarningIcon size={22} fill={colors.danger.bg} mark={colors.danger.fg} />
              <Text style={[text('bodySm', '#5C3A00'), styles.pestWarningText]}>{pestWarning}</Text>
            </GlassSurface>
          ) : null}

          <Text style={[text('cardTitleLg'), styles.sectionTitle]}>Cần làm ngay</Text>
          <View style={styles.list}>
            {disease.treatments.map((step, index) => (
              <GlassSurface key={step} level="soft" style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={text('meta', colors.neutral.white)}>{index + 1}</Text>
                </View>
                <Text style={[text('bodySm'), styles.stepText]}>{step}</Text>
              </GlassSurface>
            ))}
          </View>

          <Text style={[text('cardTitleLg'), styles.sectionTitle]}>Thuốc gợi ý</Text>

          {/* yellow_leaf_curl_virus — ABOVE the list, so nobody reads three drug
              names and concludes they cure a virus. */}
          {productNote ? (
            <GlassSurface level="soft" style={styles.productNote}>
              <WarningIcon size={20} />
              <Text style={[text('bodySm', '#5C4405'), styles.productNoteText]}>{productNote}</Text>
            </GlassSurface>
          ) : null}

          {hasProducts ? (
            <>
              <View style={styles.list}>
                {disease.products.map(product => (
                  <GlassSurface key={product.name} level="card" style={styles.productCard}>
                    <View style={styles.productBody}>
                      <Text style={text('cardTitle')}>{product.name}</Text>
                      <Text style={[text('metaSm', colors.text.alpha['70']), styles.productGroup]}>
                        {product.group}
                      </Text>
                    </View>
                  </GlassSurface>
                ))}
              </View>
              <Text style={[text('caption', colors.text.alpha['60']), styles.rotationNote]}>
                Luân phiên hoạt chất giữa các lần phun để tránh kháng thuốc. Đọc kỹ nhãn và thời
                gian cách ly trước khi dùng.
              </Text>
            </>
          ) : (
            /* mosaic_virus, healthy — nothing to sell, and that is the message. */
            <GlassSurface level="soft" style={styles.noProduct}>
              <Text style={[text('cardTitle'), styles.noProductTitle]}>Không có thuốc gợi ý</Text>
              <Text style={text('body', colors.text.alpha['74'])}>
                {noProductText ??
                  'Trường hợp này không có thuốc phù hợp để gợi ý. Làm theo các bước xử lý ở trên.'}
              </Text>
            </GlassSurface>
          )}

          <Text style={[text('cardTitleLg'), styles.sectionTitle]}>Phòng ngừa lâu dài</Text>
          <View style={styles.preventionList}>
            {disease.prevention.map(item => (
              <View key={item} style={styles.preventionRow}>
                <CheckIcon />
                <Text style={[text('bodySm'), styles.preventionText]}>{item}</Text>
              </View>
            ))}
          </View>

          <GlassSurface level="soft" style={styles.symptomCard}>
            <Text style={text('eyebrow', colors.green['700'])}>Dấu hiệu nhận biết</Text>
            <Text style={[text('body'), styles.symptomText]}>{disease.symptoms}</Text>
            <Text style={[text('caption', colors.text.alpha['68']), styles.symptomText]}>
              Điều kiện phát sinh: {disease.conditions}
            </Text>
          </GlassSurface>

          <Text style={[text('caption', colors.text.alpha['62']), styles.disclaimer]}>
            Thông tin tham khảo để nhận biết sớm, không thay thế khuyến cáo của cán bộ khuyến
            nông địa phương. Đọc kỹ nhãn thuốc trước khi sử dụng.
          </Text>

          <GhostButton
            label="Lịch sử chẩn đoán"
            onPress={() =>
              navigation.navigate('DiagnosisHistory', {plotId: params.plotId ?? ''})
            }
            style={styles.action}
          />
          <GhostButton label="Quay lại kết quả" onPress={() => navigation.goBack()} />
        </ScrollView>
      </SafeAreaView>
    </ScreenBackground>
  );
}

function Header({onBack}: {onBack: () => void}) {
  return (
    <View style={styles.header}>
      <IconButton accessibilityLabel="Quay lại" onPress={onBack}>
        <ChevronLeft />
      </IconButton>
      <Text style={text('screenHeading')}>Gợi ý xử lý</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {
    paddingHorizontal: spacing['11'],
    paddingBottom: spacing['18'],
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['13'],
  },
  centerBody: {
    marginTop: spacing['3'],
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['7'],
    paddingHorizontal: spacing['11'],
    paddingTop: spacing['6'],
    paddingBottom: spacing['10'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing['3'],
    marginTop: spacing['6'],
    marginBottom: spacing['13'],
  },
  typeChip: {
    paddingHorizontal: spacing['9'],
    paddingVertical: spacing['3'],
    borderRadius: radius.pill,
    backgroundColor: 'rgba(195,210,74,.14)',
    borderWidth: 1,
    borderColor: 'rgba(195,210,74,.22)',
  },
  sevChip: {
    paddingHorizontal: spacing['9'],
    paddingVertical: spacing['3'],
    borderRadius: radius.pill,
  },
  pestWarning: {
    flexDirection: 'row',
    gap: spacing['8'],
    padding: spacing['12'],
    borderRadius: radius['5xl'],
    borderColor: 'rgba(194,74,18,0.45)',
    backgroundColor: 'rgba(194,74,18,0.12)',
    marginBottom: spacing['13'],
  },
  pestWarningText: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: spacing['8'],
  },
  list: {
    gap: spacing['6'],
    marginBottom: spacing['15'],
  },
  stepCard: {
    flexDirection: 'row',
    gap: spacing['9'],
    padding: spacing['11'],
    borderRadius: radius['4xl'],
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.green['700'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
  },
  productNote: {
    flexDirection: 'row',
    gap: spacing['8'],
    padding: spacing['11'],
    borderRadius: radius['4xl'],
    backgroundColor: 'rgba(242,161,4,0.16)',
    borderColor: 'rgba(242,161,4,0.34)',
    marginBottom: spacing['8'],
  },
  productNoteText: {
    flex: 1,
  },
  productCard: {
    padding: spacing['11'],
    borderRadius: radius['4xl'],
  },
  productBody: {
    gap: spacing['1'],
  },
  productGroup: {
    marginTop: 2,
  },
  rotationNote: {
    marginTop: -spacing['11'],
    marginBottom: spacing['15'],
  },
  noProduct: {
    padding: spacing['13'],
    borderRadius: radius['5xl'],
    marginBottom: spacing['15'],
    borderStyle: 'dashed',
    borderColor: glass.soft.borderColor,
  },
  noProductTitle: {
    marginBottom: spacing['4'],
  },
  preventionList: {
    gap: spacing['7'],
    marginBottom: spacing['13'],
  },
  preventionRow: {
    flexDirection: 'row',
    gap: spacing['7'],
    alignItems: 'flex-start',
  },
  preventionText: {
    flex: 1,
  },
  symptomCard: {
    padding: spacing['12'],
    borderRadius: radius['4xl'],
    marginBottom: spacing['11'],
  },
  symptomText: {
    marginTop: spacing['4'],
  },
  disclaimer: {
    marginBottom: spacing['13'],
  },
  action: {
    marginBottom: spacing['6'],
  },
});

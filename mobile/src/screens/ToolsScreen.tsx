/**
 * "Công cụ" — every feature as a full-width row, for farmers who prefer a list
 * to the dashboard tiles. Reached from the home screen; it is the only way in
 * to the fertiliser catalogue and F4, which have no tile of their own.
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../components/AppHeader';
import {Card} from '../components/Card';
import {
  CalculatorIcon,
  ClipboardIcon,
  CoinsIcon,
  SackIcon,
  ScaleIcon,
  ShareIcon,
  TagIcon,
  WarehouseIcon,
} from '../components/icons';
import {IconTile} from '../components/IconTile';
import {ListRow} from '../components/ListRow';
import {Screen} from '../components/Screen';
import type {RootStackParamList} from '../navigation/types';
import {colors, space, text} from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Chỉ những route mở được mà không cần tham số. Liệt kê tường minh thay vì
 * `keyof RootStackParamList` để đổi tên route thành lỗi biên dịch — màn hình
 * này là lối vào duy nhất của FertilizerGroups và StockCheck.
 */
type ToolRoute =
  | 'FertilizerCalculator'
  | 'FertilizerBudget'
  | 'StockCheck'
  | 'FertilizerGroups'
  | 'CareProtocol'
  | 'Warehouse'
  | 'Finance'
  | 'ReportExport';

interface Tool {
  route: ToolRoute;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}

const GROUPS: {label: string; tools: Tool[]}[] = [
  {
    label: 'Tư vấn phân bón',
    tools: [
      {route: 'FertilizerCalculator', title: 'F1 · Tính lượng phân bón', subtitle: 'Theo diện tích và phương án của quy trình có nguồn', icon: <CalculatorIcon />},
      {route: 'FertilizerBudget', title: 'F3 · Lọc theo ngân sách', subtitle: 'Bình dân · Trung bình · Cao cấp', icon: <TagIcon />},
      {route: 'StockCheck', title: 'F4 · Kiểm tra kho', subtitle: 'Đủ hay thiếu trước khi bón', icon: <ScaleIcon />},
      {route: 'FertilizerGroups', title: 'Danh mục phân bón', subtitle: '6 nhóm, giá tham khảo', icon: <SackIcon />},
    ],
  },
  {
    label: 'Chăm sóc',
    tools: [{route: 'CareProtocol', title: 'F5–F6 · Quy trình chăm sóc', subtitle: '4 giai đoạn, đánh dấu đã làm, đặt nhắc', icon: <ClipboardIcon />}],
  },
  {
    label: 'Kho và tài chính',
    tools: [
      {route: 'Warehouse', title: 'Kho vật tư', subtitle: 'Nhập · Xuất (FIFO) · Tồn · CSV', icon: <WarehouseIcon />},
      {route: 'Finance', title: 'Thu – Chi', subtitle: 'Ghi chép, báo cáo lãi/lỗ, CSV', icon: <CoinsIcon />},
      {route: 'ReportExport', title: 'Báo cáo PDF', subtitle: 'Tháng / quý, khổ A4, chia sẻ', icon: <ShareIcon size={22} />},
    ],
  },
];

export function ToolsScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Công cụ" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {GROUPS.map(group => (
          <View key={group.label} style={styles.group}>
            <Text style={[text('eyebrow', colors.text.secondary), styles.label]}>{group.label}</Text>
            <Card flush style={styles.card}>
              {group.tools.map((tool, index) => (
                <ListRow
                  key={tool.route}
                  testID={`tool-${tool.route}`}
                  title={tool.title}
                  subtitle={tool.subtitle}
                  last={index === group.tools.length - 1}
                  leading={<IconTile size={40}>{tool.icon}</IconTile>}
                  onPress={() => navigation.navigate(tool.route)}
                />
              ))}
            </Card>
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  group: {
    marginBottom: space.xl,
  },
  label: {
    marginBottom: space.sm,
  },
  card: {
    overflow: 'hidden',
  },
});

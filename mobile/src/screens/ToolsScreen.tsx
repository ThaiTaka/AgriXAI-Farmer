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
  VideoIcon,
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
  | 'CareGuides'
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
      {route: 'FertilizerCalculator', title: 'Tính lượng phân bón', subtitle: 'Cần bón bao nhiêu cho ruộng của bạn', icon: <CalculatorIcon />},
      {route: 'FertilizerBudget', title: 'Chọn phân theo túi tiền', subtitle: 'Bình dân, trung bình hay cao cấp', icon: <TagIcon />},
      {route: 'StockCheck', title: 'Kiểm tra kho trước khi bón', subtitle: 'Xem kho còn đủ hay thiếu bao nhiêu', icon: <ScaleIcon />},
      {route: 'FertilizerGroups', title: 'Bảng giá phân bón', subtitle: 'Sáu nhóm phân, giá tham khảo thị trường', icon: <SackIcon />},
    ],
  },
  {
    label: 'Chăm sóc',
    tools: [
      {route: 'CareProtocol', title: 'Quy trình chăm sóc', subtitle: 'Bón gì, làm gì ở từng giai đoạn cây', icon: <ClipboardIcon />},
      {route: 'CareGuides', title: 'Hướng dẫn có video', subtitle: 'Xem cách làm bằng video và ảnh từng bước', icon: <VideoIcon size={22} />},
    ],
  },
  {
    label: 'Kho và tài chính',
    tools: [
      {route: 'Warehouse', title: 'Kho phân bón', subtitle: 'Ghi phiếu nhập, xuất và xem tồn', icon: <WarehouseIcon />},
      {route: 'Finance', title: 'Thu và chi', subtitle: 'Ghi tiền vào, tiền ra, xem lãi lỗ', icon: <CoinsIcon />},
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

import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {PickedVariety, PickerReturnRoute, RootStackParamList} from './types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Quay lại màn đã mở bộ chọn giống, gộp kết quả vào params sẵn có.
 *
 * `popTo(..., {merge: true})` giữ nguyên những params màn đó đang mang — với
 * PlotForm đó là `plotId`, thứ bắt buộc phải có vì nông hộ chỉ sửa lô đã được
 * giao chứ không lập lô mới. TypeScript không diễn đạt được "params còn thiếu
 * sẽ do merge bù vào", nên phép ép kiểu nằm gọn ở đây, một chỗ, thay vì rải
 * ra cả ba bước của bộ chọn.
 */
export function popToPicker(
  navigation: Nav,
  returnTo: PickerReturnRoute,
  pickedVariety?: PickedVariety,
): void {
  navigation.popTo(
    returnTo as 'FertilizerCalculator',
    pickedVariety ? {pickedVariety} : undefined,
    {merge: true},
  );
}

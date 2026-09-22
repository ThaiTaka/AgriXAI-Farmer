/**
 * Nông hộ không lập lô đất.
 *
 * Lô do bên quản lý đất chia và gán; ứng dụng chỉ nhận lô về qua đồng bộ rồi
 * cho sửa thông tin canh tác. Luật này nằm rải ở nhiều chỗ (màn hình, kiểu
 * route, kho dữ liệu) nên dễ bị dựng lại từng mảnh một — bài kiểm đọc thẳng
 * mã nguồn để khi ai đó thêm nút "Thêm lô" thì biết ngay, kể cả khi màn hình
 * đó chưa có test render.
 */

// Chỉ khai báo đúng hai thứ cần để đọc file. Kéo cả @types/node vào sẽ ghi đè
// AbortSignal và fetch của React Native, làm hỏng kiểu ở src/api.
declare const __dirname: string;

const {readFileSync} = require('fs') as {readFileSync(p: string, e: 'utf8'): string};
const {join} = require('path') as {join(...parts: string[]): string};

const SRC = join(__dirname, '..', 'src');
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), 'utf8');

/** Mọi màn có thể liệt kê lô đất. */
const LIST_SCREENS = [
  ['screens', 'HomeScreen.tsx'],
  ['screens', 'PlotPickerScreen.tsx'],
  ['screens', 'PlotDetailScreen.tsx'],
];

test('không màn nào mở PlotForm ở chế độ tạo mới', () => {
  for (const parts of LIST_SCREENS) {
    const source = read(...parts);
    // Mở PlotForm mà không kèm plotId chính là chế độ "tạo lô".
    expect(source).not.toMatch(/navigate\(\s*['"]PlotForm['"]\s*\)/);
  }
});

test('không màn nào còn nhãn "Thêm lô"', () => {
  for (const parts of LIST_SCREENS) {
    expect(read(...parts)).not.toMatch(/Thêm lô/);
  }
});

test('route PlotForm bắt buộc có plotId, nên không diễn tả được chế độ tạo', () => {
  const types = read('navigation', 'types.ts');
  expect(types).toMatch(/PlotForm: \{plotId: string;/);
  expect(types).not.toMatch(/PlotForm: \{plotId\?: string/);
});

test('kho dữ liệu không còn hàm tạo lô, cũng không còn máy sinh mã lô', () => {
  const repository = read('db', 'repositories', 'plotRepository.ts');
  expect(repository).not.toMatch(/export async function createPlot/);
  expect(repository).toMatch(/export async function updatePlot/);

  // Mã lô do bên quản lý đất cấp; sinh mã chỉ có nghĩa khi tự lập lô.
  const plotCode = read('utils', 'plotCode.ts');
  expect(plotCode).not.toMatch(/generatePlotCode|generateUniquePlotCode/);
  expect(plotCode).toMatch(/export function isWellFormedPlotCode/);
});

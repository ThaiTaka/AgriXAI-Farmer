import React, {useMemo, useState} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, radius, size, space, text} from '../theme';
import {formatVndRange} from '../utils/format';
import {fertilizerCategories, fertilizerProducts} from '../utils/staticData';
import {IconButton} from './buttons';
import {CloseIcon, RadioIcon} from './icons';
import {ListRow} from './ListRow';

export interface PickedProduct {
  id: string;
  name: string;
  category: string | null;
}

interface Props {
  visible: boolean;
  selectedId: string | null;
  /** Products already in the shed, shown first ("Trong kho"). */
  inStock?: PickedProduct[];
  /** Let the farmer type a product that is not in the catalogue. */
  allowCustom?: boolean;
  onClose: () => void;
  onPick: (product: PickedProduct) => void;
}

/**
 * Bottom sheet listing the fertiliser catalogue by group, with a search box.
 * Used by F4 and the warehouse forms; a custom name is allowed on the
 * purchase form because farmers buy what the local shop has.
 */
export function ProductPickerSheet({visible, selectedId, inStock = [], allowCustom = false, onClose, onPick}: Props) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const groups = useMemo(
    () =>
      fertilizerCategories()
        .map(category => ({
          category,
          products: fertilizerProducts(category.code).filter(p => !needle || p.name.toLowerCase().includes(needle)),
        }))
        .filter(g => g.products.length > 0),
    [needle],
  );
  const stock = inStock.filter(p => !needle || p.name.toLowerCase().includes(needle));
  const catalogueIds = new Set(fertilizerProducts().map(p => p.id));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[text('heading'), styles.headerTitle]}>Chọn phân bón</Text>
          <IconButton accessibilityLabel="Đóng" onPress={onClose}>
            <CloseIcon />
          </IconButton>
        </View>

        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên (Urê, DAP, Kali…)"
            placeholderTextColor={colors.text.placeholder}
            autoCorrect={false}
            style={styles.searchInput}
            testID="product-search"
          />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {stock.length > 0 ? (
            <>
              <Text style={[text('eyebrow', colors.text.muted), styles.groupLabel]}>Trong kho</Text>
              <View style={styles.group}>
                {stock.map((product, index) => (
                  <ListRow
                    key={product.id}
                    testID={`pick-stock-${product.id}`}
                    title={product.name}
                    subtitle={catalogueIds.has(product.id) ? undefined : 'Ngoài danh mục'}
                    last={index === stock.length - 1}
                    trailing={<RadioIcon selected={selectedId === product.id} />}
                    onPress={() => onPick(product)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {groups.map(group => (
            <View key={group.category.code}>
              <Text style={[text('eyebrow', colors.text.muted), styles.groupLabel]}>{group.category.name}</Text>
              <View style={styles.group}>
                {group.products.map((product, index) => (
                  <ListRow
                    key={product.id}
                    testID={`pick-${product.id}`}
                    title={product.name}
                    subtitle={`${product.npk_ratio} · ${formatVndRange(product.price_min, product.price_max)} / ${product.unit}`}
                    last={index === group.products.length - 1}
                    trailing={<RadioIcon selected={selectedId === product.id} />}
                    onPress={() => onPick({id: product.id, name: product.name, category: product.category})}
                  />
                ))}
              </View>
            </View>
          ))}

          {allowCustom && needle.length >= 2 ? (
            <Pressable
              testID="pick-custom"
              accessibilityRole="button"
              onPress={() => onPick({id: `custom_${slug(query.trim())}`, name: query.trim(), category: null})}
              style={({pressed}) => [styles.custom, pressed && styles.customPressed]}>
              <Text style={text('bodyStrong', colors.primary.default)}>+ Dùng tên "{query.trim()}"</Text>
              <Text style={[text('caption', colors.text.muted), styles.customHint]}>
                Sản phẩm ngoài danh mục — không có giá tham khảo, bạn tự nhập giá khi nhập kho.
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function slug(name: string): string {
  return name
    .normalize('NFD')
    .replace(new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, 'g'), '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface.page,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  headerTitle: {
    flex: 1,
  },
  search: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  searchInput: {
    minHeight: size.inputMinHeight,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border.strong,
    backgroundColor: colors.surface.card,
    paddingHorizontal: space.lg,
    fontFamily: 'OpenSans-Medium',
    fontSize: 16,
    color: colors.text.primary,
  },
  scroll: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  groupLabel: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
  group: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    overflow: 'hidden',
  },
  custom: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border.strong,
  },
  customPressed: {
    backgroundColor: colors.surface.pressed,
  },
  customHint: {
    marginTop: space.xs,
  },
});

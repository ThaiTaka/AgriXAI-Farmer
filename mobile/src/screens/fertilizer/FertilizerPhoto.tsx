/**
 * A fertiliser product's photo on its card, and the same photo large.
 *
 * Every product has its own photo — its bag as the maker shows it, from the
 * official site of the company named in the product (see assets/fertilizers).
 * Tapping it opens the picture large with what it shows, whose it is and a link
 * to the product page it came from. A product with no photo of its own keeps
 * its group's line icon in the same frame: another product's bag would be a
 * wrong answer, not a better one.
 */

import React, {useContext, useState} from 'react';
import {Image, Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {fertilizerPhoto} from '../../assets/fertilizers';
import {SecondaryButton} from '../../components/buttons';
import {CloseIcon} from '../../components/icons';
import {hostOf, SourceLink} from '../../components/SourceLink';
import {colors, radius, size as sizes, space, text} from '../../theme';
import type {FertilizerImage, FertilizerProduct} from '../../utils/staticData';
import {FertilizerGroupIcon} from './FertilizerGroupIcon';

/** "Ảnh: Công ty CP Phân bón Bình Điền · binhdien.com" — whose photo, and from where. */
export function fertilizerPhotoCredit(image: FertilizerImage): string {
  return `Ảnh: ${image.owner} · ${hostOf(image.source_url)}`;
}

export function FertilizerThumb({product, size = 72}: {product: FertilizerProduct; size?: number}) {
  // Context rather than useSafeAreaInsets(): the hook throws outside a provider.
  const insets = useContext(SafeAreaInsetsContext);
  const [open, setOpen] = useState(false);
  const image = product.image;
  const photo = fertilizerPhoto(image?.file);
  const frame = {width: size, height: size};

  if (!image || !photo) {
    return (
      <View testID={`fert-icon-${product.id}`} style={[styles.frame, styles.iconFrame, frame]}>
        <FertilizerGroupIcon code={product.category} size={Math.round(size * 0.42)} />
      </View>
    );
  }

  return (
    <>
      <Pressable
        testID={`fert-photo-${product.id}`}
        accessibilityRole="imagebutton"
        accessibilityLabel={`Xem ảnh lớn: ${image.subject}`}
        onPress={() => setOpen(true)}
        style={({pressed}) => [styles.frame, styles.photoFrame, frame, pressed && styles.pressed]}>
        <Image
          source={photo}
          style={styles.fill}
          // The whole bag, not its middle: the brand and the formula printed on
          // it are what tell one product from the next.
          resizeMode="contain"
          // Decoded at the size it is drawn: a list of seventeen cards does not
          // hold seventeen 900 px bitmaps.
          resizeMethod="resize"
          accessibilityIgnoresInvertColors
        />
      </Pressable>

      {/* Under both system bars: otherwise the scrim stops short of the
          navigation bar and a strip of the list shows beneath the sheet on
          Android's edge-to-edge screens. The sheet's padding keeps its button
          above the bar. */}
      <Modal
        visible={open}
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        animationType="slide"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} accessibilityLabel="Đóng" onPress={() => setOpen(false)}>
          {/* Stops a tap on the sheet from reaching the scrim behind it. */}
          <Pressable
            testID={`fert-photo-sheet-${product.id}`}
            style={[styles.sheet, {paddingBottom: (insets?.bottom ?? 0) + space.lg}]}
            onPress={() => {}}>
            <View style={styles.head}>
              <Text style={[text('subheading'), styles.headTitle]} numberOfLines={2}>
                {product.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Đóng"
                hitSlop={12}
                onPress={() => setOpen(false)}
                style={styles.close}>
                <CloseIcon size={20} color={colors.text.secondary} />
              </Pressable>
            </View>

            <View style={styles.large}>
              <Image
                source={photo}
                style={styles.fill}
                resizeMode="contain"
                accessibilityRole="image"
                accessibilityLabel={image.subject}
              />
            </View>

            <Text style={[text('bodyStrong'), styles.subject]}>{image.subject}</Text>
            {image.note ? <Text style={text('bodySm', colors.text.secondary)}>{image.note}</Text> : null}
            <SourceLink
              url={image.source_url}
              citation={fertilizerPhotoCredit(image)}
              label="Xem trang sản phẩm"
              style={styles.credit}
            />
            <SecondaryButton label="Đóng" onPress={() => setOpen(false)} style={styles.done} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  // White like the bags' own backgrounds, with a hairline so the tile still
  // reads as one on a white card.
  photoFrame: {
    backgroundColor: colors.surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.default,
  },
  iconFrame: {
    backgroundColor: colors.primary.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface.overlay,
  },
  sheet: {
    backgroundColor: colors.surface.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    marginBottom: space.md,
  },
  headTitle: {
    flex: 1,
  },
  close: {
    width: sizes.minTouchTarget,
    height: sizes.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -space.sm,
    marginRight: -space.sm,
  },
  // Square, so a standing bag is shown tall enough to read what is printed on
  // it; landscape photos are letterboxed rather than cropped.
  large: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface.card,
  },
  subject: {
    marginTop: space.md,
    marginBottom: 2,
  },
  credit: {
    marginTop: space.sm,
  },
  done: {
    marginTop: space.md,
  },
});

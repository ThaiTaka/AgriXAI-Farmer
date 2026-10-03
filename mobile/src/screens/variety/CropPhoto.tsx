/**
 * The crop's photo in the variety picker, with the credit its free licence
 * asks for: who took it, the licence, what was changed, and the Commons page.
 *
 * The photos are bundled at 900 px. Lists ask Android to decode them at the
 * size they are drawn (`resizeMethod="resize"`), so a grid of twenty-odd tiles
 * does not hold twenty-odd full-size bitmaps in memory.
 */

import React from 'react';
import type {ImageStyle, StyleProp} from 'react-native';
import {Image, StyleSheet, View} from 'react-native';

import {cropPhoto} from '../../assets/crops';
import {SourceLink} from '../../components/SourceLink';
import {radius, space} from '../../theme';
import type {CropImage, CropType} from '../../utils/staticData';

/** "Ảnh: Windrain · CC BY-SA 4.0 · Đã cắt khung quanh cánh đồng lúa". */
export function photoCredit(image: CropImage): string {
  return [`Ảnh: ${image.author}`, image.license, image.changes].filter(Boolean).join(' · ');
}

/** Full-width photo and its credit — the top of step 2 once a crop is picked. */
export function CropPhotoHero({crop}: {crop: CropType}) {
  const photo = cropPhoto(crop.id);
  if (!photo) return null;
  return (
    <View style={styles.hero}>
      {/* The frame sets the 16:9 box; the image only fills it. On Android a
          bundled image brings its pixel size as a default width and height,
          and that height would win over an aspectRatio on the image itself. */}
      <View style={styles.heroFrame}>
        <Image
          testID={`crop-photo-${crop.id}`}
          source={photo}
          style={styles.fill}
          resizeMode="cover"
          accessibilityRole="image"
          accessibilityLabel={`Ảnh minh hoạ ${crop.name}`}
        />
      </View>
      {crop.image ? (
        <SourceLink
          testID={`crop-photo-credit-${crop.id}`}
          url={crop.image.source_url}
          citation={photoCredit(crop.image)}
          label="Xem ảnh gốc trên Wikimedia Commons"
        />
      ) : null}
    </View>
  );
}

/** A tile- or thumbnail-sized photo; renders nothing for a farmer-made crop. */
export function CropPhotoImage({
  cropTypeId,
  style,
  testID,
}: {
  cropTypeId: string;
  style: StyleProp<ImageStyle>;
  testID?: string;
}) {
  const photo = cropPhoto(cropTypeId);
  if (!photo) return null;
  return (
    <Image
      testID={testID}
      source={photo}
      style={style}
      resizeMode="cover"
      resizeMethod="resize"
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    marginBottom: space.md,
  },
  heroFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
});

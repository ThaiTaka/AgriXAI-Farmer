import React from 'react';
import {StyleSheet, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import {gradients, halo, radius} from '../theme';

const APP_BG = [...gradients.appBackground.colors] as string[];
const APP_BG_STOPS = [...(gradients.appBackground.locations ?? [0, 0.52, 1])] as number[];

/**
 * The app shell: the diagonal green gradient plus the three soft glows that sit
 * behind every glass surface.
 *
 * React Native has no CSS blur filter, so the design's blurred radial gradients
 * are approximated with large low-opacity circles. They serve the same purpose —
 * giving the translucent cards something with colour variation to sit on.
 */
export function ScreenBackground({children}: {children: React.ReactNode}) {
  return (
    <LinearGradient
      colors={APP_BG}
      locations={APP_BG_STOPS}
      start={{x: 0.1, y: 0}}
      end={{x: 0.9, y: 1}}
      style={styles.root}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[styles.halo, styles.haloGreen]} />
        <View style={[styles.halo, styles.haloLime]} />
        <View style={[styles.halo, styles.haloAmber]} />
      </View>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  halo: {
    position: 'absolute',
    borderRadius: radius.pill,
  },
  haloGreen: {
    top: halo.green.top,
    left: halo.green.left,
    width: halo.green.size,
    height: halo.green.size,
    backgroundColor: 'rgba(84,169,106,0.28)',
  },
  haloLime: {
    top: halo.lime.top,
    right: halo.lime.right,
    width: halo.lime.size,
    height: halo.lime.size,
    backgroundColor: 'rgba(195,210,74,0.24)',
  },
  haloAmber: {
    bottom: halo.amber.bottom,
    left: halo.amber.left,
    width: halo.amber.size,
    height: halo.amber.size,
    backgroundColor: 'rgba(242,161,4,0.18)',
  },
});

/**
 * Video cách trồng — every catalogue crop with its how-to-grow video, in the
 * catalogue's order (hoa, rau – củ – quả, lương thực, cây lâu năm).
 *
 * A list of stills, not of players: each row is a 15 KB picture decoded at
 * row size, the list renders a screenful at a time, and the one video the
 * farmer picks plays on its own screen. Thirty-odd embedded players would
 * have been thirty-odd web apps.
 */

import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import React, {useCallback, useMemo} from 'react';
import type {ListRenderItem} from 'react-native';
import {FlatList, StyleSheet, Text, View} from 'react-native';

import {AppHeader} from '../../components/AppHeader';
import {Card} from '../../components/Card';
import {ChevronRight} from '../../components/icons';
import {Screen} from '../../components/Screen';
import {videoChoices} from '../../domain/cropVideo';
import type {RootStackParamList} from '../../navigation/types';
import {colors, space, text} from '../../theme';
import type {CropType} from '../../utils/staticData';
import {allCropTypes} from '../../utils/staticData';
import {VideoThumb} from './VideoThumb';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CropVideoLibraryScreen() {
  const navigation = useNavigation<Nav>();
  const crops = useMemo(() => allCropTypes().filter(c => c.video), []);

  const renderItem = useCallback<ListRenderItem<CropType>>(
    ({item}) => {
      const video = item.video!;
      const count = videoChoices(item).length;
      return (
        <Card
          flush
          testID={`video-library-${item.id}`}
          accessibilityLabel={`${item.name}: ${video.title}`}
          onPress={() => navigation.navigate('CropVideo', {cropTypeId: item.id, categoryId: null})}
          style={styles.card}>
          <View style={styles.row}>
            <VideoThumb videoId={video.youtube_id} durationS={video.duration_s} width={120} />
            <View style={styles.body}>
              <Text style={text('cardTitle')} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={text('bodySm', colors.text.secondary)} numberOfLines={2}>
                {video.title}
              </Text>
              <Text style={text('caption', colors.text.muted)} numberOfLines={1}>
                {count > 1 ? `${count} video theo loại · ${video.channel}` : video.channel}
              </Text>
            </View>
            <ChevronRight />
          </View>
        </Card>
      );
    },
    [navigation],
  );

  return (
    <Screen>
      <AppHeader title="Video cách trồng" onBack={() => navigation.goBack()} />
      <FlatList
        data={crops}
        keyExtractor={crop => crop.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        initialNumToRender={7}
        maxToRenderPerBatch={8}
        windowSize={7}
        ListHeaderComponent={
          <Text style={[text('bodySm', colors.text.secondary), styles.intro]}>
            Mỗi loại cây trong danh mục có một video tham khảo cách trồng, xem ngay trong ứng dụng (cần có mạng).
            Ớt và cà phê có thêm video cho loại trồng khác hẳn.
          </Text>
        }
        ListFooterComponent={
          <Text style={[text('bodySm', colors.text.muted), styles.footer]}>
            Ưu tiên video của kênh chính thức ở Lâm Đồng, rồi của báo, đài, trung tâm khuyến nông; tên kênh ghi dưới
            mỗi video. Liều lượng phân, thuốc vẫn theo quy trình của tỉnh trong ứng dụng.
          </Text>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space['3xl'],
  },
  intro: {
    marginBottom: space.lg,
  },
  card: {
    marginBottom: space.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footer: {
    marginTop: space.md,
  },
});

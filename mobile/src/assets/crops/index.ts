/**
 * One photo per catalogue crop, bundled so the variety picker shows it offline.
 *
 * The pictures come from Wikimedia Commons under free licences; who took each
 * one, its licence and its Commons page are recorded with the crop in
 * shared/data/crop_varieties.json (`image`) and shown under the photo.
 */

import type {ImageSourcePropType} from 'react-native';

const PHOTOS: Record<string, ImageSourcePropType> = {
  artichoke: require('./artichoke.jpg'),
  avocado: require('./avocado.jpg'),
  beetroot: require('./beetroot.jpg'),
  cabbage: require('./cabbage.jpg'),
  carnation: require('./carnation.jpg'),
  carrot: require('./carrot.jpg'),
  cauliflower: require('./cauliflower.jpg'),
  celery: require('./celery.jpg'),
  chayote: require('./chayote.jpg'),
  chili: require('./chili.jpg'),
  chrysanthemum: require('./chrysanthemum.jpg'),
  coffee: require('./coffee.jpg'),
  corn: require('./corn.jpg'),
  cucumber: require('./cucumber.jpg'),
  garden_pea: require('./garden_pea.jpg'),
  gerbera: require('./gerbera.jpg'),
  gladiolus: require('./gladiolus.jpg'),
  leek: require('./leek.jpg'),
  lettuce: require('./lettuce.jpg'),
  lily: require('./lily.jpg'),
  limonium: require('./limonium.jpg'),
  lisianthus: require('./lisianthus.jpg'),
  napa_cabbage: require('./napa_cabbage.jpg'),
  oncidium: require('./oncidium.jpg'),
  persimmon: require('./persimmon.jpg'),
  phalaenopsis: require('./phalaenopsis.jpg'),
  potato: require('./potato.jpg'),
  rice: require('./rice.jpg'),
  rose: require('./rose.jpg'),
  spinach: require('./spinach.jpg'),
  strawberry: require('./strawberry.jpg'),
  tea: require('./tea.jpg'),
  tomato: require('./tomato.jpg'),
  water_spinach: require('./water_spinach.jpg'),
};

/** The bundled photo of a catalogue crop; undefined for a crop a farmer added. */
export function cropPhoto(cropTypeId: string): ImageSourcePropType | undefined {
  return PHOTOS[cropTypeId];
}

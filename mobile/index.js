/**
 * @format
 */

import notifee from '@notifee/react-native';
import { AppRegistry } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';

import App from './App';
import { name as appName } from './app.json';
import { headlessTask } from './src/notify/background';

AppRegistry.registerComponent(appName, () => App);

// V2.2: the background sync keeps running after the app is swiped away
// (src/notify/background.ts) ...
BackgroundFetch.registerHeadlessTask(headlessTask);
// ... and a notification tapped while the app is closed simply opens it;
// NotificationCenter reads which one via getInitialNotification().
notifee.onBackgroundEvent(async () => {});

// Jest stand-in for Notifee: records what the app asked the system to show
// or schedule, so tests can assert on it without a device.
const triggers = new Map();
const displayed = [];
let foreground = null;

const notifee = {
  createChannel: jest.fn(async channel => channel.id),
  requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
  getNotificationSettings: jest.fn(async () => ({authorizationStatus: 1})),
  openNotificationSettings: jest.fn(async () => undefined),
  displayNotification: jest.fn(async n => {
    displayed.push(n);
    return n.id;
  }),
  createTriggerNotification: jest.fn(async (n, trigger) => {
    triggers.set(n.id, {notification: n, trigger});
    return n.id;
  }),
  getTriggerNotificationIds: jest.fn(async () => [...triggers.keys()]),
  cancelTriggerNotification: jest.fn(async id => {
    triggers.delete(id);
  }),
  cancelDisplayedNotification: jest.fn(async () => undefined),
  getInitialNotification: jest.fn(async () => null),
  onForegroundEvent: jest.fn(cb => {
    foreground = cb;
    return () => {
      foreground = null;
    };
  }),
  onBackgroundEvent: jest.fn(),
  // Test helpers.
  __triggers: triggers,
  __displayed: displayed,
  __press: data => foreground?.({type: 1, detail: {notification: {data}}}),
  __reset: () => {
    triggers.clear();
    displayed.length = 0;
  },
};

module.exports = {
  __esModule: true,
  default: notifee,
  AndroidImportance: {DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0},
  AndroidStyle: {BIGPICTURE: 0, BIGTEXT: 1, INBOX: 2, MESSAGING: 3},
  AuthorizationStatus: {NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2},
  EventType: {UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3},
  TriggerType: {TIMESTAMP: 0, INTERVAL: 1},
};

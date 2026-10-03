// Jest stand-in for the background job scheduler.
module.exports = {
  __esModule: true,
  default: {
    NETWORK_TYPE_ANY: 1,
    configure: jest.fn(async () => 2),
    finish: jest.fn(),
    registerHeadlessTask: jest.fn(),
    stop: jest.fn(async () => true),
  },
};

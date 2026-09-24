// Jest stand-in: the picker "returns" whatever a test queues with __setNext.
let next = {didCancel: true};

module.exports = {
  launchCamera: jest.fn(async () => next),
  launchImageLibrary: jest.fn(async () => next),
  __setNext: response => {
    next = response;
  },
};

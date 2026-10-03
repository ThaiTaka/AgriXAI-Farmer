// Jest stand-in for the offline recogniser: tests script what it "hears".
const listeners = {};

function subscribe(name) {
  return cb => {
    listeners[name] = cb;
    return {remove: () => delete listeners[name]};
  };
}

module.exports = {
  loadModel: jest.fn(async () => undefined),
  unload: jest.fn(async () => undefined),
  start: jest.fn(async () => undefined),
  stop: jest.fn(() => undefined),
  onPartialResult: subscribe('partial'),
  onResult: subscribe('result'),
  onFinalResult: subscribe('final'),
  onTimeout: subscribe('timeout'),
  onError: subscribe('error'),
  // Test helper: emit("partial", "bán năm") / emit("result", "...").
  __emit: (name, value) => listeners[name]?.(value),
};

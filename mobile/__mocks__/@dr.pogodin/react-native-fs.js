// Jest stand-in for the file system: an in-memory set of paths.
const files = new Set();

module.exports = {
  DocumentDirectoryPath: '/data/agrilog/files',
  CachesDirectoryPath: '/data/agrilog/cache',
  mkdir: jest.fn(async () => {}),
  exists: jest.fn(async path => files.has(path)),
  moveFile: jest.fn(async (from, to) => {
    files.delete(from);
    files.add(to);
  }),
  copyFile: jest.fn(async (from, to) => {
    files.add(to);
  }),
  unlink: jest.fn(async path => {
    files.delete(path);
  }),
  __files: files,
};

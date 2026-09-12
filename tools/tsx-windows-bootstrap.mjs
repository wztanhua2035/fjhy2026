// Node 24 on some Windows hosts can fail os.userInfo() inside tsx before it
// loads TypeScript. tsx only needs this value to name its temporary folder.
if (process.platform === 'win32' && typeof process.geteuid !== 'function') {
  Object.defineProperty(process, 'geteuid', { value: () => 0 });
}

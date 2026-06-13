const uid = () => Math.random().toString(36).slice(2, 9);
const shuffle = (a) => {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));


export { uid, shuffle, clamp };

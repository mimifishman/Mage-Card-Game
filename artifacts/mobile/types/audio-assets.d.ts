// Metro resolves audio assets to a numeric asset-registry id (same as
// images). Expo's bundled types only cover image extensions, so audio needs
// its own declarations — see https://docs.expo.dev/guides/typescript/
declare module "*.wav" {
  const asset: number;
  export default asset;
}

declare module "*.mp3" {
  const asset: number;
  export default asset;
}

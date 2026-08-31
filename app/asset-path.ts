// Next replaces this public variable when building the GitHub Pages export.
// Local Vinext development keeps serving the same images from the root.
export function assetPath(path: string) {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/${path.replace(/^\/+/, '')}`;
}

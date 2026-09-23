export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return typeof WebGL2RenderingContext !== 'undefined' && canvas.getContext('webgl2') !== null;
  } catch {
    return false;
  }
}

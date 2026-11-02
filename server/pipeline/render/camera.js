function gradeFilter(grade) {
  switch (grade) {
    case 'viral':
      return 'eq=contrast=1.16:saturation=1.22:brightness=0.035,unsharp=5:5:0.6:5:5:0.0';
    case 'cinematic':
      return 'eq=contrast=1.1:saturation=0.94:brightness=-0.015,colorbalance=rs=0.05:gs=-0.02:bs=-0.06';
    case 'doc':
      return 'eq=contrast=1.07:saturation=1.04:brightness=0.01';
    case 'energy':
      return 'eq=contrast=1.2:saturation=1.28:brightness=0.045,unsharp=5:5:0.7:5:5:0.0';
    case 'experimental':
      return 'eq=contrast=1.18:saturation=1.25:brightness=0.02,hue=h=6';
    default:
      return 'eq=contrast=1.1:saturation=1.1';
  }
}

/**
 * UGC camera: always animate (punch / drift). Role controls intensity.
 */
function cameraFilterForClip(clip, width = 1080, height = 1920) {
  const dur = Math.max(0.25, clip.srcEnd - clip.srcStart);
  const role = clip.role || 'body';
  const emphasis = /!|\?|؟|مهم|khass|important|never|قرآن|الله/i.test(clip.text || '');

  let z0 = 1.06;
  let z1 = 1.14;
  let cy = 0.4;

  if (role === 'hook' || emphasis) {
    z0 = 1.08;
    z1 = 1.2;
    cy = 0.38;
  } else if (role === 'payoff') {
    z0 = 1.07;
    z1 = 1.18;
    cy = 0.39;
  } else if (clip.overlays && clip.overlays.some((o) => o.type === 'word_pop')) {
    z0 = 1.07;
    z1 = 1.17;
  }

  // Honor explicit EDL keys if they already punch
  const keys = clip.camera || [];
  if (keys.length >= 2 && keys.length <= 4) {
    const a = Number(keys[0].zoom);
    const b = Number(keys[keys.length - 1].zoom);
    if (Number.isFinite(a) && Number.isFinite(b) && Math.abs(b - a) >= 0.04) {
      z0 = Math.min(1.22, Math.max(1.04, a));
      z1 = Math.min(1.22, Math.max(1.04, b));
    }
  }

  const frames = Math.max(1, Math.round(dur * 30));
  const zExpr = `${z0.toFixed(3)}+(${(z1 - z0).toFixed(3)})*(on/${frames})`;
  const maxZ = Math.max(z0, z1);
  // Slight vertical bias toward face
  return (
    `scale=${width}*${maxZ}:${height}*${maxZ},` +
    `zoompan=z='${zExpr}':x='iw/2-(iw/zoom/2)':y='ih*${cy.toFixed(2)}-(ih/zoom/2)':d=1:s=${width}x${height}:fps=30`
  );
}

module.exports = { gradeFilter, cameraFilterForClip };

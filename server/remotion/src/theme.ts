export const COLORS = {
  ink: '#0B0B0F',
  cream: '#F7F2E8',
  paper: '#FFF8EF',
  glass: 'rgba(255,255,255,0.22)',
  glassBorder: 'rgba(255,255,255,0.45)',
  accent: '#FF3B5C',
  lime: '#C8FF3D',
  gold: '#F5C542',
  blue: '#4DA3FF',
  shadow: 'rgba(0,0,0,0.45)',
};

/** Flat wash kept for compatibility — prefer GradeStack in UgCReel. */
export const gradeOverlay = (grade: string): string => {
  switch (grade) {
    case 'viral':
      return 'rgba(255, 70, 90, 0.10)';
    case 'doc':
      return 'rgba(20, 40, 60, 0.16)';
    case 'cinematic':
      return 'rgba(180, 110, 40, 0.14)';
    case 'energy':
      return 'rgba(80, 0, 120, 0.12)';
    case 'experimental':
      return 'rgba(0, 180, 140, 0.10)';
    default:
      return 'rgba(0,0,0,0.06)';
  }
};

export type GradeLook = {
  wash: string;
  vignette: string;
  contrast: number;
  sat: number;
  grain: number;
};

export const gradeLook = (grade: string): GradeLook => {
  switch (grade) {
    case 'viral':
      return {
        wash: 'rgba(255, 55, 80, 0.11)',
        vignette: 'rgba(0,0,0,0.55)',
        contrast: 1.08,
        sat: 1.12,
        grain: 0.055,
      };
    case 'doc':
      return {
        wash: 'rgba(30, 55, 75, 0.18)',
        vignette: 'rgba(0,0,0,0.48)',
        contrast: 1.04,
        sat: 0.92,
        grain: 0.04,
      };
    case 'cinematic':
      return {
        wash: 'rgba(190, 120, 50, 0.15)',
        vignette: 'rgba(20,8,0,0.52)',
        contrast: 1.06,
        sat: 1.05,
        grain: 0.05,
      };
    default:
      return {
        wash: 'rgba(0,0,0,0.08)',
        vignette: 'rgba(0,0,0,0.4)',
        contrast: 1.03,
        sat: 1,
        grain: 0.035,
      };
  }
};

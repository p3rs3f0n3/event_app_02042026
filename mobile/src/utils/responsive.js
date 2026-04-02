import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

export const useResponsiveMetrics = () => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => {
    const compactHeight = height < 760;
    const compactWidth = width < 380;
    const isCompact = compactHeight || compactWidth;

    return {
      width,
      height,
      isCompact,
      screenPadding: isCompact ? 18 : 24,
      verticalPadding: compactHeight ? 18 : 24,
      titleSize: isCompact ? 30 : 36,
      heroTitleSize: isCompact ? 32 : 38,
      subtitleSize: isCompact ? 20 : 24,
      buttonTextSize: isCompact ? 16 : 20,
      cardPadding: isCompact ? 20 : 24,
      sectionGap: isCompact ? 18 : 24,
    };
  }, [height, width]);
};

import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const scaleValue = (value, scale, factor = 1) => {
  const nextValue = value * (1 + ((scale - 1) * factor));
  return Math.round(nextValue);
};

export const createResponsiveMetrics = (width, height) => {
  const compactHeight = height < 760;
  const compactWidth = width < 380;
  const isCompact = compactHeight || compactWidth;
  const isLargePhone = width >= 428;
  const widthScale = width / BASE_WIDTH;
  const heightScale = height / BASE_HEIGHT;
  const scale = clamp((widthScale * 0.68) + (heightScale * 0.32), 0.9, 1.12);

  const spacing = (value, factor = 1) => scaleValue(value, scale, factor);
  const font = (value, factor = 0.95) => Math.max(11, scaleValue(value, scale, factor));
  const size = (value, factor = 1) => Math.max(1, scaleValue(value, scale, factor));
  const radius = (value, factor = 0.7) => Math.max(8, scaleValue(value, scale, factor));

  const screenPadding = spacing(isCompact ? 18 : 24, 1);
  const verticalPadding = spacing(compactHeight ? 18 : 24, 1);
  const sectionGap = spacing(isCompact ? 18 : 24, 1);
  const cardPadding = spacing(isCompact ? 18 : 24, 1);

  return {
    width,
    height,
    scale,
    compactHeight,
    compactWidth,
    isCompact,
    isLargePhone,
    spacing,
    font,
    size,
    radius,
    screenPadding,
    verticalPadding,
    sectionGap,
    cardPadding,
    contentMaxWidth: Math.min(Math.max(width - (screenPadding * 2), 0), isLargePhone ? 520 : 460),
    modalMaxWidth: Math.min(Math.max(width - (screenPadding * 2), 0), 460),
    titleSize: font(isCompact ? 30 : 36),
    heroTitleSize: font(isCompact ? 32 : 38),
    subtitleSize: font(isCompact ? 20 : 24),
    sectionTitleSize: font(isCompact ? 24 : 28),
    cardTitleSize: font(isCompact ? 18 : 20),
    buttonTextSize: font(isCompact ? 14 : 15),
    bodyTextSize: font(14, 0.8),
    captionTextSize: font(12, 0.8),
    inputTextSize: font(16, 0.85),
    orbSize: {
      top: size(isCompact ? 180 : 200),
      bottom: size(isCompact ? 210 : 240),
    },
  };
};

export const useResponsiveMetrics = () => {
  const { width, height } = useWindowDimensions();

  return useMemo(() => createResponsiveMetrics(width, height), [height, width]);
};

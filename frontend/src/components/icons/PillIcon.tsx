import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { View } from 'react-native';

export default function PillIcon({ size = 20, color = '#e91e63' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 24 24">
        {/* Capsule shape */}
        <Path d="M7 3c-2.761 0-5 2.239-5 5 0 1.326.527 2.53 1.381 3.414l9.205 9.205C13.47 21.473 14.674 22 16 22c2.761 0 5-2.239 5-5 0-1.326-.527-2.53-1.381-3.414L10.414 4.381A4.985 4.985 0 0 0 7 3z" fill={color} opacity={0.9} />
        {/* Slash separation */}
        <Path d="M3.757 9.414l10.829 10.829" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
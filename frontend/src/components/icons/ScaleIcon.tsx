import React from 'react';
import Svg, { Path, Rect, Circle, Line } from 'react-native-svg';
import { View } from 'react-native';

export default function ScaleIcon({ size = 20, color = '#e91e63' }: { size?: number; color?: string }) {
  const s = size;
  return (
    <View style={{ width: s, height: s }}>
      <Svg width={s} height={s} viewBox="0 0 24 24">
        {/* outer rounded square */}
        <Rect x={3} y={3} width={18} height={18} rx={4} ry={4} fill={color} opacity={0.9} />
        {/* dial */}
        <Circle cx={12} cy={10} r={4} fill="#fff" />
        {/* needle */}
        <Line x1={12} y1={10} x2={14.5} y2={7.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
        {/* base marker line */}
        <Line x1={6} y1={17} x2={18} y2={17} stroke="#fff" strokeWidth={2} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';
import { View } from 'react-native';

// Vereinfachte UK-Flagge (Union Jack) – ausreichend für kleines Icon
export default function FlagUK({ width = 36, height = 24, radius = 4 }: { width?: number; height?: number; radius?: number }) {
  const w = width; const h = height;
  return (
    <View style={{ width, height }}>
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}> 
        <Rect x={0} y={0} width={w} height={h} fill="#00247D" rx={radius} ry={radius} />
        {/* white diagonals */}
        <Path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#fff" strokeWidth={h*0.3} />
        {/* red diagonals */}
        <Path d={`M0,0 L${w},${h} M${w},0 L0,${h}`} stroke="#CF142B" strokeWidth={h*0.15} />
        {/* white cross */}
        <Rect x={(w/2 - w*0.06)} y={0} width={w*0.12} height={h} fill="#fff" />
        <Rect x={0} y={(h/2 - h*0.06)} width={w} height={h*0.12} fill="#fff" />
        {/* red cross */}
        <Rect x={(w/2 - w*0.04)} y={0} width={w*0.08} height={h} fill="#CF142B" />
        <Rect x={0} y={(h/2 - h*0.04)} width={w} height={h*0.08} fill="#CF142B" />
      </Svg>
    </View>
  );
}
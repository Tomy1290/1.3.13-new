import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { View } from 'react-native';

export default function FlagDE({ width = 36, height = 24, radius = 4 }: { width?: number; height?: number; radius?: number }) {
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}> 
        <Rect x={0} y={0} width={width} height={height/3} fill="#000" rx={radius} ry={radius} />
        <Rect x={0} y={height/3} width={width} height={height/3} fill="#DD0000" />
        <Rect x={0} y={2*height/3} width={width} height={height/3} fill="#FFCE00" />
      </Svg>
    </View>
  );
}
import React from 'react';
import Svg, { Rect } from 'react-native-svg';
import { View } from 'react-native';

// Selbst erstellte, eckige Vektorgrafik (weiß/rot)
export default function FlagPL({ width = 36, height = 24, radius = 4 }: { width?: number; height?: number; radius?: number }) {
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}> 
        <Rect x={0} y={0} width={width} height={height/2} fill="#FFFFFF" rx={radius} ry={radius} />
        <Rect x={0} y={height/2} width={width} height={height/2} fill="#DC143C" />
      </Svg>
    </View>
  );
}
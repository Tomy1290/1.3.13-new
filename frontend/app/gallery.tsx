import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useStore';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866' };
}

export default function GalleryScreen() {
  const state = useAppStore();
  const router = useRouter();
  const colors = useThemeColors(state.theme);
  const [info, setInfo] = useState(false);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name='star' size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '800', marginHorizontal: 6 }}>{state.language==='de'?'Galerie':(state.language==='pl'?'Galeria':'Gallery')}</Text>
            <Ionicons name='star' size={16} color={colors.primary} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{state.language==='de'?'Fotos vergleichen & Meilensteine':(state.language==='pl'?'Porównuj zdjęcia i kamienie milowe':'Compare photos & milestones')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Info</Text>
            <TouchableOpacity onPress={()=> setInfo(v=>!v)}>
              <Ionicons name='information-circle-outline' size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {info ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Geplant: Fotos (Kamera/Galerie, max. 5 pro Tag) mit Kompression & Speicher-Kontrolle, Kalender mit Markierungen, Vollbild-Viewer mit Zoom, A/B-Vergleich sowie Foto-Erfolge (1/5/20/50/100 Tage). Wird im nächsten Schritt umgesetzt.
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 12 } });
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../src/store/useStore';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75', input: '#fff' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8', input: '#1f1520' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e', input: '#fff' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866', input: '#ffffff' };
}

export default function ProfileScreen() {
  const state = useAppStore();
  const router = useRouter();
  const colors = useThemeColors(state.theme);
  const [help, setHelp] = useState<{[k:string]: boolean}>({});

  const heightM = useMemo(() => {
    const cm = state.profile.heightCm;
    return cm && cm > 0 ? (cm / 100) : undefined;
  }, [state.profile.heightCm]);

  const lastWeight = useMemo(() => {
    const vals = Object.values(state.days).filter((d)=> typeof d.weight === 'number').sort((a:any,b:any)=> a.date.localeCompare(b.date));
    return vals.length ? Number(vals[vals.length-1].weight) : undefined;
  }, [state.days]);

  const bmi = useMemo(() => {
    if (!heightM || !lastWeight) return undefined;
    return lastWeight / (heightM * heightM);
  }, [heightM, lastWeight]);

  const bmiCategory = useMemo(() => {
    const v = bmi || 0;
    if (!bmi) return undefined;
    if (v < 18.5) return { label: 'Untergewicht', color: '#2196F3' };
    if (v < 25) return { label: 'Normalgewicht', color: '#4CAF50' };
    if (v < 30) return { label: 'Übergewicht', color: '#FFC107' };
    return { label: 'Adipositas', color: '#F44336' };
  }, [bmi]);

  async function pickImage(from: 'camera'|'gallery') {
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') { Alert.alert('Berechtigung', 'Kamerazugriff verweigert'); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
        if (!res.canceled && res.assets?.[0]?.base64) {
          state.setProfile({ avatarBase64: `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}` });
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') { Alert.alert('Berechtigung', 'Galeriezugriff verweigert'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, base64: true });
        if (!res.canceled && res.assets?.[0]?.base64) {
          state.setProfile({ avatarBase64: `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}` });
        }
      }
    } catch (e) { Alert.alert('Fehler', String(e)); }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name='chevron-back' size={26} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name='star' size={16} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '800', marginHorizontal: 6 }}>Profil</Text>
            <Ionicons name='star' size={16} color={colors.primary} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Avatar, persönliche Daten und BMI</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Info field */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Info</Text>
            <TouchableOpacity onPress={() => setHelp(h => ({ ...h, info: !h.info }))}>
              <Ionicons name='information-circle-outline' size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {help.info ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Deine Profildaten werden nur lokal auf dem Gerät gespeichert. Ein Avatar hilft dir, dein Profil zu personalisieren. Größe und Geburtsdatum werden für Analysen (z. B. BMI) verwendet.
            </Text>
          ) : null}
        </View>

        {/* Avatar + Name */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Profil</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {state.profile.avatarBase64 ? (
                <Image source={{ uri: state.profile.avatarBase64 }} style={{ width: 72, height: 72 }} />
              ) : (
                <Ionicons name='person' size={32} color={colors.muted} />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <TextInput
                placeholder='Name'
                placeholderTextColor={colors.muted}
                value={state.profile.name || ''}
                onChangeText={(v)=> state.setProfile({ name: v })}
                style={{ borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.input }}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={() => pickImage('camera')} style={[styles.badge, { borderColor: colors.muted }]}>
                  <Ionicons name='camera' size={16} color={colors.text} />
                  <Text style={{ color: colors.text, marginLeft: 6 }}>Kamera</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => pickImage('gallery')} style={[styles.badge, { borderColor: colors.muted }]}>
                  <Ionicons name='images' size={16} color={colors.text} />
                  <Text style={{ color: colors.text, marginLeft: 6 }}>Galerie</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Personal data */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Details</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, width: 120 }}>Geburtsdatum</Text>
              <TextInput
                placeholder='YYYY-MM-DD'
                placeholderTextColor={colors.muted}
                value={state.profile.dob || ''}
                onChangeText={(v)=> state.setProfile({ dob: v })}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.input }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, width: 120 }}>Geschlecht</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['female','male','other','na'] as const).map((g) => (
                  <TouchableOpacity key={g} onPress={() => state.setProfile({ gender: g })} style={[styles.badge, { borderColor: colors.muted, backgroundColor: state.profile.gender===g?colors.primary:'transparent' }]}>
                    <Text style={{ color: state.profile.gender===g?'#fff':colors.text }}>{g==='female'?'w':'m'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: colors.text, width: 120 }}>Größe</Text>
              <TextInput
                placeholder='170'
                placeholderTextColor={colors.muted}
                keyboardType='number-pad'
                value={typeof state.profile.heightCm==='number' ? String(state.profile.heightCm) : ''}
                onChangeText={(v)=> { const n = parseInt(v.replace(/[^0-9]/g,''),10); state.setProfile({ heightCm: isNaN(n)?undefined:n }); }}
                style={{ flex: 1, borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, color: colors.text, backgroundColor: colors.input }}
              />
              <Text style={{ color: colors.muted, marginLeft: 8 }}>cm</Text>
            </View>
          </View>
        </View>

        {/* BMI */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name='scale' size={18} color={colors.primary} />
              <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 8 }}>BMI</Text>
            </View>
            <TouchableOpacity onPress={() => setHelp(h => ({ ...h, bmi: !h.bmi }))}>
              <Ionicons name='information-circle-outline' size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {help.bmi ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>BMI = Gewicht (kg) / (Größe in m)^2. Kategorien: &lt;18.5 Untergewicht, 18.5–24.9 Normalgewicht, 25–29.9 Übergewicht, ≥30 Adipositas. Für Erwachsene.</Text>
          ) : null}

          {(!heightM || !lastWeight) ? (
            <Text style={{ color: colors.muted, marginTop: 8 }}>Bitte Größe und mindestens ein Gewicht eintragen.</Text>
          ) : (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: colors.text }}>Letztes Gewicht: {lastWeight?.toFixed(1)} kg · Größe: {Math.round((heightM||0)*100)} cm</Text>
              <Text style={{ color: colors.text, marginTop: 2 }}>BMI: {bmi?.toFixed(1)} {bmiCategory?`(${bmiCategory.label})`:''}</Text>
              {/* Colored bar */}
              <View style={{ height: 10, backgroundColor: colors.bg, borderRadius: 5, overflow: 'hidden', marginTop: 8 }}>
                <View style={{ width: '100%', height: '100%', flexDirection: 'row' }}>
                  <View style={{ flex: 185, backgroundColor: '#2196F3' }} />
                  <View style={{ flex: 250-185, backgroundColor: '#4CAF50' }} />
                  <View style={{ flex: 300-250, backgroundColor: '#FFC107' }} />
                  <View style={{ flex: 400-300, backgroundColor: '#F44336' }} />
                </View>
              </View>
              {/* Indicator */}
              {bmi ? (
                <View style={{ position: 'relative', height: 16, marginTop: 2 }}>
                  <View style={{ position: 'absolute', left: Math.min(100, Math.max(0, (bmi/40)*100)) + '%', top: 0 }}>
                    <Ionicons name='caret-down' size={16} color={bmiCategory?.color || colors.primary} />
                  </View>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 12 }, badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 } });
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../src/store/useStore';
import { toKey } from '../src/utils/date';
import { PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866' };
}

function bytesFromBase64(b64: string) { try { const l = b64.includes(',')? b64.split(',')[1].length : b64.length; return Math.floor(l * (3/4)); } catch { return 0; } }

export default function GalleryScreen() {
  const state = useAppStore();
  const router = useRouter();
  const colors = useThemeColors(state.theme);
  const [info, setInfo] = useState(false);

  // Calendar state
  const [monthDate, setMonthDate] = useState(new Date());
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 0);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // Mon=0
  const daysInMonth = monthEnd.getDate();

  const [selectedDateKey, setSelectedDateKey] = useState(toKey(new Date()));
  const selectedPhotos = state.gallery[selectedDateKey] || [];

  // Stats
  const allKeys = Object.keys(state.gallery).sort();
  const firstPhotoDate = allKeys[0] ? allKeys[0] : undefined;
  const lastPhotoDate = allKeys.length ? allKeys[allKeys.length-1] : undefined;
  const storageBytes = useMemo(() => {
    let sum = 0; for (const k of Object.keys(state.gallery)) { for (const p of (state.gallery[k]||[])) sum += bytesFromBase64(p.base64); }
    return sum;
  }, [state.gallery]);
  const storageMB = (storageBytes/1024/1024).toFixed(1);

  const last3Months = Array.from({length:3}).map((_,i)=>{
    const d = new Date(); d.setMonth(d.getMonth()-i); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const daysWithPhotosCount = (d: Date) => {
    const m = d.getMonth(), y = d.getFullYear();
    const keys = Object.keys(state.gallery).filter(k => { const dt = new Date(k); return dt.getFullYear()===y && dt.getMonth()===m; });
    return keys.length;
  };

  async function addPhoto(from: 'camera'|'gallery') {
    const count = selectedPhotos.length;
    if (count >= 5) { alert('Max. 5 Fotos pro Tag'); return; }
    try {
      if (from==='camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status!=='granted') { alert('Kamera nicht erlaubt'); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
        if (!res.canceled && res.assets?.[0]?.base64) {
          const b64 = `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}`;
          state.addPhoto(selectedDateKey, b64);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status!=='granted') { alert('Galerie nicht erlaubt'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true });
        if (!res.canceled && res.assets?.[0]?.base64) {
          const b64 = `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}`;
          state.addPhoto(selectedDateKey, b64);
        }
      }
    } catch (e) { alert(String(e)); }
  }

  // Viewer
  const [viewer, setViewer] = useState<{visible:boolean; uri?:string}>({visible:false});
  const [scale, setScale] = useState(1);

  const daysWithPhotosSet = new Set(Object.keys(state.gallery));

  // A/B compare
  const photosDays = Object.keys(state.gallery).sort();
  const [aDay, setADay] = useState<string | undefined>(photosDays[0]);
  const [bDay, setBDay] = useState<string | undefined>(photosDays[1] || photosDays[0]);
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(0);

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
        {/* Info */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Info</Text>
            <TouchableOpacity onPress={()=> setInfo(v=>!v)}>
              <Ionicons name='information-circle-outline' size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          {info ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>
              Fotos pro Tag: max. 5 (Kamera/Galerie). Bilder werden komprimiert und lokal gespeichert. Unten findest du Kalender-Markierungen, Vollbild-Zoom, A/B-Vergleich sowie Foto‑Erfolge. Speicher aktuell ~{storageMB} MB.
            </Text>
          ) : null}
        </View>

        {/* Calendar */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <TouchableOpacity onPress={()=>{ const d=new Date(monthDate); d.setMonth(d.getMonth()-1); setMonthDate(d); }} style={{ padding: 6 }}>
              <Ionicons name='chevron-back' size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{monthDate.toLocaleDateString(state.language==='en'?'en-GB':(state.language==='pl'?'pl-PL':'de-DE'), { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={()=>{ const d=new Date(monthDate); d.setMonth(d.getMonth()+1); setMonthDate(d); }} style={{ padding: 6 }}>
              <Ionicons name='chevron-forward' size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {Array.from({length:firstWeekday}).map((_,i)=> (
              <View key={`emp${i}`} style={{ width: '13%', alignItems: 'center' }}>
                <Text style={{ color: 'transparent' }}>.</Text>
              </View>
            ))}
            {Array.from({length:daysInMonth}).map((_,i)=>{
              const day=i+1; const key = toKey(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
              const has = daysWithPhotosSet.has(key);
              const selected = key===selectedDateKey;
              return (
                <TouchableOpacity key={key} onPress={()=> setSelectedDateKey(key)} style={{ width: '13%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: selected?colors.primary:colors.muted, backgroundColor: selected?colors.primary+'20':'transparent' }}>
                  <Text style={{ color: colors.text }}>{day}</Text>
                  {has ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary, marginTop: 2 }} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ color: colors.muted, marginTop: 8 }}>Ausgewählt: {selectedDateKey}</Text>
        </View>

        {/* Add photo */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Fotos ({selectedPhotos.length}/5)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={()=> addPhoto('camera')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}>
                <Text style={{ color: colors.text }}>Kamera</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=> addPhoto('gallery')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}>
                <Text style={{ color: colors.text }}>Galerie</Text>
              </TouchableOpacity>
            </View>
          </View>
          {selectedPhotos.length===0 ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>Noch keine Fotos für diesen Tag.</Text>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {selectedPhotos.map((p,i)=> (
                <TouchableOpacity key={p.id} onPress={()=>{ setScale(1); setViewer({ visible: true, uri: p.base64 }); }} onLongPress={()=> state.deletePhoto(selectedDateKey, p.id)}>
                  <Image source={{ uri: p.base64 }} style={{ width: 100, height: 140, borderRadius: 8 }} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Stats under calendar */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={{ color: colors.text, fontWeight: '700' }}>Statistik</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>Erstes Foto vom: {firstPhotoDate || '—'}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>Letztes Foto vom: {lastPhotoDate || '—'}</Text>
          <View style={{ marginTop: 6 }}>
            {last3Months.map((d,i)=> (
              <Text key={i} style={{ color: colors.muted }}>Fotos in {d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}: {daysWithPhotosCount(d)} Tage</Text>
            ))}
          </View>
        </View>

        {/* A/B compare */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={{ color: colors.text, fontWeight: '700' }}>A/B-Vergleich</Text>
          {photosDays.length<1 ? (<Text style={{ color: colors.muted, marginTop: 6 }}>Zu wenige Daten</Text>) : (
            <View style={{ marginTop: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {photosDays.map((k)=> (
                    <TouchableOpacity key={k} onPress={()=> setADay(k)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: aDay===k?colors.primary:'transparent' }}>
                      <Text style={{ color: aDay===k?'#fff':colors.text }}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {photosDays.map((k)=> (
                    <TouchableOpacity key={k} onPress={()=> setBDay(k)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: bDay===k?colors.primary:'transparent' }}>
                      <Text style={{ color: bDay===k?'#fff':colors.text }}>{k}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(state.gallery[aDay||'']||[]).map((p,idx)=> (
                      <TouchableOpacity key={p.id} onPress={()=> setAIdx(idx)} style={{ paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: aIdx===idx?colors.primary:'transparent' }}>
                        <Text style={{ color: aIdx===idx?'#fff':colors.text }}>A {idx+1}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(state.gallery[bDay||'']||[]).map((p,idx)=> (
                      <TouchableOpacity key={p.id} onPress={()=> setBIdx(idx)} style={{ paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: bIdx===idx?colors.primary:'transparent' }}>
                        <Text style={{ color: bIdx===idx?'#fff':colors.text }}>B {idx+1}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, justifyContent: 'space-between' }}>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  {aDay && (state.gallery[aDay]||[])[aIdx] ? (
                    <Image source={{ uri: (state.gallery[aDay]||[])[aIdx].base64 }} style={{ width: '100%', height: 260, borderRadius: 8 }} resizeMode='cover' />
                  ) : <Text style={{ color: colors.muted }}>A —</Text>}
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  {bDay && (state.gallery[bDay]||[])[bIdx] ? (
                    <Image source={{ uri: (state.gallery[bDay]||[])[bIdx].base64 }} style={{ width: '100%', height: 260, borderRadius: 8 }} resizeMode='cover' />
                  ) : <Text style={{ color: colors.muted }}>B —</Text>}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Photo achievements */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Foto-Erfolge</Text>
            <TouchableOpacity onPress={()=> setInfo(v=>!v)}>
              <Ionicons name='information-circle-outline' size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {[1,5,20,50,100].map((n)=>{
              const achieved = allKeys.length >= n;
              return (
                <View key={n} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: achieved?colors.primary:colors.muted, backgroundColor: achieved?colors.primary:'transparent' }}>
                  <Text style={{ color: achieved?'#fff':colors.text }}>{n} Tag{n>1?'e':''} mit Foto</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Fullscreen viewer */}
      <Modal visible={viewer.visible} transparent animationType='fade' onRequestClose={()=> setViewer({visible:false})}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
          <TouchableOpacity onPress={()=> setViewer({visible:false})} style={{ position: 'absolute', top: 40, right: 16, zIndex: 2 }}>
            <Ionicons name='close' size={28} color={'#fff'} />
          </TouchableOpacity>
          <PinchGestureHandler onGestureEvent={(e:any)=> { const s = e.nativeEvent.scale || 1; setScale(Math.min(4, Math.max(1, s))); }} onHandlerStateChange={(e:any)=>{ if (e.nativeEvent.state===GHState.END) { /* keep scale */ } }}>
            <View style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height*0.8, alignItems: 'center', justifyContent: 'center' }}>
              {viewer.uri ? (
                <Image source={{ uri: viewer.uri }} style={{ width: '90%', height: '90%', transform: [{ scale }], resizeMode: 'contain' }} />
              ) : null}
            </View>
          </PinchGestureHandler>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 12 } });
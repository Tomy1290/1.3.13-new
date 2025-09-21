import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Dimensions, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAppStore } from '../src/store/useStore';
import { toKey } from '../src/utils/date';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866' };
}

function bytesFromBase64(b64: string) { try { const l = b64.includes(',')? b64.split(',')[1].length : b64.length; return Math.floor(l * (3/4)); } catch { return 0; } }

export default function GalleryScreen() {
  function fmtKey(key?: string) {
    try {
      if (!key) return '—';
      const [y, m, d] = key.split('-');
      if (!y || !m || !d) return key;
      return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`;
    } catch {
      return key || '—';
    }
  }
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
  const daysWithPhotosCount = (d: Date) =&gt; {
    const m = d.getMonth(), y = d.getFullYear();
    const keys = Object.keys(state.gallery).filter(k =&gt; { const dt = new Date(k); return dt.getFullYear()===y &amp;&amp; dt.getMonth()===m; });
    return keys.length;
  };

  async function addPhoto(from: 'camera'|'gallery') {
    const count = selectedPhotos.length;
    if (count &gt;= 5) { alert('Max. 5 Fotos pro Tag'); return; }
    try {
      if (from==='camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status!=='granted') { alert('Kamera nicht erlaubt'); return; }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.6, base64: true });
        if (!res.canceled &amp;&amp; res.assets?.[0]?.base64) {
          const b64 = `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}`;
          state.addPhoto(selectedDateKey, b64);
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status!=='granted') { alert('Galerie nicht erlaubt'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.6, base64: true });
        if (!res.canceled &amp;&amp; res.assets?.[0]?.base64) {
          const b64 = `data:${res.assets[0].mimeType||'image/jpeg'};base64,${res.assets[0].base64}`;
          state.addPhoto(selectedDateKey, b64);
        }
      }
    } catch (e) { alert(String(e)); }
  }

  // Viewer (Pinch-to-zoom via Gesture API + Reanimated)
  const [viewer, setViewer] = useState&lt;{visible:boolean; uri?:string}&gt;({visible:false});
  const scaleSv = useSharedValue(1);
  const baseScaleSv = useSharedValue(1);
  const pinch = Gesture.Pinch()
    .onStart(() =&gt; { baseScaleSv.value = scaleSv.value; })
    .onUpdate((e) =&gt; { const next = baseScaleSv.value * e.scale; scaleSv.value = Math.min(4, Math.max(1, next)); })
    .onEnd(() =&gt; { /* keep scale */ });
  const imageStyle = useAnimatedStyle(() =&gt; ({ transform: [{ scale: scaleSv.value }] }));

  const daysWithPhotosSet = new Set(Object.keys(state.gallery));

  // A/B compare
  const photosDays = Object.keys(state.gallery).sort();
  // Compare mode flow (Variant A): start button under calendar, then pick 1st day and 2nd day on the calendar
  const [aDay, setADay] = useState&lt;string | undefined&gt;(undefined);
  const [bDay, setBDay] = useState&lt;string | undefined&gt;(undefined);
  const [aIdx, setAIdx] = useState(0);
  const [bIdx, setBIdx] = useState(0);
  const [compareMode, setCompareMode] = useState&lt;'idle'|'selectingA'|'selectingB'|'show'&gt;('idle');

  return (
    &lt;SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}&gt;
      &lt;View style={{ backgroundColor: colors.card, paddingVertical: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}&gt;
        &lt;TouchableOpacity onPress={() =&gt; router.back()} style={{ padding: 8 }}&gt;
          &lt;Ionicons name='chevron-back' size={26} color={colors.text} /&gt;
        &lt;/TouchableOpacity&gt;
        &lt;View style={{ alignItems: 'center' }}&gt;
          &lt;View style={{ flexDirection: 'row', alignItems: 'center' }}&gt;
            &lt;Ionicons name='star' size={16} color={colors.primary} /&gt;
            &lt;Text style={{ color: colors.text, fontWeight: '800', marginHorizontal: 6 }}&gt;{state.language==='de'?'Galerie':(state.language==='pl'?'Galeria':'Gallery')}&lt;/Text&gt;
            &lt;Ionicons name='star' size={16} color={colors.primary} /&gt;
          &lt;/View&gt;
          &lt;Text style={{ color: colors.muted, marginTop: 2 }}&gt;{state.language==='de'?'Fotos vergleichen &amp; Meilensteine':(state.language==='pl'?'Porównuj zdjęcia i kamienie milowe':'Compare photos &amp; milestones')}&lt;/Text&gt;
        &lt;/View&gt;
        &lt;View style={{ width: 40 }} /&gt;
      &lt;/View&gt;

      &lt;ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}&gt;
        {/* Info */}
        &lt;View style={[styles.card, { backgroundColor: colors.card }]}&gt; 
          &lt;View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}&gt;
            &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;Info&lt;/Text&gt;
            &lt;TouchableOpacity onPress={()=> setInfo(v=&gt;!v)}&gt;
              &lt;Ionicons name='information-circle-outline' size={18} color={colors.muted} /&gt;
            &lt;/TouchableOpacity&gt;
          &lt;/View&gt;
          {info ? (
            &lt;Text style={{ color: colors.muted, marginTop: 6 }}&gt;
              Fotos pro Tag: max. 5 (Kamera/Galerie). Bilder werden komprimiert und lokal gespeichert. Unten findest du Kalender-Markierungen, Vollbild-Zoom, A/B-Vergleich sowie Foto‑Erfolge. Speicher aktuell ~{storageMB} MB.
            &lt;/Text&gt;
          ) : null}
        &lt;/View&gt;

        {/* Calendar (styled like Cycle) */}
        &lt;View style={[styles.card, { backgroundColor: colors.card }]}&gt; 
          &lt;View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}&gt;
            &lt;TouchableOpacity onPress={() =&gt; { const d = new Date(monthDate); d.setMonth(d.getMonth() - 1); setMonthDate(d); }} accessibilityLabel='Vorheriger Monat'&gt;
              &lt;Ionicons name='chevron-back' size={20} color={colors.text} /&gt;
            &lt;/TouchableOpacity&gt;
            &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;{new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).toLocaleDateString(state.language==='de'?'de-DE':(state.language==='pl'?'pl-PL':'en-US'), { month: 'long', year: 'numeric' })}&lt;/Text&gt;
            &lt;TouchableOpacity onPress={() =&gt; { const d = new Date(monthDate); d.setMonth(d.getMonth() + 1); setMonthDate(d); }} accessibilityLabel='Nächster Monat'&gt;
              &lt;Ionicons name='chevron-forward' size={20} color={colors.text} /&gt;
            &lt;/TouchableOpacity&gt;
          &lt;/View&gt;
          {/* Weekday header (Mon start) */}
          &lt;View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}&gt;
            {[state.language==='de'?['Mo','Di','Mi','Do','Fr','Sa','So']:(state.language==='pl'?['Pn','Wt','Śr','Cz','Pt','So','Nd']:['Mo','Tu','We','Th','Fr','Sa','Su'])].flat().map((d, i) =&gt; (
              &lt;Text key={i} style={{ color: colors.muted, width: `${100/7}%`, textAlign: 'center' }}&gt;{d}&lt;/Text&gt;
            ))}
          &lt;/View&gt;
          {/* Grid */}
          &lt;View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}&gt;
            {(() =&gt; {
              const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
              const pad = (first.getDay() + 6) % 7; // Monday first
              const blanks = Array.from({ length: pad });
              const days: Date[] = []; const d = new Date(first);
              while (d.getMonth() === monthDate.getMonth()) { days.push(new Date(d)); d.setDate(d.getDate() + 1); }
              return (
                &lt;&gt;
                  {blanks.map((_, i) =&gt; (&lt;View key={`b${i}`} style={{ width: `${100/7}%`, height: 44 }} /&gt;))}
                  {days.map((dayDate, i) =&gt; {
                    const key = toKey(dayDate);
                    const has = daysWithPhotosSet.has(key);
                    const isFuture = +dayDate &gt; +new Date();
                    const selected = key === selectedDateKey;
                    const onDayPress = () =&gt; {
                      setSelectedDateKey(key);
                      if (compareMode === 'selectingA') { setADay(key); setCompareMode('selectingB'); }
                      else if (compareMode === 'selectingB') { if (aDay &amp;&amp; key === aDay) return; setBDay(key); setCompareMode('show'); }
                    };
                    return (
                      &lt;TouchableOpacity key={key} disabled={isFuture} style={{ width: `${100/7}%`, height: 44, alignItems: 'center', justifyContent: 'center', opacity: isFuture ? 0.5 : 1 }} onPress={onDayPress} accessibilityLabel={`Tag ${key}`}&gt;
                        &lt;View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? `${colors.primary}22` : 'transparent', borderWidth: selected ? 2 : 0, borderColor: selected ? colors.primary : 'transparent' }}&gt;
                          &lt;Text style={{ color: colors.text }}&gt;{dayDate.getDate()}&lt;/Text&gt;
                          {has ? &lt;View style={{ position: 'absolute', bottom: 3, width: 18, height: 2, backgroundColor: colors.primary, borderRadius: 1 }} /&gt; : null}
                        &lt;/View&gt;
                      &lt;/TouchableOpacity&gt;
                    );
                  })}
                &lt;/&gt;
              );
            })()}
          &lt;/View&gt;
          &lt;Text style={{ color: colors.muted, marginTop: 8 }}&gt;{state.language==='de'?'Ausgewählt':'Selected'}: {selectedDateKey}&lt;/Text&gt;
          {/* Compare controls under calendar */}
          &lt;View style={{ marginTop: 10 }}&gt;
            {compareMode === 'idle' ? (
              &lt;TouchableOpacity disabled={Object.keys(state.gallery).length &lt; 2} onPress={() =&gt; { setADay(undefined); setBDay(undefined); setAIdx(0); setBIdx(0); setCompareMode('selectingA'); }} style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, opacity: Object.keys(state.gallery).length &lt; 2 ? 0.5 : 1 }}&gt;
                &lt;Text style={{ color: colors.text }}&gt;{state.language==='de'?'Vergleich starten':'Start compare'}&lt;/Text&gt;
              &lt;/TouchableOpacity&gt;
            ) : null}
            {compareMode === 'selectingA' ? (
              &lt;Text style={{ color: colors.muted }}&gt;{state.language==='de'?'Wähle im Kalender zuerst den Tag (Vorher).':'Pick the first day (Before) on the calendar.'}&lt;/Text&gt;
            ) : null}
            {compareMode === 'selectingB' ? (
              &lt;Text style={{ color: colors.muted }}&gt;{state.language==='de'?'Wähle den zweiten Tag (Nachher).':'Pick the second day (After).'}&lt;/Text&gt;
            ) : null}
            {compareMode === 'show' ? (
              &lt;View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}&gt;
                &lt;View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}&gt;
                  &lt;Ionicons name='swap-horizontal' size={16} color={colors.muted} /&gt;
                  &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;{state.language==='de'?'Vorher':'Before'}: {aDay}&lt;/Text&gt;
                &lt;/View&gt;
                &lt;Text style={{ color: colors.muted }}&gt;→&lt;/Text&gt;
                &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;{state.language==='de'?'Nachher':'After'}: {bDay}&lt;/Text&gt;
                &lt;View style={{ flex: 1 }} /&gt;
                &lt;TouchableOpacity onPress={() =&gt; setCompareMode('idle')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}&gt;
                  &lt;Text style={{ color: colors.text }}&gt;{state.language==='de'?'Vergleich beenden':'End compare'}&lt;/Text&gt;
                &lt;/TouchableOpacity&gt;
              &lt;/View&gt;
            ) : null}
          &lt;/View&gt;
        &lt;/View&gt;

        {/* Add photo */}
        &lt;View style={[styles.card, { backgroundColor: colors.card }]}&gt; 
          &lt;View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}&gt;
            &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;Fotos ({selectedPhotos.length}/5)&lt;/Text&gt;
            &lt;View style={{ flexDirection: 'row', gap: 8 }}&gt;
              &lt;TouchableOpacity onPress={()=> addPhoto('camera')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}&gt;
                &lt;Text style={{ color: colors.text }}&gt;Kamera&lt;/Text&gt;
              &lt;/TouchableOpacity&gt;
              &lt;TouchableOpacity onPress={()=> addPhoto('gallery')} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}&gt;
                &lt;Text style={{ color: colors.text }}&gt;Galerie&lt;/Text&gt;
              &lt;/TouchableOpacity&gt;
            &lt;/View&gt;
          &lt;/View&gt;
          {selectedPhotos.length===0 ? (
            &lt;Text style={{ color: colors.muted, marginTop: 6 }}&gt;Noch keine Fotos für diesen Tag.&lt;/Text&gt;
          ) : (
            &lt;View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}&gt;
              {selectedPhotos.map((p,i)=&gt; (
                &lt;View key={p.id} style={{ width: 100, height: 140 }}&gt;
                  &lt;TouchableOpacity activeOpacity={0.9} onPress={()=&gt;{ scaleSv.value = 1; baseScaleSv.value = 1; setViewer({ visible: true, uri: p.base64 }); }} style={{ width: '100%', height: '100%' }}&gt;
                    &lt;Image source={{ uri: p.base64 }} style={{ width: '100%', height: '100%', borderRadius: 8 }} /&gt;
                  &lt;/TouchableOpacity&gt;
                  &lt;TouchableOpacity onPress={()=&gt; Alert.alert(state.language==='de'?'Bild löschen?':'Delete photo?', state.language==='de'?'Möchtest du dieses Bild wirklich löschen?':'Do you really want to delete this photo?', [
                    { text: state.language==='de'?'Abbrechen':'Cancel', style: 'cancel' },
                    { text: state.language==='de'?'Löschen':'Delete', style: 'destructive', onPress: ()=&gt; state.deletePhoto(selectedDateKey, p.id) },
                  ])} accessibilityLabel='Foto löschen' style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 14, padding: 6 }}&gt;
                    &lt;Ionicons name='trash' size={16} color={'#fff'} /&gt;
                  &lt;/TouchableOpacity&gt;
                &lt;/View&gt;
              ))}
            &lt;/View&gt;
          )}
        &lt;/View&gt;

        {/* Stats under calendar */}
        &lt;View style={[styles.card, { backgroundColor: colors.card }]}&gt; 
          &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;Statistik&lt;/Text&gt;
          &lt;Text style={{ color: colors.muted, marginTop: 6 }}&gt;Erstes Foto vom: {firstPhotoDate || '—'}&lt;/Text&gt;
          &lt;Text style={{ color: colors.muted, marginTop: 2 }}&gt;Letztes Foto vom: {lastPhotoDate || '—'}&lt;/Text&gt;
          &lt;View style={{ marginTop: 6 }}&gt;
            {last3Months.map((d,i)=&gt; (
              &lt;Text key={i} style={{ color: colors.muted }}&gt;Fotos in {d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}: {daysWithPhotosCount(d)} Tage&lt;/Text&gt;
            ))}
          &lt;/View&gt;
        &lt;/View&gt;

        {/* A/B compare */}
        &lt;View style={[styles.card, { backgroundColor: colors.card }]}&gt; 
          &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;{state.language==='de'?'Vorher/Nachher':'Before/After'}&lt;/Text&gt;
          {photosDays.length&lt;1 ? (
            &lt;Text style={{ color: colors.muted, marginTop: 6 }}&gt;Zu wenige Daten&lt;/Text&gt;
          ) : (
            &lt;View style={{ marginTop: 6 }}&gt;
              {/* Bildauswahl (nur Indizes), Tage werden über den Kalender gewählt */}
              {compareMode === 'show' ? (
                &lt;View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}&gt;
                  &lt;ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}&gt;
                    &lt;View style={{ flexDirection: 'row', gap: 6 }}&gt;
                      {(state.gallery[aDay||'']||[]).map((p,idx)=&gt; (
                        &lt;TouchableOpacity key={p.id} onPress={()=&gt; setAIdx(idx)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: aIdx===idx?colors.primary:'transparent' }}&gt;
                          &lt;Text style={{ color: aIdx===idx?'#fff':colors.text }}&gt;{state.language==='de'?'Vorher':'Before'} {idx+1}&lt;/Text&gt;
                        &lt;/TouchableOpacity&gt;
                      ))}
                    &lt;/View&gt;
                  &lt;/ScrollView&gt;
                  &lt;ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}&gt;
                    &lt;View style={{ flexDirection: 'row', gap: 6 }}&gt;
                      {(state.gallery[bDay||'']||[]).map((p,idx)=&gt; (
                        &lt;TouchableOpacity key={p.id} onPress={()=&gt; setBIdx(idx)} style={{ paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.muted, backgroundColor: bIdx===idx?colors.primary:'transparent' }}&gt;
                          &lt;Text style={{ color: bIdx===idx?'#fff':colors.text }}&gt;{state.language==='de'?'Nachher':'After'} {idx+1}&lt;/Text&gt;
                        &lt;/TouchableOpacity&gt;
                      ))}
                    &lt;/View&gt;
                  &lt;/ScrollView&gt;
                &lt;/View&gt;
              ) : null}

              {compareMode === 'show' ? (
                &lt;View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}&gt;
                  &lt;View style={{ flexDirection: 'row', alignItems: 'center' }}&gt;
                    &lt;Ionicons name='swap-horizontal' size={16} color={colors.muted} /&gt;
                    &lt;Text style={{ color: colors.text, fontWeight: '700', marginLeft: 6 }}&gt;
                      {(state.language==='de'?'Vorher':'Before')}: {fmtKey(aDay)}
                    &lt;/Text&gt;
                    &lt;Text style={{ color: colors.muted, marginHorizontal: 6 }}&gt;→&lt;/Text&gt;
                    &lt;Text style={{ color: colors.text, fontWeight: '700' }}&gt;
                      {(state.language==='de'?'Nachher':'After')}: {fmtKey(bDay)}
                    &lt;/Text&gt;
                  &lt;/View&gt;
                &lt;/View&gt;
              ) : null}

              &lt;View style={{ flexDirection: 'row', gap: 8, justifyContent: 'space-between' }}&gt;
                &lt;View style={{ flex: 1, alignItems: 'center' }}&gt;
                  {aDay &amp;&amp; (state.gallery[aDay]||[])[aIdx] ? (
                    &lt;Image source={{ uri: (state.gallery[aDay]||[])[aIdx].base64 }} style={{ width: '100%', height: 260, borderRadius: 8 }} resizeMode='cover' /&gt;
                  ) : &lt;Text style={{ color: colors.muted }}&gt;{state.language==='de'?'Vorher —':'Before —'}&lt;/Text&gt;}
                &lt;/View&gt;
                &lt;View style={{ flex: 1, alignItems: 'center' }}&gt;
                  {bDay &amp;&amp; (state.gallery[bDay]||[])[bIdx] ? (
                    &lt;Image source={{ uri: (state.gallery[bDay]||[])[bIdx].base64 }} style={{ width: '100%', height: 260, borderRadius: 8 }} resizeMode='cover' /&gt;
                  ) : &lt;Text style={{ color: colors.muted }}&gt;{state.language==='de'?'Nachher —':'After —'}&lt;/Text&gt;}
                &lt;/View&gt;
              &lt;/View&gt;
            &lt;/View&gt;
          )}
        &lt;/View&gt;
        &lt;/ScrollView&gt;

      {/* Fullscreen viewer */}
      &lt;Modal visible={viewer.visible} transparent animationType='fade' onRequestClose={()=&gt; setViewer({visible:false})}&gt;
        &lt;View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}&gt;
          &lt;TouchableOpacity onPress={()=&gt; setViewer({visible:false})} style={{ position: 'absolute', top: 40, right: 16, zIndex: 2 }}&gt;
            &lt;Ionicons name='close' size={28} color={'#fff'} /&gt;
          &lt;/TouchableOpacity&gt;
          &lt;GestureDetector gesture={pinch}&gt;
            &lt;View style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').height*0.8, alignItems: 'center', justifyContent: 'center' }}&gt;
              {viewer.uri ? (
                &lt;Animated.Image source={{ uri: viewer.uri }} style={[{ width: '90%', height: '90%' }, imageStyle]} resizeMode='contain' /&gt;
              ) : null}
            &lt;/View&gt;
          &lt;/GestureDetector&gt;
        &lt;/View&gt;
      &lt;/Modal&gt;
    &lt;/SafeAreaView&gt;
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 12 } });
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppStore } from '../src/store/useStore';
import { getWeekRange, getCurrentWeeklyEvent, computeEventProgress } from '../src/gamification/events';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866' };
}

export default function EventsScreen() {
  const router = useRouter();
  const state = useAppStore();
  const colors = useThemeColors(state.theme);

  const cur = getWeekRange(new Date());
  const next = getWeekRange(new Date(cur.start.getFullYear(), cur.start.getMonth(), cur.start.getDate() + 7));
  const prev1 = getWeekRange(new Date(cur.start.getFullYear(), cur.start.getMonth(), cur.start.getDate() - 7));
  const prev2 = getWeekRange(new Date(cur.start.getFullYear(), cur.start.getMonth(), cur.start.getDate() - 14));
  const prev3 = getWeekRange(new Date(cur.start.getFullYear(), cur.start.getMonth(), cur.start.getDate() - 21));

  const evtCur = getCurrentWeeklyEvent(cur.start);
  const evtNext = getCurrentWeeklyEvent(next.start);
  const evtPrev = [prev1, prev2, prev3].map((w) => ({ w, e: getCurrentWeeklyEvent(w.start) }));

  const progCur = computeEventProgress(cur.dayKeys, state as any, evtCur);

  const lng2 = state.language === 'en' ? 'en' : 'de';

  const stats = useMemo(() => {
    const vals = Object.values(state.eventHistory || {});
    let passed = 0, failed = 0;
    for (const v of vals) {
      if (!v) continue;
      if (v.completed) passed++; else failed++;
    }
    return { passed, failed };
  }, [state.eventHistory]);

  const appTitle = state.language==='en' ? "Scarlett’s Health Tracking" : (state.language==='pl'? 'Zdrowie Scarlett' : 'Scarletts Gesundheitstracking');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { backgroundColor: colors.card }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel='Zurück'>
          <Ionicons name='chevron-back' size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.appTitle, { color: colors.text }]}>{appTitle}</Text>
          <Text style={[styles.title, { color: colors.muted }]}>{state.language==='de'?'Events':(state.language==='pl'?'Wydarzenia':'Events')}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {/* Aktuelles Event */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{state.language==='de'?'Aktuelles Event':'Current event'}</Text>
            {progCur.completed ? (
              <Ionicons name='checkmark-circle' size={18} color={'#2bb673'} />
            ) : (
              <Ionicons name='time' size={18} color={colors.muted} />
            )}
          </View>
          <Text style={{ color: colors.text, marginTop: 6 }}>{evtCur.title(lng2 as any)}</Text>
          <View style={{ height: 6, backgroundColor: colors.bg, borderRadius: 3, overflow: 'hidden', marginTop: 6 }}>
            <View style={{ width: `${Math.round(progCur.percent)}%`, height: 6, backgroundColor: progCur.completed ? '#2bb673' : colors.primary }} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{Math.round(progCur.percent)}%</Text>
        </View>

        {/* Kommendes Event */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '800' }}>{state.language==='de'?'Kommendes Event':'Upcoming event'}</Text>
            <Ionicons name='calendar' size={18} color={colors.muted} />
          </View>
          <Text style={{ color: colors.text, marginTop: 6 }}>{evtNext.title(lng2 as any)}</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>{next.start.toLocaleDateString()} – {next.end.toLocaleDateString()}</Text>
        </View>

        {/* Vergangene Events (letzte 3) */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={{ color: colors.text, fontWeight: '800' }}>{state.language==='de'?'Vergangene Events':'Past events'}</Text>
          <View style={{ marginTop: 8, gap: 8 }}>
            {evtPrev.map(({ w, e }) => {
              const hist = (state.eventHistory || {})[w.weekKey];
              return (
                <View key={w.weekKey} style={{ borderWidth: 1, borderColor: colors.bg, borderRadius: 10, padding: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{e.title(lng2 as any)}</Text>
                    {hist?.completed ? (
                      <Ionicons name='checkmark-circle' size={18} color={'#2bb673'} />
                    ) : (
                      <Ionicons name='time' size={18} color={colors.muted} />
                    )}
                  </View>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>{w.start.toLocaleDateString()} – {w.end.toLocaleDateString()}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>{hist?.completed ? `+${hist.xp} XP` : (state.language==='de'?'Nicht abgeschlossen':(state.language==='pl'?'Nieukończone':'Not completed'))}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Statistik: Anzahl bestanden/nicht bestanden */}
        <View style={[styles.card, { backgroundColor: colors.card }]}> 
          <Text style={{ color: colors.text, fontWeight: '800' }}>{state.language==='de'?'Statistik':'Statistics'}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name='checkmark-circle' size={18} color={'#2bb673'} />
              <Text style={{ color: colors.text, marginLeft: 6 }}>{state.language==='de'?'Bestanden':'Passed'}: {stats.passed}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name='close-circle' size={18} color={'#e57373'} />
              <Text style={{ color: colors.text, marginLeft: 6 }}>{state.language==='de'?'Nicht bestanden':'Failed'}: {stats.failed}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, appTitle: { fontSize: 14, fontWeight: '800' }, title: { fontSize: 12, fontWeight: '600' }, iconBtn: { padding: 8 }, card: { borderRadius: 12, padding: 12 } });
import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
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

function daysBetween(a: Date, b: Date) { return Math.max(1, Math.round((+b - +a) / (1000*60*60*24))); }

export default function GoalsScreen() {
  const state = useAppStore();
  const router = useRouter();
  const colors = useThemeColors(state.theme);
  const [info, setInfo] = useState(false);

  const weights = useMemo(() => Object.values(state.days).filter((d)=> typeof d.weight==='number').sort((a,b)=> a.date.localeCompare(b.date)), [state.days]);
  const lastW = useMemo(()=> weights.length? Number(weights[weights.length-1].weight): undefined, [weights]);
  const firstW = useMemo(()=> weights.length? Number(weights[0].weight): undefined, [weights]);
  const firstDate = useMemo(()=> weights.length? new Date(weights[0].date): undefined, [weights]);

  const [targetWInput, setTargetWInput] = useState(state.goal?.targetWeight ? String(state.goal.targetWeight) : (lastW?String(lastW):''));
  const [targetDateInput, setTargetDateInput] = useState(state.goal?.targetDate || '');

  const planVsActual = useMemo(() => {
    if (!firstW || !firstDate || !targetDateInput || !lastW) return null;
    const targetDate = new Date(targetDateInput);
    if (isNaN(+targetDate)) return null;
    const totalDays = daysBetween(firstDate, targetDate);
    const elapsed = daysBetween(firstDate, new Date());
    const ratio = Math.min(1, Math.max(0, elapsed/totalDays));
    const plannedToday = firstW + (Number(targetWInput||firstW) - firstW) * ratio;
    const delta = lastW - plannedToday;
    return { plannedToday, actual: lastW, delta };
  }, [firstW, firstDate, targetDateInput, lastW, targetWInput]);

  // Pace 7d and trend/ETA
  const metrics = useMemo(() => {
    if (weights.length < 2) return { pace: 0, eta: null as Date|null, trend: '—', plateau: false };
    const map: Record<string, number> = {}; weights.forEach((w:any)=>{ map[w.date]=Number(w.weight)||0; });
    const today = weights[weights.length-1];
    const d7 = new Date(today.date); d7.setDate(d7.getDate()-7);
    let refKey = d7.toISOString().slice(0,10);
    let ref = map[refKey];
    // find nearest within 3 days back if exact missing
    if (typeof ref !== 'number') {
      for (let k=1;k<=3;k++) { const cand = new Date(d7); cand.setDate(cand.getDate()-k); const key = cand.toISOString().slice(0,10); if (typeof map[key]==='number') { ref = map[key]; break; } }
    }
    let pace = 0; // kg/day
    if (typeof ref === 'number') {
      const days = daysBetween(new Date(refKey), new Date(today.date));
      if (days>0) pace = (Number(today.weight)-ref)/days;
    } else {
      // fallback: first vs last of last 7 entries
      const slice = weights.slice(-7);
      if (slice.length>=2) {
        const first = Number(slice[0].weight); const last = Number(slice[slice.length-1].weight);
        const days = daysBetween(new Date(slice[0].date), new Date(slice[slice.length-1].date));
        pace = days>0 ? (last-first)/days : 0;
      }
    }
    // trend simple
    const lastN = weights.slice(-10);
    const change = Number(lastN[lastN.length-1].weight) - Number(lastN[0].weight);
    const plateau = Math.abs(change) < 0.5;
    const trend = pace < -0.02 ? 'fallend' : (pace > 0.02 ? 'steigend' : 'stabil');

    // ETA
    let eta: Date|null = null;
    const target = Number(targetWInput||0);
    const last = Number(today.weight);
    if (target && pace) {
      const towardLoss = target < last && pace < 0; // losing and moving down
      const towardGain = target > last && pace > 0; // gaining and moving up
      if (towardLoss || towardGain) {
        const daysRemain = Math.abs((target - last) / pace);
        if (isFinite(daysRemain) && daysRemain < 365*5) {
          eta = new Date(); eta.setDate(eta.getDate() + Math.round(daysRemain));
        }
      }
    }
    return { pace, trend, plateau, eta };
  }, [weights, targetWInput]);

  const bmi = useMemo(() => {
    const h = state.profile.heightCm ? state.profile.heightCm/100 : undefined;
    if (!h || !lastW) return undefined;
    return lastW / (h*h);
  }, [state.profile.heightCm, lastW]);

  const tips = useMemo(() => {
    const list: string[] = [];
    const pace = metrics.pace;
    const plateau = metrics.plateau;
    const waterAvg = (() => {
      const days = Object.values(state.days);
      const last7 = days.sort((a:any,b:any)=> a.date.localeCompare(b.date)).slice(-7);
      if (last7.length===0) return 0; return last7.reduce((acc:any,d:any)=> acc + (d.drinks?.water||0), 0) / last7.length;
    })();
    const sportDays7 = (()=>{
      const days = Object.values(state.days).sort((a:any,b:any)=> a.date.localeCompare(b.date)).slice(-7);
      return days.filter((d:any)=> d.drinks?.sport).length;
    })();
    if (plateau) list.push('Plateau erkannt: Variiere Kalorienbilanz leicht und prüfe Wasserkonsum.');
    if (pace < -0.25) list.push('Sehr schneller Gewichtsverlust: Achte auf Gesundheit und setze auf nachhaltige Pace.');
    if (waterAvg < 3) list.push('Mehr trinken: Ziel 35 ml/kg pro Tag hilft dem Stoffwechsel.');
    if (sportDays7 < 2) list.push('Mehr Bewegung: 2–3 leichte Sporteinheiten pro Woche steigern den Trend.');
    if (list.length===0) list.push('Weiter so! Stabiler Kurs – konsistent bleiben.');
    return list.slice(0,3);
  }, [metrics, state.days]);

  function saveGoal() {
    const tw = parseFloat((targetWInput||'').replace(',','.'));
    if (!tw || !targetDateInput) return;
    const startW = firstW || (lastW||tw);
    state.setGoal({ targetWeight: tw, targetDate: targetDateInput, startWeight: startW, active: true });
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
            <Text style={{ color: colors.text, fontWeight: '800', marginHorizontal: 6 }}>{state.language==='de'?'Zielgewichte':(state.language==='pl'?'Cele wagowe':'Target weights')}</Text>
            <Ionicons name='star' size={16} color={colors.primary} />
          </View>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{state.language==='de'?'Plan vs. Ist · Pace 7d · ETA/Trend · BMI':(state.language==='pl'?'Plan vs. Rzecz. · tempo 7d · ETA/Trend · BMI':'Plan vs. actual · Pace 7d · ETA/Trend · BMI')}</Text>
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
              Plan vs. Ist basiert auf einer linearen Entwicklung zwischen Startgewicht und Zielgewicht bis zum Zieldatum. Pace 7d = kg/Tag der letzten Woche. ETA schätzt das Datum bei gleichbleibender Pace. BMI nutzt Profildaten.
            </Text>
          ) : null}
        </View>

        {/* Goal form */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{state.language==='de'?'Ziel setzen':(state.language==='pl'?'Ustaw cel':'Set goal')}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: colors.text, width: 120 }}>Zielgewicht</Text>
            <TextInput value={targetWInput} onChangeText={setTargetWInput} keyboardType='decimal-pad' placeholder='z. B. 62,0' placeholderTextColor={colors.muted} style={{ flex: 1, borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, color: colors.text }} />
            <Text style={{ color: colors.muted, marginLeft: 8 }}>kg</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: colors.text, width: 120 }}>Zieldatum</Text>
            <TextInput value={targetDateInput} onChangeText={setTargetDateInput} placeholder='YYYY-MM-DD' placeholderTextColor={colors.muted} style={{ flex: 1, borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, color: colors.text }} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {state.goal ? (
              <TouchableOpacity onPress={()=> state.removeGoal()} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.muted }}>
                <Text style={{ color: colors.text }}>Entfernen</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={saveGoal} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary }}>
              <Text style={{ color: '#fff' }}>Speichern</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan vs. Ist */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Plan vs. Ist</Text>
          {!planVsActual ? (
            <Text style={{ color: colors.muted, marginTop: 6 }}>Zu wenige Daten</Text>
          ) : (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: colors.muted }}>Geplant heute: {planVsActual.plannedToday.toFixed(1)} kg</Text>
              <Text style={{ color: colors.muted }}>Ist: {planVsActual.actual.toFixed(1)} kg ({planVsActual.delta>=0?'+':''}{planVsActual.delta.toFixed(1)} kg)</Text>
              <View style={{ height: 8, backgroundColor: colors.bg, borderRadius: 4, overflow: 'hidden', marginTop: 6 }}>
                <View style={{ width: `${Math.min(100, Math.max(0, (planVsActual.actual - (state.goal?.targetWeight||planVsActual.actual)) / ((firstW||planVsActual.actual) - (state.goal?.targetWeight||planVsActual.actual) || 1) * 100))}%`, height: 8, backgroundColor: colors.primary }} />
              </View>
            </View>
          )}
        </View>

        {/* Pace/ETA/Trend/BMI */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Pace · ETA · Trend · BMI</Text>
          <View style={{ marginTop: 6, gap: 4 }}>
            <Text style={{ color: colors.muted }}>Pace (7d): {metrics.pace.toFixed(3)} kg/Tag</Text>
            <Text style={{ color: colors.muted }}>Trend: {metrics.trend}{metrics.plateau?' · Plateau':''}</Text>
            <Text style={{ color: colors.muted }}>ETA: {metrics.eta ? metrics.eta.toLocaleDateString() : '—'}</Text>
            <Text style={{ color: colors.muted }}>BMI: {bmi?bmi.toFixed(1):'—'}</Text>
          </View>
        </View>

        {/* Analyse + Kurztipps */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Analyse & Kurztipps</Text>
          {tips.map((t)=> (
            <Text key={t} style={{ color: colors.muted, marginTop: 4 }}>• {t}</Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ card: { borderRadius: 12, padding: 12 } });
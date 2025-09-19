import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore, useLevel } from '../src/store/useStore';
import { useFocusEffect } from '@react-navigation/native';
import { localGreeting, localReply } from '../src/ai/localChat';
import { hybridGreeting, hybridReply, getAIStatus } from '../src/ai/hybridChat';
import { searchRecipes, getRecipeDetail } from '../src/ai/recipes';
import type { Cuisine, Meal, Category } from '../src/data/recipes';
import { answerTopic } from '../src/ai/knowledge';
import { safeTimeHM } from '../src/utils/locale';

function useThemeColors(theme: string) {
  if (theme === 'pink_pastel') return { bg: '#fff0f5', card: '#ffe4ef', primary: '#d81b60', text: '#3a2f33', muted: '#8a6b75', input: '#ffffff' };
  if (theme === 'pink_vibrant') return { bg: '#1b0b12', card: '#2a0f1b', primary: '#ff2d87', text: '#ffffff', muted: '#e59ab8', input: '#1f1520' };
  if (theme === 'golden_pink') return { bg: '#fff8f0', card: '#ffe9c7', primary: '#dba514', text: '#2a1e22', muted: '#9b7d4e', input: '#fff' };
  return { bg: '#fde7ef', card: '#ffd0e0', primary: '#e91e63', text: '#2a1e22', muted: '#7c5866', input: '#ffffff' };
}

function fmtTime(ts: number, lang: 'de'|'en'|'pl') {
  try { return safeTimeHM(ts, lang); } catch { return ''; }
}
function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

const CUISINES: (Cuisine|'any')[] = ['any','de','pl','it','gr','tr','us'];
const MEALS: (Meal|'any')[] = ['any','breakfast','lunch','dinner'];
const CATS: (Category|'any')[] = ['any','fleisch','lowcarb','abnehmen','vegetarisch','kuchen','suesses'];
const TOPICS = [
  { key: 'cycle', label: { de: 'Zyklus', en: 'Cycle', pl: 'Cykl' } },
  { key: 'weight', label: { de: 'Gewicht', en: 'Weight', pl: 'Waga' } },
  { key: 'sleep', label: { de: 'Schlaf', en: 'Sleep', pl: 'Sen' } },
  { key: 'hydration', label: { de: 'Hydration', en: 'Hydration', pl: 'Nawodnienie' } },
  { key: 'reminders', label: { de: 'Erinnerungen', en: 'Reminders', pl: 'Przypomnienia' } },
] as const;

export default function ChatScreen() {
  const router = useRouter();
  const state = useAppStore();
  const { level } = useLevel();
  const colors = useThemeColors(state.theme);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const [typing, setTyping] = useState(false);
  const [typingText, setTypingText] = useState('');
  const typingAbort = useRef<{abort: boolean}>({ abort: false });

  const [showFilter, setShowFilter] = useState(false);
  const [selCuisine, setSelCuisine] = useState<Cuisine|'any'>('any');
  const [selMeal, setSelMeal] = useState<Meal|'any'>('any');
  const [selCat, setSelCat] = useState<Category|'any'>('any');
  const [kw, setKw] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [showKnowledge, setShowKnowledge] = useState(false);
  const [selTopic, setSelTopic] = useState<typeof TOPICS[number]['key']>('cycle');
  
  // AI Status tracking
  const [aiStatus, setAiStatus] = useState<'cloud' | 'local' | 'checking'>('checking');

  const maxVisible = level >= 50 ? 50 : (level >= 25 ? 30 : 20);
  const allChat = state.chat || [];
  const visibleChat = useMemo(() => allChat.slice(Math.max(0, allChat.length - maxVisible)), [allChat, maxVisible]);

  useEffect(() => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50); }, [visibleChat.length, typingText]);

  async function typeOut(full: string) {
    setTyping(true); setTypingText(''); typingAbort.current.abort = false;
    for (let i = 0; i < full.length; i++) {
      if (typingAbort.current.abort) break;
      setTypingText(prev => prev + full[i]);
      const ch = full[i]; let delay = 25; if (ch==='.'||ch==='!'||ch==='?') delay = 120; else if (ch===','||ch===';'||ch===':') delay = 60; await sleep(delay);
    }
    setTyping(false);
    const finalText = typingAbort.current.abort ? '' : full; setTypingText(finalText); return finalText;
  }

  async function handleGreetingIfNeeded() {
    const now = Date.now(); const last = state.lastChatLeaveAt || 0; const allow = last === 0 || (now - last >= 5 * 60 * 1000);
    if (!allow) return; if (!state.aiInsightsEnabled) return;
    
    // Check AI status first
    const status = await getAIStatus();
    setAiStatus(status);
    
    const reply = await hybridGreeting(state); 
    if (!reply) return; 
    const typed = await typeOut(reply);
    if (typed) { 
      const bot = { id: String(Date.now()), sender: 'bot' as const, text: typed, createdAt: Date.now() }; 
      state.addChat(bot); 
      setTypingText(''); 
    }
  }

  useFocusEffect(React.useCallback(() => { 
    handleGreetingIfNeeded(); 
    // Check AI status on focus
    getAIStatus().then(setAiStatus);
    return () => { 
      useAppStore.getState().setLastChatLeaveAt(Date.now()); 
      typingAbort.current.abort = true; 
    }; 
  }, [state.aiInsightsEnabled, state.language, state.days, state.cycles]));

  async function send() {
    const t = text.trim(); if (!t) return;
    const msg = { id: String(Date.now()), sender: 'user' as const, text: t, createdAt: Date.now() };
    state.addChat(msg); setText(''); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Update AI status before making request
    const status = await getAIStatus();
    setAiStatus(status);
    
    let replyText = '';
    try {
      replyText = await hybridReply(state, t);
    } catch (e) {
      // hard fallback
      replyText = await localReply(state, t);
    }
    typingAbort.current.abort = false; const typed = await typeOut(replyText || '');
    if (typed) { 
      const bot = { id: String(Date.now()+1), sender: 'bot' as const, text: typed, createdAt: Date.now()+1 }; 
      state.addChat(bot); 
      setTypingText(''); 
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80); 
    }
  }

  function saveTip(id: string, text: string) {
    if (saved[id]) return; const title = (text.slice(0, 30) + (text.length > 30 ? '…' : '')) || 'Gugi-Tipp';
    state.addSaved({ id: String(Date.now()), title: `Gugi: ${title}`, category: 'Chat', tags: ['Gugi','Tipp'], text, createdAt: Date.now() }); setSaved((s) => ({ ...s, [id]: true })); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const canSend = text.trim().length > 0; const appTitle = state.language==='en' ? "Scarlett’s Health Tracking" : (state.language==='pl'?'Zdrowie Scarlett':'Scarletts Gesundheitstracking');
  const lbl = (de: string, en: string, pl?: string) => (state.language==='en'?en:(state.language==='pl'?(pl||en):de));

  function runSearch() {
    const res = searchRecipes({ lang: state.language as any, cuisine: selCuisine, meal: selMeal, category: selCat, keywords: kw, limit: 20 }); setResults(res as any);
  }

  function shareResultsToChat() {
    if (!results.length) return; const lang = state.language as 'de'|'en'|'pl';
    const list = results.slice(0,5).map((r:any)=>`• ${r.title[lang]} – ${r.desc[lang]}`).join('\n');
    const text = lbl('Rezepte:', 'Recipes:', 'Przepisy:') + '\n' + list;
    const bot = { id: String(Date.now()), sender: 'bot' as const, text, createdAt: Date.now() }; state.addChat(bot);
    setShowFilter(false); setResults([]);
  }

  function shareKnowledgeToChat() {
    const txt = answerTopic(state, selTopic as any);
    if (!txt) return; const bot = { id: String(Date.now()), sender: 'bot' as const, text: txt, createdAt: Date.now() }; state.addChat(bot); setShowKnowledge(false);
  }

  const detail = detailId ? getRecipeDetail(detailId) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[styles.header, { backgroundColor: colors.card }]}> 
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel={state.language==='de'?'Zurück':'Back'}>
          <Ionicons name='chevron-back' size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.appTitle, { color: colors.text }]}>{appTitle}</Text>
            <View style={{ 
              width: 8, 
              height: 8, 
              borderRadius: 4, 
              marginLeft: 6,
              backgroundColor: aiStatus === 'cloud' ? '#4CAF50' : aiStatus === 'local' ? '#FF9800' : '#9E9E9E'
            }} />
          </View>
          <Text style={[styles.title, { color: colors.muted }]}>
            Gugi {aiStatus === 'cloud' ? '☁️' : aiStatus === 'local' ? '📱' : '⏳'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setShowKnowledge(true)} style={styles.iconBtn} accessibilityLabel='Wissen'>
            <Ionicons name='book-outline' size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowFilter(true)} style={styles.iconBtn} accessibilityLabel='Rezepte filtern'>
            <Ionicons name='filter' size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/saved')} style={styles.iconBtn} accessibilityLabel='Gespeichert'>
            <Ionicons name='bookmark' size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, gap: 8 }} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
            {visibleChat.map((m) => (
              <View key={m.id} style={[styles.msgRow, { justifyContent: m.sender==='user' ? 'flex-end' : 'flex-start' }]}> 
                <View style={{ maxWidth: '82%' }}>
                  <View style={[styles.msgBubble, { backgroundColor: m.sender==='user' ? colors.primary : colors.card, borderColor: colors.muted }]}> 
                    <Text style={{ color: m.sender==='user' ? '#fff' : colors.text }}>{m.text}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: m.sender==='user' ? 'flex-end' : 'flex-start', marginTop: 4 }}>
                    {m.sender==='bot' ? (
                      <TouchableOpacity onPress={() => saveTip(m.id, m.text)} accessibilityLabel='Tipp speichern' style={{ paddingHorizontal: 4, paddingVertical: 2, marginRight: 6 }}>
                        <Ionicons name={saved[m.id] ? 'bookmark' : 'bookmark-outline'} size={14} color={saved[m.id] ? colors.primary : colors.muted} />
                      </TouchableOpacity>
                    ) : null}
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{fmtTime(m.createdAt, state.language)}</Text>
                  </View>
                </View>
              </View>
            ))}

            {typing && typingText ? (
              <View style={[styles.msgRow, { justifyContent: 'flex-start' }]}> 
                <View style={{ maxWidth: '82%' }}>
                  <View style={[styles.msgBubble, { backgroundColor: colors.card, borderColor: colors.muted }]}> 
                    <Text style={{ color: colors.text }}>{typingText}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {visibleChat.length === 0 && !typing ? (
              <Text style={{ color: colors.muted, textAlign: 'center', marginTop: 24 }}>{lbl('Keine Nachrichten','No messages yet','Brak wiadomości')}</Text>
            ) : null}
          </ScrollView>
        </View>

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.muted }]}> 
          <TextInput ref={inputRef} value={text} onChangeText={setText} placeholder={lbl('Schreibe eine Nachricht…','Type a message…','Napisz wiadomość…')} placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, backgroundColor: colors.input, borderColor: colors.muted }]} multiline />
          <TouchableOpacity disabled={!canSend || typing} onPress={send} style={[styles.sendBtn, { backgroundColor: canSend && !typing ? colors.primary : colors.muted }]} accessibilityLabel={lbl('Senden','Send','Wyślij')}>
            <Ionicons name='send' size={18} color={'#fff'} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Knowledge Modal */}
      <Modal visible={showKnowledge} transparent animationType='slide' onRequestClose={() => setShowKnowledge(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.muted }]}> 
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{lbl('Wissen','Knowledge','Wiedza')}</Text>
                <TouchableOpacity onPress={() => setShowKnowledge(false)}>
                  <Ionicons name='close' size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.muted, marginTop: 6 }}>{lbl('Wähle ein Thema und poste es in den Chat.','Pick a topic and post it to the chat.','Wybierz temat i udostępnij na czacie.')}</Text>
              <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 8 }} showsHorizontalScrollIndicator={false}>
                {TOPICS.map(t => (
                  <TouchableOpacity key={t.key} onPress={() => setSelTopic(t.key)} style={[styles.badge, { borderColor: colors.muted, backgroundColor: selTopic===t.key?colors.primary:'transparent' }]}> 
                    <Text style={{ color: selTopic===t.key?'#fff':colors.text }}>{t.label[state.language as 'de'|'en'|'pl']}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <TouchableOpacity onPress={shareKnowledgeToChat} style={[styles.badge, { backgroundColor: colors.primary }]}> 
                  <Text style={{ color: '#fff' }}>{lbl('In Chat teilen','Share to chat','Udostępnij na czacie')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={showFilter} transparent animationType='slide' onRequestClose={() => setShowFilter(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.muted }]}> 
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{lbl('Rezepte filtern','Filter recipes','Filtruj przepisy')}</Text>
                <TouchableOpacity onPress={() => setShowFilter(false)}>
                  <Ionicons name='close' size={20} color={colors.muted} />
                </TouchableOpacity>
              </View>
              <Text style={{ color: colors.muted, marginTop: 6 }}>{lbl('Wähle Küche, Kategorie, Mahlzeit oder nutze Suche.','Choose cuisine, category, meal or use search.','Wybierz kuchnię, kategorię, posiłek lub użyj wyszukiwania.')}</Text>

              <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
                {/* Cuisine */}
                <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 6 }}>{lbl('Küche','Cuisine','Kuchnia')}</Text>
                <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 4 }} showsHorizontalScrollIndicator={false}>
                  {CUISINES.map(c => (
                    <TouchableOpacity key={c} onPress={() => setSelCuisine(c)} style={[styles.badge, { borderColor: colors.muted, backgroundColor: selCuisine===c?colors.primary:'transparent' }]}> 
                      <Text style={{ color: selCuisine===c?'#fff':colors.text }}>{c==='any'?lbl('Alle','Any','Wszystkie'):c.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Category */}
                <Text style={{ color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>{lbl('Kategorie','Category','Kategoria')}</Text>
                <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 4 }} showsHorizontalScrollIndicator={false}>
                  {CATS.map(c => (
                    <TouchableOpacity key={c} onPress={() => setSelCat(c)} style={[styles.badge, { borderColor: colors.muted, backgroundColor: selCat===c?colors.primary:'transparent' }]}> 
                      <Text style={{ color: selCat===c?'#fff':colors.text }}>
                        {c==='any'?lbl('Alle','Any','Wszystkie'):
                         c==='fleisch'?lbl('Fleisch','Meat','Mięso'):
                         c==='lowcarb'?'Low Carb':
                         c==='abnehmen'?lbl('Abnehmen','Weight Loss','Odchudzanie'):
                         c==='vegetarisch'?lbl('Vegetarisch','Vegetarian','Wegetariańskie'):
                         c==='kuchen'?lbl('Kuchen','Cake','Ciasto'):
                         c==='suesses'?lbl('Süßes','Sweet','Słodkie'):c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Meal */}
                <Text style={{ color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>{lbl('Mahlzeit','Meal','Posiłek')}</Text>
                <ScrollView horizontal contentContainerStyle={{ gap: 8, paddingVertical: 4 }} showsHorizontalScrollIndicator={false}>
                  {MEALS.map(m => (
                    <TouchableOpacity key={m} onPress={() => setSelMeal(m)} style={[styles.badge, { borderColor: colors.muted, backgroundColor: selMeal===m?colors.primary:'transparent' }]}> 
                      <Text style={{ color: selMeal===m?'#fff':colors.text }}>
                        {m==='any'?lbl('Alle','Any','Wszystkie'):
                         m==='breakfast'?lbl('Frühstück','Breakfast','Śniadanie'):
                         m==='lunch'?lbl('Mittag','Lunch','Obiad'):
                         m==='dinner'?lbl('Abend','Dinner','Kolacja'):m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Search */}
                <Text style={{ color: colors.text, fontWeight: '600', marginTop: 12, marginBottom: 6 }}>{lbl('Suche','Search','Szukaj')}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={kw}
                    onChangeText={setKw}
                    placeholder={lbl('Stichwort...','Keyword...','Słowo kluczowe...')}
                    placeholderTextColor={colors.muted}
                    style={{ flex: 1, borderWidth: 1, borderColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: colors.text, backgroundColor: colors.input }}
                  />
                  <TouchableOpacity onPress={runSearch} style={[styles.badge, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: '#fff' }}>{lbl('Suchen','Search','Szukaj')}</Text>
                  </TouchableOpacity>
                </View>

                {/* Results */}
                {results.length > 0 && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <Text style={{ color: colors.text, fontWeight: '600' }}>{results.length} {lbl('Ergebnisse','Results','Wyniki')}</Text>
                      <TouchableOpacity onPress={shareResultsToChat} style={[styles.badge, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: '#fff' }}>{lbl('In Chat teilen','Share to chat','Udostępnij na czacie')}</Text>
                      </TouchableOpacity>
                    </View>
                    {results.slice(0, 8).map((r: any) => (
                      <TouchableOpacity key={r.id} onPress={() => setDetailId(r.id)} style={[styles.card, { backgroundColor: colors.card, marginTop: 8 }]}>
                        <Text style={{ color: colors.text, fontWeight: '600' }}>{r.title[state.language]}</Text>
                        <Text style={{ color: colors.muted, marginTop: 4 }}>{r.desc[state.language]}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal visible={!!detailId} transparent animationType='slide' onRequestClose={() => setDetailId(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
            {detail && (
              <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.muted, maxHeight: '80%' }]}> 
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{detail.title[state.language as 'de'|'en'|'pl']}</Text>
                  <TouchableOpacity onPress={() => setDetailId(null)}>
                    <Ionicons name='close' size={20} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{detail.desc[state.language as 'de'|'en'|'pl']}</Text>
                
                <ScrollView contentContainerStyle={{ paddingVertical: 8 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', marginTop: 8 }}>{lbl('Zutaten','Ingredients','Składniki')}</Text>
                  {detail.ingredients[state.language as 'de'|'en'|'pl'].map((ing, idx) => (
                    <Text key={idx} style={{ color: colors.text, marginTop: 4 }}>• {ing}</Text>
                  ))}
                  
                  <Text style={{ color: colors.text, fontWeight: '600', marginTop: 16 }}>{lbl('Zubereitung','Instructions','Przygotowanie')}</Text>
                  {detail.steps[state.language as 'de'|'en'|'pl'].map((step, idx) => (
                    <Text key={idx} style={{ color: colors.text, marginTop: 6 }}>{idx + 1}. {step}</Text>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <TouchableOpacity 
                    onPress={() => {
                      const recipeText = `${detail.title[state.language as 'de'|'en'|'pl']}\n\n${lbl('Zutaten:','Ingredients:','Składniki:')}\n${detail.ingredients[state.language as 'de'|'en'|'pl'].map(i => `• ${i}`).join('\n')}\n\n${lbl('Zubereitung:','Instructions:','Przygotowanie:')}\n${detail.steps[state.language as 'de'|'en'|'pl'].map((s, i) => `${i+1}. ${s}`).join('\n')}`;
                      const bot = { id: String(Date.now()), sender: 'bot' as const, text: recipeText, createdAt: Date.now() };
                      state.addChat(bot);
                      setDetailId(null);
                    }}
                    style={[styles.badge, { backgroundColor: colors.primary }]}
                  >
                    <Text style={{ color: '#fff' }}>{lbl('In Chat teilen','Share to chat','Udostępnij na czacie')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appTitle: { fontSize: 14, fontWeight: '800' },
  title: { fontSize: 12, fontWeight: '600' },
  iconBtn: { padding: 8 },
  msgRow: { flexDirection: 'row' },
  msgBubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 0 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1 },
  input: { flex: 1, minHeight: 40, maxHeight: 120, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8 },
  sendBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, borderTopWidth: 1 },
  badge: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  card: { borderRadius: 12, padding: 12 },
});
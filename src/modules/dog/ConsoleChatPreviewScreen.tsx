import { useEffect, useRef, useState, type ElementRef } from 'react';
import {
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Footprints, Hand, House } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const shell = require('./assets/console-preview/console-shell.png');
const dubu = require('./assets/console-preview/dubu-pixel.png');
const dubuFeedFrames = [
  require('./assets/console-preview/feed/01.png'),
  require('./assets/console-preview/feed/02.png'),
  require('./assets/console-preview/feed/03.png'),
  require('./assets/console-preview/feed/04.png'),
  require('./assets/console-preview/feed/05.png'),
  require('./assets/console-preview/feed/06.png'),
  require('./assets/console-preview/feed/07.png'),
  require('./assets/console-preview/feed/08.png'),
  require('./assets/console-preview/feed/09.png'),
] as const;
const dubuWalkFrames = [
  require('./assets/console-preview/walk/01.png'),
  require('./assets/console-preview/walk/02.png'),
  require('./assets/console-preview/walk/03.png'),
  require('./assets/console-preview/walk/04.png'),
  require('./assets/console-preview/walk/05.png'),
  require('./assets/console-preview/walk/06.png'),
  require('./assets/console-preview/walk/07.png'),
] as const;

const topics = [
  {
    label: '산책',
    question: '산책할 때는 뭘 좋아해?',
    answer: '나는 냄새 맡으며 걷는 게 좋아!\n가끔 멈춰서 풀숲도 살펴봐.\n너도 느긋한 산책을 좋아해?',
  },
  {
    label: '혼자',
    chatLabel: '혼자 있을 때',
    question: '혼자 있을 때는 어떻게 지내?',
    answer: '익숙한 자리에서 쉬는 걸 좋아해.\n새로운 곳에서는 적응할 시간이 필요해.\n천천히 익숙해지도록 도와줄래?',
  },
  {
    label: '첫 만남',
    question: '처음 만나면 어떻게 인사할까?',
    answer: '처음엔 조금 떨어져서 기다려 줘.\n내가 다가가 냄새 맡을 시간을 주면 좋아.\n우리 천천히 친해지자!',
  },
] as const;

type Message = { role: 'dog' | 'me'; text: string; topic: number | null };

export function ConsoleChatPreviewScreen() {
  const insets = useSafeAreaInsets();
  const messageListRef = useRef<ElementRef<typeof ScrollView>>(null);
  const messageRows = useRef<Record<number, { y: number; height: number }>>({});
  const messageContentHeight = useRef(0);
  const messageViewportHeight = useRef(0);
  const pendingMessageScroll = useRef<{ type: 'topic'; index: number } | { type: 'end'; count: number } | null>(null);
  const [messageViewport, setMessageViewport] = useState(0);
  const { width, height } = useWindowDimensions();
  const consoleWidth = Math.min(width * 0.87, (height - 135) * (510 / 1046));
  const consoleHeight = consoleWidth * (1046 / 510);
  const [topic, setTopic] = useState(0);
  const [view, setView] = useState<'device' | 'chat' | 'home'>('device');
  const [saved, setSaved] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [feeding, setFeeding] = useState(false);
  const [feedFrame, setFeedFrame] = useState(0);
  const [walkFrame, setWalkFrame] = useState<number | null>(null);
  const [feedingMessage, setFeedingMessage] = useState('오늘은 무슨 이야기를 할까?');
  const [draft, setDraft] = useState('');
  const dogX = useRef(new Animated.Value(0)).current;
  const dogY = useRef(new Animated.Value(0)).current;
  const dogScale = useRef(new Animated.Value(1)).current;
  const treatY = useRef(new Animated.Value(0)).current;
  const treatOpacity = useRef(new Animated.Value(0)).current;
  const treatRotate = useRef(new Animated.Value(0)).current;
  const saveNoticeOpacity = useRef(new Animated.Value(0)).current;
  const saveNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveNoticeRun = useRef(0);
  const feedingRun = useRef(0);
  const feedingInProgress = useRef(false);
  const activeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'dog', text: '안녕! 나는 두부야.\n천천히 다가와 주면 더 편안해.', topic: null },
  ]);

  function scrollToPendingMessage() {
    const pending = pendingMessageScroll.current;
    if (!pending || !messageListRef.current || !messageViewportHeight.current) return;
    if (pending.type === 'end') {
      if (messages.length < pending.count) return;
      const last = messageRows.current[pending.count - 1];
      const bottomSpace = Math.max(16, messageViewportHeight.current / 2);
      if (!last || messageContentHeight.current < last.y + last.height + bottomSpace - 1) return;
      messageListRef.current.scrollToEnd({ animated: true });
      pendingMessageScroll.current = null;
      return;
    }
    const indices = messages.flatMap((message, index) => message.topic === pending.index ? [index] : []);
    if (!indices.length) return;
    const first = messageRows.current[indices[Math.max(0, indices.length - 2)]];
    const last = messageRows.current[indices[indices.length - 1]];
    const bottomSpace = Math.max(16, messageViewportHeight.current / 2);
    if (!first || !last || messageContentHeight.current < last.y + last.height + bottomSpace - 1) return;
    const middle = (first.y + last.y + last.height) / 2;
    const maxScroll = Math.max(0, messageContentHeight.current - messageViewportHeight.current);
    messageListRef.current.scrollTo({
      y: Math.max(0, Math.min(middle - messageViewportHeight.current / 2, maxScroll)),
      animated: true,
    });
    pendingMessageScroll.current = null;
  }

  useEffect(() => () => {
    feedingRun.current += 1;
    feedingInProgress.current = false;
    activeAnimation.current?.stop();
    if (saveNoticeTimer.current) clearTimeout(saveNoticeTimer.current);
    saveNoticeOpacity.stopAnimation();
  }, [saveNoticeOpacity]);

  function dismissSaveNotice() {
    saveNoticeRun.current += 1;
    if (saveNoticeTimer.current) clearTimeout(saveNoticeTimer.current);
    saveNoticeTimer.current = null;
    saveNoticeOpacity.stopAnimation();
    setSaveNotice(null);
  }

  function toggleSaved() {
    const nextSaved = !saved;
    const run = ++saveNoticeRun.current;
    if (saveNoticeTimer.current) clearTimeout(saveNoticeTimer.current);
    saveNoticeOpacity.stopAnimation();
    saveNoticeOpacity.setValue(0);
    setSaved(nextSaved);
    setSaveNotice(nextSaved ? '저장되었어요' : '저장을 취소했어요');
    Animated.timing(saveNoticeOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    saveNoticeTimer.current = setTimeout(() => {
      Animated.timing(saveNoticeOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && saveNoticeRun.current === run) setSaveNotice(null);
      });
      saveNoticeTimer.current = null;
    }, 1600);
  }

  function animate(animation: Animated.CompositeAnimation) {
    activeAnimation.current = animation;
    return new Promise<boolean>(resolve => {
      animation.start(({ finished }) => resolve(finished));
    });
  }

  function stopFeeding() {
    feedingRun.current += 1;
    feedingInProgress.current = false;
    activeAnimation.current?.stop();
    dogX.setValue(0);
    dogY.setValue(0);
    dogScale.setValue(1);
    treatY.setValue(0);
    treatOpacity.setValue(0);
    treatRotate.setValue(0);
    setFeeding(false);
    setFeedFrame(0);
    setWalkFrame(null);
    setFeedingMessage('오늘은 무슨 이야기를 할까?');
  }

  async function giveTreat() {
    if (feedingInProgress.current) return;
    feedingInProgress.current = true;
    const run = ++feedingRun.current;
    const current = () => run === feedingRun.current;
    const timing = (value: Animated.Value, toValue: number, duration: number, easing = Easing.inOut(Easing.quad)) =>
      Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });
    const walkPath = async (returning: boolean) => {
      for (let step = 0; step < 6; step += 1) {
        const progress = returning ? (5 - step) / 6 : (step + 1) / 6;
        setWalkFrame(returning ? 5 - step : step + 1);
        if (!await animate(Animated.parallel([
          timing(dogX, consoleWidth * 0.045 * progress, 105, Easing.linear),
          timing(dogY, consoleHeight * 0.245 * progress, 105, Easing.linear),
          timing(dogScale, 1 + 0.08 * progress, 105, Easing.linear),
        ])) || !current()) return false;
      }
      return true;
    };

    dogX.setValue(0);
    dogY.setValue(0);
    dogScale.setValue(1);
    treatY.setValue(0);
    treatOpacity.setValue(1);
    treatRotate.setValue(-0.12);
    setFeeding(true);
    setFeedFrame(1);
    setWalkFrame(null);
    setFeedingMessage('앗, 간식이 떨어진다!');

    // The snack falls past the LCD and lands on the console shell.
    if (!await animate(Animated.parallel([
      timing(treatY, consoleHeight * 0.54, 760, Easing.in(Easing.cubic)),
      timing(treatRotate, 0.12, 760, Easing.linear),
      Animated.sequence([
        timing(dogY, -9, 240, Easing.out(Easing.quad)),
        timing(dogY, 0, 300, Easing.in(Easing.quad)),
      ]),
    ])) || !current()) return;

    if (!await animate(Animated.sequence([
      timing(treatY, consoleHeight * 0.515, 120, Easing.out(Easing.quad)),
      timing(treatY, consoleHeight * 0.54, 150, Easing.in(Easing.quad)),
    ])) || !current()) return;

    setFeedingMessage('기다려, 내가 갈게!');
    setWalkFrame(0);
    if (!await walkPath(false)) return;
    setWalkFrame(null);
    setFeedFrame(3);

    setFeedingMessage('냠냠! 맛있다!');
    if (!await animate(Animated.parallel([
      timing(treatY, consoleHeight * 0.45, 230, Easing.out(Easing.quad)),
      timing(dogY, consoleHeight * 0.265, 230),
    ])) || !current()) return;

    setFeedFrame(4);
    if (!await animate(timing(treatY, consoleHeight * 0.432, 120, Easing.out(Easing.quad))) || !current()) return;
    setFeedFrame(5);
    if (!await animate(Animated.parallel([
      timing(treatOpacity, 0, 180, Easing.in(Easing.quad)),
      timing(dogY, consoleHeight * 0.245, 180),
    ])) || !current()) return;
    setFeedFrame(6);
    if (!await animate(Animated.delay(150)) || !current()) return;
    setFeedFrame(5);
    if (!await animate(Animated.delay(150)) || !current()) return;
    setFeedFrame(6);
    if (!await animate(Animated.delay(150)) || !current()) return;

    setFeedingMessage('고마워! 또 놀자.');
    setFeedFrame(7);
    if (!await animate(Animated.delay(120)) || !current()) return;
    setWalkFrame(0);
    if (!await walkPath(true)) return;
    setWalkFrame(null);
    setFeedFrame(8);

    await animate(Animated.delay(650));
    if (!current()) return;
    feedingInProgress.current = false;
    setFeeding(false);
    setFeedFrame(0);
    setWalkFrame(null);
    setFeedingMessage('오늘은 무슨 이야기를 할까?');
  }

  function hasTopicConversation(index: number) {
    return messages.some(message => message.topic === index && message.role === 'me' && message.text === topics[index].question);
  }

  function openChat(index = topic) {
    if (feedingInProgress.current) return;
    dismissSaveNotice();
    addTopicMessages(index);
    setView('chat');
  }

  function addTopicMessages(index: number) {
    const selected = topics[index];
    setTopic(index);
    pendingMessageScroll.current = { type: 'topic', index };
    setMessages(previous => previous.some(message => message.topic === index && message.role === 'me' && message.text === selected.question)
      ? previous
      : [
          ...previous,
          { role: 'me', text: selected.question, topic: index },
          { role: 'dog', text: selected.answer, topic: index },
        ]);
    requestAnimationFrame(scrollToPendingMessage);
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;
    pendingMessageScroll.current = { type: 'end', count: messages.length + 2 };
    setMessages(previous => [
      ...previous,
      { role: 'me', text, topic },
      { role: 'dog', text: '그 이야기도 궁금하구나! 우리 천천히 알아가자.', topic },
    ]);
    setDraft('');
  }

  if (view === 'home') {
    return (
      <View style={styles.home}>
        <StatusBar hidden />
        <Text style={styles.homeBrand}>PUPPY CONNECT ♡</Text>
        <Text style={styles.homeTitle}>좋은 만남은{ '\n' }서로를 알아가는 것부터.</Text>
        <Pressable style={styles.homeButton} onPress={() => setView('device')}>
          <Text style={styles.homeButtonText}>두부 만나러 가기 →</Text>
        </Pressable>
        <Text style={styles.savedHeading}>저장한 친구 {saved ? '1' : '0'}</Text>
        {saved && (
          <Pressable style={styles.savedCard} onPress={() => setView('device')}>
            <Image source={dubu} style={styles.savedDog} resizeMode="contain" />
            <Text style={styles.savedName}>두부 ♥</Text>
          </Pressable>
        )}
      </View>
    );
  }

  if (view === 'chat') {
    return (
      <View
        style={[
          styles.chatScreen,
          {
            paddingTop: Math.max(insets.top + 12, 58),
            paddingBottom: Math.max(insets.bottom + 24, 52),
          },
        ]}>
        <StatusBar hidden />
        <KeyboardAvoidingView
          style={styles.chatKeyboardArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.chatWindow}>
          <View style={styles.chatTitleBar}>
            <Text style={styles.chatTitle}>✻ 두부와 대화</Text>
            <Pressable accessibilityLabel="대화창 닫기" onPress={() => setView('device')} style={styles.chatClose}>
              <Text style={styles.chatCloseText}>×</Text>
            </Pressable>
          </View>
          <View style={styles.chatContact}>
            <Image source={dubu} style={styles.chatAvatar} />
            <View style={styles.chatContactInfo}>
              <Text style={styles.chatContactName}>두부</Text>
              <Text style={styles.chatContactSub}>온기 보호소 · AI 친구</Text>
            </View>
            <Text style={styles.chatOnline}>대화 중</Text>
          </View>
          <View style={styles.chatTopics}>
            {topics.map((item, index) => (
              <Pressable
                key={item.label}
                style={[styles.chatTopic, topic === index && styles.chatTopicSelected]}
                onPress={() => addTopicMessages(index)}>
                <Text style={styles.chatTopicText}>{'chatLabel' in item ? item.chatLabel : item.label}</Text>
              </Pressable>
            ))}
          </View>
          <ScrollView
            ref={messageListRef}
            style={styles.messageList}
            contentContainerStyle={[styles.messageContent, { paddingBottom: Math.max(16, messageViewport / 2) }]}
            onLayout={event => {
              const viewport = event.nativeEvent.layout.height;
              messageViewportHeight.current = viewport;
              setMessageViewport(viewport);
              scrollToPendingMessage();
            }}
            onContentSizeChange={(_, contentHeight) => {
              messageContentHeight.current = contentHeight;
              scrollToPendingMessage();
            }}
            onScrollBeginDrag={() => { pendingMessageScroll.current = null; }}>
            <Text style={styles.chatDate}>오늘의 이야기</Text>
            {messages.map((message, index) => (
              <View
                key={index}
                onLayout={event => {
                  messageRows.current[index] = event.nativeEvent.layout;
                  scrollToPendingMessage();
                }}
                style={[styles.messageRow, message.role === 'me' && styles.messageMine]}>
                <View style={[styles.messageAvatar, message.role === 'me' && styles.messageAvatarMine]}>
                  {message.role === 'dog'
                    ? <Image source={dubu} style={styles.messageAvatarImage} resizeMode="contain" />
                    : <Text style={styles.messageHeart}>♡</Text>}
                </View>
                <View style={[styles.messageBody, message.role === 'dog' && styles.messageBodyDog, message.role === 'me' && styles.messageBodyMine]}>
                  <Text style={[styles.messageAuthor, message.role === 'me' && styles.messageAuthorMine]}>
                    {message.role === 'dog' ? '두부' : '나'}
                  </Text>
                  <Text style={[styles.bubble, message.role === 'dog' && styles.bubbleDog, message.role === 'me' && styles.bubbleMine]}>{message.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="두부에게 궁금한 걸 물어봐"
              placeholderTextColor="#95899a"
              style={styles.composerInput}
              multiline
              submitBehavior="submit"
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <Pressable style={styles.sendButton} onPress={sendMessage}>
              <Text style={styles.sendText}>보내기</Text>
              <Text style={styles.sendArrow}>↗</Text>
            </Pressable>
          </View>
          <View style={styles.chatFooter}>
            <Text style={styles.chatFooterText}>♡ 서두르지 않아도 괜찮아</Text>
            <Text style={styles.chatFooterText}>예시 대화</Text>
          </View>
        </View>
        </KeyboardAvoidingView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={[styles.console, { width: consoleWidth, height: consoleHeight }]}>
        <Image source={shell} resizeMode="stretch" style={[styles.shellImage, { width: consoleWidth, height: consoleHeight }]} />
        <View style={styles.brandPlate}>
          <Text style={styles.brand} numberOfLines={1} adjustsFontSizeToFit allowFontScaling={false}>
            PUPPY CONNECT ♡
          </Text>
        </View>

        <View style={[styles.lcd, feeding && styles.lcdFeeding]}>
          <View style={styles.lcdHeader}>
            <View>
              <Text style={styles.dogName}>두부</Text>
              <Text style={styles.shelterName}>온기 보호소의 친구</Text>
            </View>
            <Pressable accessibilityLabel={saved ? '저장 취소' : '두부 저장'} onPress={toggleSaved}>
              <Text style={[styles.heart, saved && styles.heartSaved]}>{saved ? '♥' : '♡'}</Text>
            </Pressable>
          </View>
          <View style={[styles.garden, feeding && styles.gardenFeeding]}>
            <View style={[styles.cloud, styles.cloudLeft]} />
            <View style={[styles.cloud, styles.cloudRight]} />
            <View style={styles.grass} />
            <View style={styles.flowerLeft} />
            <View style={styles.flowerRight} />
            <View style={styles.speech}>
              <Text style={styles.speechText}>{feedingMessage}</Text>
            </View>
            <Animated.View style={[
              styles.dogShadow,
              { opacity: dogY.interpolate({
                inputRange: [0, consoleHeight * 0.1],
                outputRange: [1, 0],
                extrapolate: 'clamp',
              }) },
            ]} />
            <Animated.View
              pointerEvents="none"
              style={[styles.dogImage, { transform: [{ translateX: dogX }, { translateY: dogY }, { scale: dogScale }] }]}>
              <Image source={feeding ? (walkFrame === null ? dubuFeedFrames[feedFrame] : dubuWalkFrames[walkFrame]) : dubu} style={styles.animatedDogImage} resizeMode="contain" />
            </Animated.View>
          </View>
          <View style={styles.topicArea}>
            <Text style={styles.topicHeading}>나에 대해 궁금한 이야기</Text>
            <View style={styles.topicRow}>
              {topics.map((item, index) => (
                <Pressable
                  key={item.label}
                  style={[styles.topicButton, topic === index && styles.topicSelected]}
                accessibilityHint={hasTopicConversation(index) ? '이전에 나눈 대화 열기' : 'A 버튼으로 대화 시작'}
                onPress={() => hasTopicConversation(index) ? openChat(index) : setTopic(index)}>
                  {index === 0 ? <Footprints size={19} color="#806695" /> :
                    index === 1 ? <House size={19} color="#806695" /> :
                      <Hand size={19} color="#806695" />}
                  <Text style={styles.topicLabel}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.topicHint}>Ⓐ {topics[topic].label} {hasTopicConversation(topic) ? '다시 보기' : '이야기'} · Ⓑ 간식 주기</Text>
          </View>
        </View>

        {feeding && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.treat,
              {
                opacity: treatOpacity,
                transform: [
                  { translateY: treatY },
                  { rotate: treatRotate.interpolate({ inputRange: [-1, 1], outputRange: ['-90deg', '90deg'] }) },
                ],
              },
            ]}>
            <View style={styles.treatCenter} />
            <View style={styles.treatLeftTop} />
            <View style={styles.treatLeftBottom} />
            <View style={styles.treatRightTop} />
            <View style={styles.treatRightBottom} />
            <View style={styles.treatHighlight} />
          </Animated.View>
        )}

        <Pressable style={styles.upHit} onPress={() => setTopic((topic + 2) % 3)} />
        <Pressable style={styles.leftHit} onPress={() => setTopic((topic + 2) % 3)} />
        <Pressable style={styles.rightHit} onPress={() => setTopic((topic + 1) % 3)} />
        <Pressable style={styles.downHit} onPress={() => setTopic((topic + 1) % 3)} />
        <Pressable style={styles.aHit} onPress={() => openChat()} />
        <Pressable accessibilityLabel="두부에게 간식 주기" style={styles.bHit} onPress={giveTreat} />
        <Pressable style={styles.startHit} onPress={() => openChat()} />
      </View>
      <Pressable
        accessibilityLabel="뒤로가기"
        style={[styles.back, { top: Math.max(20, (height - consoleHeight) / 2 - 52) }]}
        onPress={() => { dismissSaveNotice(); stopFeeding(); setView('home'); }}>
        <Text style={styles.backText}>←</Text>
      </Pressable>
      {saveNotice && (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[
            styles.saveNotice,
            {
              left: (width - 184) / 2,
              top: Math.max(20, (height - consoleHeight) / 2 - 26),
              opacity: saveNoticeOpacity,
              transform: [{ translateY: saveNoticeOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [-7, 0],
              }) }],
            },
          ]}>
          <Text style={styles.saveNoticeText}>{saved ? '♥ ' : '♡ '}{saveNotice}</Text>
          <View style={styles.saveNoticeTail} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b7e3f0' },
  console: { alignSelf: 'center' },
  shellImage: { position: 'absolute', left: 0, top: 0 },
  brandPlate: { position: 'absolute', top: '3.3%', left: '27.5%', width: '47.1%', height: '4.2%', alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: 'Galmuri11', width: '100%', textAlign: 'center', color: '#7671af', fontSize: 12, lineHeight: 18, letterSpacing: 0.4 },
  back: { position: 'absolute', left: 18, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: '#edf8fae8', borderWidth: 2, borderColor: '#9ba7cc' },
  backText: { color: '#666391', fontSize: 25, marginTop: -3 },
  saveNotice: { position: 'absolute', zIndex: 10, width: 184, minHeight: 40, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fffaf0', borderWidth: 2, borderColor: '#8f80b7', borderRadius: 8, shadowColor: '#58507d', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 1, height: 3 } },
  saveNoticeText: { fontFamily: 'Galmuri11', color: '#6e5d91', fontSize: 12, textAlign: 'center' },
  saveNoticeTail: { position: 'absolute', bottom: -7, width: 11, height: 11, backgroundColor: '#fffaf0', borderRightWidth: 2, borderBottomWidth: 2, borderColor: '#8f80b7', transform: [{ rotate: '45deg' }] },
  lcd: { position: 'absolute', left: '14.2%', top: '12.43%', width: '71.7%', height: '57.5%', backgroundColor: '#cde9e5', overflow: 'hidden', borderRadius: 5 },
  lcdFeeding: { overflow: 'visible' },
  lcdHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 12 },
  dogName: { fontFamily: 'Galmuri11', fontSize: 22, color: '#5b6378' },
  shelterName: { fontFamily: 'Galmuri11', color: '#667b7b', fontSize: 11, marginTop: 2 },
  heart: { fontFamily: 'Galmuri11', color: '#a380b1', fontSize: 33 },
  heartSaved: { color: '#df78a3' },
  garden: { flex: 1, backgroundColor: '#cde9e5' },
  gardenFeeding: { zIndex: 5 },
  cloud: { position: 'absolute', width: 43, height: 11, backgroundColor: '#f6f8e7', opacity: 0.85 },
  cloudLeft: { left: '7%', top: '35%' },
  cloudRight: { right: '6%', top: '48%', width: 30 },
  grass: { position: 'absolute', bottom: 0, width: '100%', height: '27%', backgroundColor: '#dce8c1', borderTopWidth: 4, borderTopColor: '#b9cd9e' },
  flowerLeft: { position: 'absolute', bottom: '12%', left: '8%', width: 7, height: 7, backgroundColor: '#fff6cb', transform: [{ rotate: '45deg' }] },
  flowerRight: { position: 'absolute', bottom: '7%', right: '10%', width: 6, height: 6, backgroundColor: '#e8d1e5', transform: [{ rotate: '45deg' }] },
  speech: { position: 'absolute', top: 13, alignSelf: 'center', backgroundColor: '#fffcf5', borderColor: '#b4c8bc', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, zIndex: 2 },
  speechText: { fontFamily: 'Galmuri11', color: '#647365', fontSize: 11 },
  dogShadow: { position: 'absolute', bottom: '7%', left: '30%', width: '40%', height: 10, borderRadius: 30, backgroundColor: '#aec48e75' },
  dogImage: { position: 'absolute', width: '62%', height: '64%', left: '19%', bottom: '5%' },
  animatedDogImage: { width: '100%', height: '100%' },
  treat: { position: 'absolute', left: '53%', top: '18%', width: 38, height: 27, zIndex: 8 },
  treatCenter: { position: 'absolute', left: 7, top: 9, width: 24, height: 11, borderWidth: 3, borderColor: '#684631', backgroundColor: '#d99c61' },
  treatLeftTop: { position: 'absolute', left: 1, top: 3, width: 12, height: 11, borderWidth: 3, borderColor: '#684631', backgroundColor: '#e6b878' },
  treatLeftBottom: { position: 'absolute', left: 1, top: 14, width: 12, height: 11, borderWidth: 3, borderColor: '#684631', backgroundColor: '#e6b878' },
  treatRightTop: { position: 'absolute', right: 1, top: 3, width: 12, height: 11, borderWidth: 3, borderColor: '#684631', backgroundColor: '#e6b878' },
  treatRightBottom: { position: 'absolute', right: 1, top: 14, width: 12, height: 11, borderWidth: 3, borderColor: '#684631', backgroundColor: '#e6b878' },
  treatHighlight: { position: 'absolute', left: 15, top: 11, width: 4, height: 3, backgroundColor: '#fff0b8' },
  topicArea: { backgroundColor: '#f8f8e8', borderTopColor: '#aabb92', borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  topicHeading: { fontFamily: 'Galmuri11', textAlign: 'center', color: '#737c6b', fontSize: 11, marginBottom: 9 },
  topicRow: { flexDirection: 'row', gap: 6 },
  topicButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 59, gap: 2, backgroundColor: '#fffdf5', borderColor: '#c9c5cd', borderWidth: 1, borderRadius: 7 },
  topicSelected: { backgroundColor: '#e6d8f2', borderColor: '#a995c2' },
  topicLabel: { fontFamily: 'Galmuri11', color: '#675d7d', fontSize: 11 },
  topicHint: { fontFamily: 'Galmuri11', textAlign: 'center', color: '#798071', fontSize: 10, marginTop: 8 },
  upHit: { position: 'absolute', left: '12.9%', top: '78.6%', width: '11.3%', height: '5.5%' },
  leftHit: { position: 'absolute', left: '5.3%', top: '84.1%', width: '11.3%', height: '5.5%' },
  rightHit: { position: 'absolute', left: '27.9%', top: '84.1%', width: '11.3%', height: '5.5%' },
  downHit: { position: 'absolute', left: '12.9%', top: '89.6%', width: '11.3%', height: '5.5%' },
  aHit: { position: 'absolute', left: '73.4%', top: '78.6%', width: '17.5%', height: '8.8%', borderRadius: 50 },
  bHit: { position: 'absolute', left: '58.9%', top: '84.6%', width: '17.3%', height: '8.7%', borderRadius: 50 },
  startHit: { position: 'absolute', left: '51.8%', top: '92.9%', width: '18%', height: '6.5%' },
  chatScreen: { flex: 1, backgroundColor: '#dbe7f0', paddingHorizontal: 12 },
  chatKeyboardArea: { flex: 1 },
  chatWindow: { flex: 1, backgroundColor: '#eee2f0', borderWidth: 3, borderColor: '#807395', borderRadius: 4, padding: 4, shadowColor: '#615579', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 3, height: 5 } },
  chatTitleBar: { backgroundColor: '#897db9', minHeight: 51, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 4 },
  chatTitle: { fontFamily: 'Galmuri11', color: '#fff9ef', fontSize: 17 },
  chatClose: { width: 42, height: 41, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d8c7e5', backgroundColor: '#e7daed' },
  chatCloseText: { color: '#6a658d', fontSize: 26, lineHeight: 30 },
  chatContact: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 67, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#f8eef5', borderBottomWidth: 1, borderBottomColor: '#d5c1dc' },
  chatAvatar: { width: 40, height: 40, backgroundColor: '#e6eed6', borderWidth: 1, borderColor: '#b6a9c7', borderRadius: 3 },
  chatContactInfo: { flex: 1 },
  chatContactName: { fontFamily: 'Galmuri11', color: '#5f5778', fontSize: 18 },
  chatContactSub: { fontFamily: 'Galmuri11', color: '#91839d', fontSize: 12, marginTop: 2 },
  chatOnline: { fontFamily: 'Galmuri11', color: '#84748d', backgroundColor: '#f8edf4', borderWidth: 1, borderColor: '#d4bed8', paddingHorizontal: 6, paddingVertical: 4, fontSize: 10 },
  chatTopics: { flexDirection: 'row', gap: 5, paddingHorizontal: 5, paddingVertical: 8, backgroundColor: '#f8eef5' },
  chatTopic: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 39, backgroundColor: '#f9f3f8', borderWidth: 1, borderColor: '#c3b4d1', borderRadius: 4 },
  chatTopicSelected: { backgroundColor: '#e4d5f0', borderColor: '#a58dbb' },
  chatTopicText: { fontFamily: 'Galmuri11', color: '#6d5b80', fontSize: 12 },
  messageList: { flex: 1, marginHorizontal: 2, marginBottom: 6, backgroundColor: '#fffdf8', borderColor: '#a99abb', borderWidth: 1 },
  messageContent: { paddingHorizontal: 10, paddingTop: 14, paddingBottom: 16, gap: 17 },
  chatDate: { fontFamily: 'Galmuri11', textAlign: 'center', color: '#a192a6', fontSize: 11, marginBottom: 1 },
  messageRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  messageMine: { flexDirection: 'row-reverse' },
  messageAvatar: { width: 29, height: 29, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#b8aed0', backgroundColor: '#e3edf2', borderRadius: 3, overflow: 'hidden' },
  messageAvatarMine: { backgroundColor: '#f0ddea', borderColor: '#d6b5cb' },
  messageAvatarImage: { width: 27, height: 27 },
  messageHeart: { color: '#b4769f', fontSize: 23, lineHeight: 27 },
  messageBody: { maxWidth: '84%', flexShrink: 1, alignItems: 'flex-start' },
  messageBodyDog: { width: '76%' },
  messageBodyMine: { alignItems: 'flex-end' },
  messageAuthor: { fontFamily: 'Galmuri11', color: '#68799f', fontSize: 11, marginBottom: 5 },
  messageAuthorMine: { color: '#a37997', textAlign: 'right' },
  bubble: { fontFamily: 'GowunDodum-Regular', alignSelf: 'flex-start', backgroundColor: '#e7eff6', borderColor: '#a9bcd0', borderWidth: 1, borderTopLeftRadius: 2, borderTopRightRadius: 8, borderBottomRightRadius: 8, borderBottomLeftRadius: 8, paddingHorizontal: 11, paddingVertical: 9, color: '#525f73', fontSize: 15, lineHeight: 24, overflow: 'hidden' },
  bubbleDog: { alignSelf: 'stretch' },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: '#f2e1ee', borderColor: '#cfacc8', borderTopLeftRadius: 8, borderTopRightRadius: 2, color: '#805b78' },
  composer: { flexDirection: 'row', gap: 6, minHeight: 82, padding: 2 },
  composerInput: { fontFamily: 'GowunDodum-Regular', flex: 1, minWidth: 0, minHeight: 78, backgroundColor: '#fffbfc', borderWidth: 1, borderColor: '#ab96b5', paddingHorizontal: 10, paddingTop: 10, fontSize: 16, color: '#685573', textAlignVertical: 'top' },
  sendButton: { width: 67, backgroundColor: '#dfcfea', borderWidth: 1, borderColor: '#977da9', alignItems: 'center', justifyContent: 'center', gap: 3 },
  sendText: { fontFamily: 'Galmuri11', fontSize: 12, color: '#6c5483' },
  sendArrow: { color: '#6c5483', fontSize: 25, lineHeight: 28 },
  chatFooter: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5, paddingTop: 8, paddingBottom: 4 },
  chatFooterText: { fontFamily: 'Galmuri11', color: '#907d9c', fontSize: 10 },
  home: { flex: 1, backgroundColor: '#fff8e9', padding: 35 },
  homeBrand: { fontFamily: 'Galmuri11', color: '#694f79', fontSize: 19, marginTop: 35 },
  homeTitle: { fontFamily: 'Galmuri11', color: '#694f79', fontSize: 26, lineHeight: 39, marginTop: 100, marginBottom: 35 },
  homeButton: { backgroundColor: '#dfcfeb', borderColor: '#a38bad', borderWidth: 1, padding: 17, borderRadius: 6 },
  homeButtonText: { fontFamily: 'Galmuri11', color: '#604e7b', fontSize: 16 },
  savedHeading: { fontFamily: 'Galmuri11', color: '#694f79', fontSize: 19, marginTop: 65 },
  savedCard: { backgroundColor: '#fffdf8', borderColor: '#cfbdd2', borderWidth: 1, borderRadius: 7, flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 12 },
  savedDog: { width: 80, height: 80 },
  savedName: { fontFamily: 'Galmuri11', color: '#694f79', fontSize: 20 },
});

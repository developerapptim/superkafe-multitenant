import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Konten slide sama persis dengan versi Capacitor ──────────────
const SLIDES = [
  {
    id: '1',
    icon: 'cafe' as const,
    iconColor: '#d97706',
    title: 'Selamat Datang di Superkafe',
    description: 'Solusi digital terpadu untuk efisiensi operasional kafe dan warkop Anda.',
    bgTop: '#92400e',
    bgBottom: '#1c1917',
    accentColor: '#fbbf24',
    dotColor: '#d97706',
  },
  {
    id: '2',
    icon: 'receipt' as const,
    iconColor: '#10b981',
    title: 'Manajemen Pesanan Digital',
    description: 'Proses pesanan pelanggan lebih cepat dan akurat langsung dari meja melalui sistem POS yang terintegrasi.',
    bgTop: '#064e3b',
    bgBottom: '#1c1917',
    accentColor: '#34d399',
    dotColor: '#10b981',
  },
  {
    id: '3',
    icon: 'cube' as const,
    iconColor: '#3b82f6',
    title: 'Kontrol Stok Real-time',
    description: 'Pantau ketersediaan bahan baku secara otomatis dan dapatkan notifikasi saat stok menipis.',
    bgTop: '#1e3a8a',
    bgBottom: '#1c1917',
    accentColor: '#60a5fa',
    dotColor: '#3b82f6',
  },
  {
    id: '4',
    icon: 'bar-chart' as const,
    iconColor: '#a855f7',
    title: 'Laporan Keuangan Akurat',
    description: 'Analisis performa bisnis Anda kapan saja dengan laporan penjualan harian yang detail dan mudah dipahami.',
    bgTop: '#581c87',
    bgBottom: '#1c1917',
    accentColor: '#c084fc',
    dotColor: '#a855f7',
  },
  {
    id: '5',
    icon: 'star' as const,
    iconColor: '#f43f5e',
    title: 'Serta Berbagai Fitur Lainnya',
    description: 'Mendukung Kafe Anda lebih optimal dengan manajemen karyawan, reservasi meja, hingga sistem shift.',
    bgTop: '#881337',
    bgBottom: '#1c1917',
    accentColor: '#fb7185',
    dotColor: '#f43f5e',
  },
];

const ONBOARDING_KEY = 'hasSeenOnboarding';

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const finishOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const handleSkip = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    router.replace('/(auth)/login');
  }, [router]);

  const handleNext = useCallback(() => {
    if (isLastSlide) {
      finishOnboarding();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  }, [isLastSlide, activeIndex, finishOnboarding]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems.length > 0) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const renderSlide = ({ item, index }: { item: (typeof SLIDES)[0]; index: number }) => {
    return (
      <SlideItem item={item} index={index} scrollX={scrollX} />
    );
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <View style={[styles.container, { backgroundColor: currentSlide.bgBottom }]}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Skip Button */}
      <View style={[styles.skipContainer, { paddingTop: insets.top + 12 }]}>
        {!isLastSlide && (
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
            <Text style={styles.skipText}>Lewati</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef as any}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onScroll={scrollHandler}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={{ flex: 1 }}
      />

      {/* Bottom Controls */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dot Indicators */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <DotIndicator
              key={index}
              index={index}
              scrollX={scrollX}
              activeColor={currentSlide.dotColor}
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.85}
          style={[
            styles.ctaButton,
            { backgroundColor: currentSlide.dotColor },
          ]}
        >
          <Text style={styles.ctaText}>
            {isLastSlide ? 'Mulai Sekarang' : 'Lanjut'}
          </Text>
          <Ionicons
            name={isLastSlide ? 'rocket' : 'arrow-forward'}
            size={20}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Slide Item ────────────────────────────────────────────────
function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: (typeof SLIDES)[0];
  index: number;
  scrollX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.85, 1, 0.85],
      Extrapolation.CLAMP
    );
    return { opacity, transform: [{ scale }] };
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      {/* Top colored section */}
      <View style={[styles.slideTopBg, { backgroundColor: item.bgTop }]} />

      <Animated.View style={[styles.slideContent, animatedStyle]}>
        {/* Icon Illustration */}
        <View style={[styles.iconContainer, { borderColor: item.accentColor + '40' }]}>
          <View style={[styles.iconInner, { backgroundColor: item.accentColor + '20' }]}>
            <Ionicons name={item.icon} size={72} color={item.accentColor} />
          </View>
        </View>

        {/* Text */}
        <Text style={[styles.slideTitle, { color: item.accentColor }]}>
          {item.title}
        </Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Dot Indicator ────────────────────────────────────────────
function DotIndicator({
  index,
  scrollX,
  activeColor,
}: {
  index: number;
  scrollX: SharedValue<number>;
  activeColor: string;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.4, 1, 0.4],
      Extrapolation.CLAMP
    );
    return { width, opacity };
  });

  return (
    <Animated.View
      style={[styles.dot, dotStyle, { backgroundColor: activeColor }]}
    />
  );
}

// ─── Styles ────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  slideTopBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  slideContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  iconContainer: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    marginTop: -20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  iconInner: {
    width: 150,
    height: 150,
    borderRadius: 75,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  slideDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  bottomContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

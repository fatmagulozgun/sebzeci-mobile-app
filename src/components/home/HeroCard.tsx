import React, { useEffect, useRef, useState } from 'react';
import { UserCircle2 } from 'lucide-react-native';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Props = {
  userName: string;
  profileImageUri: string | null;
  lastOrderDays?: number;
};

export default function HeroCard({ userName, profileImageUri, lastOrderDays = 6 }: Props) {
  const [animatedDays, setAnimatedDays] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.max(0, Number(lastOrderDays || 0));
    const durationMs = 700;
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(target * eased);
      setAnimatedDays(nextValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    setAnimatedDays(0);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [lastOrderDays]);

  return (
    <View style={styles.heroCard}>
      <View style={styles.heroTopRow}>
        {profileImageUri ? (
          <Image source={{ uri: profileImageUri }} style={styles.heroAvatar} />
        ) : (
          <View style={styles.heroAvatarFallback}>
            <UserCircle2 size={30} color="#6B7280" />
          </View>
        )}
        <View style={styles.heroTextWrap}>
          <Text style={styles.heroTitle}>Hoş geldin {userName} 👋</Text>
          <Text style={styles.heroSubtitle}>Bugün taze ürünleri keşfetmeye ne dersin?</Text>
          <Text style={styles.heroOrderInfo}>Son sipariş: {animatedDays} gün önce</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.heroButton}>
        <Text style={styles.heroButtonText}>Alışverişe Başla →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    marginTop: 22,
    borderRadius: 18,
    backgroundColor: '#F0FFF4',
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  heroAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: '#047857',
    fontSize: 34,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
  heroSubtitle: {
    marginTop: 8,
    color: '#4B5563',
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'Roboto',
  },
  heroOrderInfo: {
    marginTop: 10,
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 24,
    fontFamily: 'Roboto',
  },
  heroButton: {
    marginTop: 16,
    backgroundColor: '#05803F',
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Roboto',
  },
});

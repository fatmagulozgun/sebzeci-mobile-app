import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  ScrollView,
  findNodeHandle,
} from 'react-native';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react-native';
import KeyboardAwareAuthContainer from '../../components/common/KeyboardAwareAuthContainer';
import { register } from '../../services/authService';
import { showAppToast } from '../../context/toastContext';

type Props = {
  navigation: {
    replace: (screenName: string) => void;
    navigate: (screenName: string) => void;
  };
};

export default function RegisterScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const nameInputRef = useRef<TextInput>(null);
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const scrollInputIntoView = (inputRef: React.RefObject<TextInput | null>) => {
    const scrollView = scrollRef.current;
    const input = inputRef.current;
    if (!scrollView || !input) return;

    const scrollNode = findNodeHandle(scrollView);
    if (!scrollNode) return;

    requestAnimationFrame(() => {
      input.measureLayout(
        scrollNode,
        (_x, y) => {
          const extraOffset = Platform.OS === 'ios' ? 120 : 140;
          scrollView.scrollTo({ y: Math.max(0, y - extraOffset), animated: true });
        },
        () => {
          scrollView.scrollToEnd({ animated: true });
        },
      );
    });
  };

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      showAppToast('Lütfen tüm kayıt alanlarını doldurun.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      showAppToast('Kayıt başarıyla oluşturuldu.', 'success');
      navigation.replace('Home');
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (error?.code === 'ERR_NETWORK'
          ? 'Sunucuya bağlanılamadı. API adresini ve backend sunucusunu kontrol edin.'
          : 'Kayıt olunurken bir hata oluştu.');
      showAppToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAwareAuthContainer
      style={styles.container}
      ref={scrollRef}
      contentContainerStyle={styles.scrollContent}
      extraBottomPadding={Platform.OS === 'ios' ? 44 : 28}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Hesap Oluştur</Text>
        <Text style={styles.subtitle}>Dakikalar içinde kaydolup sipariş vermeye başlayın.</Text>

        <View style={styles.card}>
          <View style={styles.inputWrapper}>
            <User size={20} color="#6b7280" />
            <TextInput
              ref={nameInputRef}
              style={styles.inputField}
              placeholder="Adınız ve Soyadınız"
              placeholderTextColor="#9ca3af"
              value={name}
              returnKeyType="next"
              onFocus={() => scrollInputIntoView(nameInputRef)}
              onChangeText={setName}
              onSubmitEditing={() => emailInputRef.current?.focus()}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Mail size={20} color="#6b7280" />
            <TextInput
              ref={emailInputRef}
              style={styles.inputField}
              placeholder="E-posta"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              returnKeyType="next"
              onFocus={() => scrollInputIntoView(emailInputRef)}
              onChangeText={setEmail}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </View>

          <View style={styles.inputWrapper}>
            <Lock size={20} color="#6b7280" />
            <TextInput
              ref={passwordInputRef}
              style={styles.inputField}
              placeholder="Sifre"
              placeholderTextColor="#9ca3af"
              secureTextEntry={!showPassword}
              value={password}
              returnKeyType="done"
              onFocus={() => scrollInputIntoView(passwordInputRef)}
              onChangeText={setPassword}
              onSubmitEditing={handleRegister}
            />
            <Pressable onPress={() => setShowPassword((prev) => !prev)}>
              {showPassword ? <EyeOff size={20} color="#6b7280" /> : <Eye size={20} color="#6b7280" />}
            </Pressable>
          </View>

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonText}>{isSubmitting ? 'Kayıt Olunuyor...' : 'Kayıt Ol'}</Text>
          </Pressable>

          <Text style={styles.switchText}>
            Zaten hesabınız var mı?
            <Text style={styles.link} onPress={() => navigation.navigate('Login')}>
              {' '}
              Giriş Yapın
            </Text>
          </Text>
        </View>
      </View>
    </KeyboardAwareAuthContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    width: '100%',
    fontSize: 30,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    width: '100%',
    marginTop: 10,
    color: '#6b7280',
    lineHeight: 24,
    fontSize: 15,
  },
  card: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 14,
    backgroundColor: '#ffffff',
  },
  inputField: {
    flex: 1,
    paddingVertical: 13,
    paddingLeft: 10,
    color: '#111827',
  },
  button: {
    backgroundColor: '#15803d',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 20,
    shadowColor: '#15803d',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  switchText: {
    marginTop: 18,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
  },
  link: {
    color: '#15803d',
    fontWeight: '700',
  },
});

import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  StyleSheet,
  Image,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  findNodeHandle,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Mail, Lock, Eye, User, EyeOff } from 'lucide-react-native';
import type { AuthUser } from '../../services/authService';
import { showAppToast } from '../../context/toastContext';
import KeyboardAwareAuthContainer from '../../components/common/KeyboardAwareAuthContainer';
import { AuthContext } from '../../context/authContext';
import { getLastEmail, getRememberMePreference } from '../../services/authPreferences';
import { getRememberedCredentials } from '../../services/rememberedCredentialsStore';
import { isGoogleSignInConfigured } from '../../services/googleSignInBootstrap';
import { mapGoogleAuthFlowError, mapGoogleBackendAuthError } from '../../services/mapGoogleAuthError';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 40;
const ANIMATION_DURATION = 300;
const HERO_HEIGHT = 340;

type AuthForm = 'login' | 'register';

type State = {
  activeForm: AuthForm;
  showPassword: boolean;
  showRegisterPassword: boolean;
  loginEmail: string;
  loginPassword: string;
  rememberMe: boolean;
  registerName: string;
  registerEmail: string;
  registerPassword: string;
  currentUser: AuthUser | null;
  isSubmitting: boolean;
  isGoogleSigningIn: boolean;
};

type Props = Record<string, never>;

export default class LoginScreen extends React.Component<Props, State> {
  static contextType = AuthContext;

  private get auth(): React.ContextType<typeof AuthContext> | undefined {
    return this.context as React.ContextType<typeof AuthContext> | undefined;
  }

  private translateX = new Animated.Value(0);
  private scrollRef = React.createRef<ScrollView>();
  private loginEmailInputRef = React.createRef<TextInput>();
  private loginPasswordInputRef = React.createRef<TextInput>();
  private registerNameInputRef = React.createRef<TextInput>();
  private registerEmailInputRef = React.createRef<TextInput>();
  private registerPasswordInputRef = React.createRef<TextInput>();

  state: State = {
    activeForm: 'login',
    showPassword: false,
    showRegisterPassword: false,
    loginEmail: '',
    loginPassword: '',
    rememberMe: true,
    registerName: '',
    registerEmail: '',
    registerPassword: '',
    currentUser: null,
    isSubmitting: false,
    isGoogleSigningIn: false,
  };

  async componentDidMount() {
    const [savedEmail, rememberPref, rememberedCredentials] = await Promise.all([
      getLastEmail(),
      getRememberMePreference(),
      getRememberedCredentials(),
    ]);
    const rememberMe = rememberPref ?? true;
    this.setState({
      loginEmail: rememberMe ? rememberedCredentials?.email || savedEmail || '' : savedEmail || '',
      loginPassword: rememberMe ? rememberedCredentials?.password || '' : '',
      rememberMe,
      registerEmail: savedEmail || this.state.registerEmail,
    });
  }

  handleLogin = async () => {
    const { loginEmail, loginPassword, rememberMe } = this.state;

    if (!loginEmail || !loginPassword) {
      showAppToast('Lütfen e-posta ve şifre alanlarını doldurun.', 'error');
      return;
    }

    try {
      this.setState({ isSubmitting: true });
      await this.auth?.signIn?.({ email: loginEmail.trim(), password: loginPassword, rememberMe });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (error?.code === 'ERR_NETWORK'
          ? 'Sunucuya bağlanılamadı. API adresini ve backend sunucusunu kontrol edin.'
          : 'Giriş yapılırken bir hata oluştu.');
      showAppToast(message, 'error');
    } finally {
      this.setState({ isSubmitting: false });
    }
  };

  handleRegister = async () => {
    const { registerName, registerEmail, registerPassword, rememberMe } = this.state;

    if (!registerName || !registerEmail || !registerPassword) {
      showAppToast('Lütfen tüm kayıt alanlarını doldurun.', 'error');
      return;
    }

    try {
      this.setState({ isSubmitting: true });
      await this.auth?.signUp?.({
        name: registerName.trim(),
        email: registerEmail.trim(),
        password: registerPassword,
        rememberMe,
      });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        (error?.code === 'ERR_NETWORK'
          ? 'Sunucuya baglanilamadi. API adresini ve backend sunucusunu kontrol edin.'
          : 'Kayit olunurken bir hata olustu.');
      showAppToast(message, 'error');
    } finally {
      this.setState({ isSubmitting: false });
    }
  };

  handleGoogleLogin = async () => {
    const { rememberMe } = this.state;

    if (!isGoogleSignInConfigured()) {
      showAppToast(
        'Google girişi yapılandırılmadı. .env dosyasına GOOGLE_WEB_CLIENT_ID ekleyin.',
        'error',
      );
      return;
    }

    try {
      this.setState({ isGoogleSigningIn: true });
      await this.auth?.signInWithGoogle?.({ rememberMe });
    } catch (error: any) {
      if (error?.response) {
        showAppToast(mapGoogleBackendAuthError(error), 'error');
        return;
      }
      const flowMessage = mapGoogleAuthFlowError(error);
      if (flowMessage === null) {
        return;
      }
      showAppToast(flowMessage, 'error');
    } finally {
      this.setState({ isGoogleSigningIn: false });
    }
  };

  slideToForm = (form: AuthForm) => {
    if (form === this.state.activeForm) {
      return;
    }

    Animated.timing(this.translateX, {
      toValue: form === 'login' ? 0 : -CARD_WIDTH,
      duration: ANIMATION_DURATION,
      useNativeDriver: true,
    }).start(() => {
      this.setState({ activeForm: form });
    });
  };

  scrollInputIntoView = (inputRef: React.RefObject<TextInput | null>) => {
    const scrollView = this.scrollRef.current;
    const input = inputRef.current;
    if (!scrollView || !input) return;

    const scrollNode = findNodeHandle(scrollView);
    const inputNode = findNodeHandle(input);
    if (!scrollNode || !inputNode) return;

    requestAnimationFrame(() => {
      setTimeout(() => {
        UIManager.measureLayout(
          inputNode,
          scrollNode,
          () => {
            scrollView.scrollToEnd({ animated: true });
          },
          (_x, y) => {
            const extraOffset = Platform.OS === 'ios' ? 140 : 180;
            scrollView.scrollTo({ y: Math.max(0, y - extraOffset), animated: true });
          },
        );
      }, 110);
    });
  };

  render() {
    const { activeForm, isSubmitting, isGoogleSigningIn } = this.state;

    return (
      <KeyboardAwareAuthContainer
        style={styles.container}
        ref={this.scrollRef}
        contentContainerStyle={styles.scrollContent}
        extraBottomPadding={Platform.OS === 'ios' ? 8 : 0}
      >
        <StatusBar translucent={false} backgroundColor="#f7f7f7" barStyle="dark-content" />
        <View style={styles.heroWrapper}>
          <Image
            source={require('../../assets/hero.png')}
            style={styles.hero}
            resizeMode="cover"
          />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Sebzecin Artık Online</Text>

          <Text style={styles.subtitle}>
            Taze sebze ve meyveleri birkaç saniyede sipariş ver. Siparişlerini
            kolayca takip et.
          </Text>

          <View style={styles.cardViewport}>
            <Animated.View
              style={[
                styles.cardsTrack,
                {
                  width: CARD_WIDTH * 2,
                  transform: [{ translateX: this.translateX }],
                },
              ]}
            >
              <View style={styles.card} pointerEvents={activeForm === 'login' ? 'auto' : 'none'}>
                <Text style={styles.cardTitle}>Giriş Yap</Text>

                <View style={styles.inputWrapper}>
                  <Mail size={20} color="#6b7280" />
                  <TextInput
                    ref={this.loginEmailInputRef}
                    placeholder="E-posta"
                    style={styles.inputField}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                    autoCorrect={false}
                    value={this.state.loginEmail}
                    onChangeText={text => this.setState({ loginEmail: text })}
                    onFocus={() => this.scrollInputIntoView(this.loginEmailInputRef)}
                    onSubmitEditing={() => this.loginPasswordInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Lock size={20} color="#6b7280" />

                  <TextInput
                    ref={this.loginPasswordInputRef}
                    placeholder="Şifre"
                    secureTextEntry={!this.state.showPassword}
                    style={styles.inputField}
                    placeholderTextColor="#9ca3af"
                    returnKeyType="done"
                    value={this.state.loginPassword}
                    onChangeText={text => this.setState({ loginPassword: text })}
                    onFocus={() => this.scrollInputIntoView(this.loginPasswordInputRef)}
                    onSubmitEditing={this.handleLogin}
                  />

                  <Pressable
                    onPress={() =>
                      this.setState({ showPassword: !this.state.showPassword })
                    }
                  >
                    {this.state.showPassword ? (
                      <EyeOff size={20} color="#6b7280" />
                    ) : (
                      <Eye size={20} color="#6b7280" />
                    )}
                  </Pressable>

                </View>

                <View style={styles.rememberRow}>
                  <Text style={styles.rememberLabel}>Beni Hatırla</Text>
                  <Switch
                    value={this.state.rememberMe}
                    onValueChange={value => this.setState({ rememberMe: value })}
                    trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                    thumbColor={this.state.rememberMe ? '#15803d' : '#f3f4f6'}
                    ios_backgroundColor="#e5e7eb"
                  />
                </View>

                <Pressable
                  style={[styles.button, isSubmitting && styles.buttonDisabled]}
                  onPress={this.handleLogin}
                  disabled={isSubmitting}
                >
                  <Text style={styles.buttonText}>
                    {isSubmitting ? 'Giris Yapiliyor...' : 'Giriş Yap'}
                  </Text>
                </Pressable>

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>veya</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  style={[
                    styles.googleButton,
                    (isSubmitting || isGoogleSigningIn) && styles.googleButtonDisabled,
                  ]}
                  onPress={this.handleGoogleLogin}
                  disabled={isSubmitting || isGoogleSigningIn}
                >
                  {isGoogleSigningIn ? (
                    <ActivityIndicator color="#1e293b" />
                  ) : (
                    <View style={styles.googleInner}>
                      <View style={styles.googleMark}>
                        <Text style={styles.googleMarkText}>G</Text>
                      </View>
                      <Text style={styles.googleButtonTitle}>Google ile Devam Et</Text>
                    </View>
                  )}
                </Pressable>

                <Text style={styles.switchText}>
                  Hesabın yok mu?
                  <Text
                    style={styles.link}
                    onPress={() => this.slideToForm('register')}
                  >
                    {' '}
                    Hemen Kayıt Ol
                  </Text>
                </Text>
              </View>

              <View
                style={styles.card}
                pointerEvents={activeForm === 'register' ? 'auto' : 'none'}
              >
                <Text style={styles.cardTitle}>Kayıt Ol</Text>
                

                <View style={styles.inputWrapper}>
                  <User size={20} color="#6b7280" />
                  <TextInput
                    ref={this.registerNameInputRef}
                    placeholder="Ad Soyad"
                    style={styles.inputField}
                    placeholderTextColor="#9ca3af"
                    returnKeyType="next"
                    value={this.state.registerName}
                    onChangeText={text => this.setState({ registerName: text })}
                    onFocus={() => this.scrollInputIntoView(this.registerNameInputRef)}
                    onSubmitEditing={() => this.registerEmailInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Mail size={20} color="#6b7280" />
                  <TextInput
                    ref={this.registerEmailInputRef}
                    placeholder="E-posta"
                    style={styles.inputField}
                    placeholderTextColor="#9ca3af"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    returnKeyType="next"
                    autoCorrect={false}
                    value={this.state.registerEmail}
                    onChangeText={text => this.setState({ registerEmail: text })}
                    onFocus={() => this.scrollInputIntoView(this.registerEmailInputRef)}
                    onSubmitEditing={() => this.registerPasswordInputRef.current?.focus()}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Lock size={20} color="#6b7280" />
                  <TextInput
                    ref={this.registerPasswordInputRef}
                    placeholder="Şifre"
                    secureTextEntry={!this.state.showRegisterPassword}
                    style={styles.inputField}
                    placeholderTextColor="#9ca3af"
                    returnKeyType="done"
                    value={this.state.registerPassword}
                    onChangeText={text => this.setState({ registerPassword: text })}
                    onFocus={() => this.scrollInputIntoView(this.registerPasswordInputRef)}
                    onSubmitEditing={this.handleRegister}
                  />
                  <Pressable
                    onPress={() =>
                      this.setState({ showRegisterPassword: !this.state.showRegisterPassword })
                    }
                  >
                    {this.state.showRegisterPassword ? (
                      <EyeOff size={20} color="#6b7280" />
                    ) : (
                      <Eye size={20} color="#6b7280" />
                    )}
                  </Pressable>
                </View>

                <View style={styles.rememberRow}>
                  <Text style={styles.rememberLabel}>Beni Hatırla</Text>
                  <Switch
                    value={this.state.rememberMe}
                    onValueChange={value => this.setState({ rememberMe: value })}
                    trackColor={{ false: '#e5e7eb', true: '#86efac' }}
                    thumbColor={this.state.rememberMe ? '#15803d' : '#f3f4f6'}
                    ios_backgroundColor="#e5e7eb"
                  />
                </View>

                <Pressable
                  style={[styles.button, isSubmitting && styles.buttonDisabled]}
                  onPress={this.handleRegister}
                  disabled={isSubmitting}
                >
                  <Text style={styles.buttonText}>
                    {isSubmitting ? 'Kayit Olunuyor...' : 'Kayıt Ol'}
                  </Text>
                </Pressable>

                <Text style={styles.switchText}>
                  Zaten hesabın var mı?
                  <Text
                    style={styles.link}
                    onPress={() => this.slideToForm('login')}
                  >
                    {' '}Giriş Yap
                  </Text>
                </Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </KeyboardAwareAuthContainer>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf8',
  },

  scrollContent: {
    flexGrow: 1,
  },

  heroWrapper: {
    position: 'relative',
    height: HERO_HEIGHT,
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: '#f8faf8'
  },

  hero: {
    width: '100%',
    height: HERO_HEIGHT,
    marginTop: 0,
    resizeMode: 'cover',
  },


  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 11,
    paddingHorizontal: 12,
    marginTop: 10,
    backgroundColor: '#ffffff',
  },

  inputField: {
    flex: 1,
    paddingVertical: 10,
    paddingLeft: 8,
    color: '#111827',
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    paddingBottom: 0,
  },

  title: {
    width: '100%',
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 12,
  },

  subtitle: {
    width: '100%',
    marginTop: 6,
    color: '#6b7280',
    lineHeight: 22,
    fontSize: 13,
  },

  cardViewport: {
    width: CARD_WIDTH,
    marginTop: 14,
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 24,
  },

  cardsTrack: {
    flexDirection: 'row',
  },

  card: {
    width: CARD_WIDTH,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 24,
    shadowColor: '#0f172a',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 16,
    },
    elevation: 12,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  cardSub: {
    marginTop: 4,
    color: '#6b7280',
    lineHeight: 18,
    fontSize: 13,
  },


  button: {
    backgroundColor: '#15803d',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 12,
    shadowColor: '#15803d',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    elevation: 4,
  },

  buttonText: {
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },

  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e2e8f0',
  },

  dividerText: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  googleButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  googleButtonDisabled: {
    opacity: 0.55,
  },

  googleInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  googleMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  googleMarkText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4285f4',
  },

  googleButtonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 0.2,
  },

  rememberRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },

  rememberLabel: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 13,
  },

  switchText: {
    marginTop: 12,
    color: '#6b7280',
    lineHeight: 18,
    fontSize: 13,
  },

  link: {
    color: '#15803d',
    fontWeight: '700',
  },
});

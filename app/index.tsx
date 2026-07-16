import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator, Alert, Dimensions,
    KeyboardAvoidingView, Platform, SafeAreaView,
    ScrollView, StatusBar, StyleSheet, Text,
    TextInput, TouchableOpacity, View
} from 'react-native';
import { Image } from 'expo-image';
import { Colors } from '../constants/Colors';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    useEffect(() => {
        const checkExistingLogin = async () => {
            try {
                const token = await AsyncStorage.getItem('auth_token');
                const loginTimestampStr = await AsyncStorage.getItem('login_timestamp');

                if (token && loginTimestampStr) {
                    const hoursPassed = (Date.now() - parseInt(loginTimestampStr, 10)) / (1000 * 60 * 60);
                    if (hoursPassed < 22) {
                        router.replace('/dashboard');
                        return;
                    }
                }
            } catch (error) {
                console.error("Error checking auth:", error);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkExistingLogin();
    }, []);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            Alert.alert('Missing Fields', 'Please enter both email and password.');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('https://myomegahrms.in/api/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password }),
            });

            const data = await response.json();

            if (response.ok) {
                await AsyncStorage.setItem('auth_token', data.access);
                await AsyncStorage.setItem('user_data', JSON.stringify(data.user));
                await AsyncStorage.setItem('login_timestamp', Date.now().toString());
                router.replace('/dashboard');
            } else {
                Alert.alert('Login Failed', data.detail || 'Please check your credentials.');
            }
        } catch (error) {
            Alert.alert('Connection Error', 'Unable to reach the server. Please check your internet connection.');
        } finally {
            setLoading(false);
        }
    };

    if (isCheckingAuth) {
        return (
            <View style={styles.splashContainer}>
                <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
                <View style={styles.splashLogo}>
                    <Text style={styles.splashBrand}>MY<Text style={styles.splashBrandWhite}>OMEGA</Text></Text>
                </View>
                <ActivityIndicator size="large" color={Colors.white} style={{ marginTop: 40 }} />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* ── Hero / Brand Area ── */}
                    <View style={styles.heroArea}>
                        {/* Background circles for visual depth */}
                        <View style={styles.heroBubble1} />
                        <View style={styles.heroBubble2} />

                        <View style={styles.logoCard}>
                            <Image
                                source={require('../assets/images/logo.jpg')}
                                style={styles.logoImage}
                                contentFit="contain"
                            />
                        </View>

                        <Text style={styles.brandText}>
                            MY<Text style={styles.brandTextWhite}>OMEGA</Text>
                        </Text>
                        <Text style={styles.tagline}>HR Management Portal</Text>
                    </View>

                    {/* ── Form Area ── */}
                    <View style={styles.formSheet}>
                        <Text style={styles.welcomeTitle}>Welcome Back 👋</Text>
                        <Text style={styles.welcomeSub}>Sign in to continue</Text>

                        {/* Email Input */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Email Address</Text>
                            <View style={[styles.inputWrapper, emailFocused && styles.inputWrapperFocused]}>
                                <Ionicons
                                    name="mail-outline"
                                    size={18}
                                    color={emailFocused ? Colors.primary : Colors.textTertiary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="you@company.com"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={email}
                                    onChangeText={setEmail}
                                    onFocus={() => setEmailFocused(true)}
                                    onBlur={() => setEmailFocused(false)}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                />
                            </View>
                        </View>

                        {/* Password Input */}
                        <View style={styles.fieldGroup}>
                            <Text style={styles.fieldLabel}>Password</Text>
                            <View style={[styles.inputWrapper, passwordFocused && styles.inputWrapperFocused]}>
                                <Ionicons
                                    name="lock-closed-outline"
                                    size={18}
                                    color={passwordFocused ? Colors.primary : Colors.textTertiary}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter your password"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={password}
                                    onChangeText={setPassword}
                                    onFocus={() => setPasswordFocused(true)}
                                    onBlur={() => setPasswordFocused(false)}
                                    secureTextEntry={!showPassword}
                                    autoComplete="password"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    style={styles.eyeButton}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                                        size={18}
                                        color={Colors.textTertiary}
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Forgot Password */}
                        <TouchableOpacity style={styles.forgotRow}>
                            <Text style={styles.forgotText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        {/* Login Button */}
                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonLoading]}
                            onPress={handleLogin}
                            disabled={loading}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.white} size="small" />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>Sign In</Text>
                                    <View style={styles.loginButtonArrow}>
                                        <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
                                    </View>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Ionicons name="shield-checkmark-outline" size={13} color={Colors.textTertiary} />
                            <Text style={styles.footerText}>Secured by MYOMEGA HRMS</Text>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    // ── Splash / Loading
    splashContainer: {
        flex: 1,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    splashLogo: {
        alignItems: 'center',
    },
    splashBrand: {
        fontSize: 42,
        fontWeight: '900',
        color: Colors.primaryDark,
        letterSpacing: 3,
    },
    splashBrandWhite: {
        color: Colors.white,
    },

    // ── Layout
    container: {
        flex: 1,
        backgroundColor: Colors.primary,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },

    // ── Hero
    heroArea: {
        height: height * 0.40,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
    },
    heroBubble1: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.06)',
        top: -60,
        right: -50,
    },
    heroBubble2: {
        position: 'absolute',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.05)',
        bottom: -40,
        left: -30,
    },
    logoCard: {
        width: 90,
        height: 90,
        borderRadius: 22,
        backgroundColor: Colors.white,
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    brandText: {
        fontSize: 30,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 3,
    },
    brandTextWhite: {
        color: Colors.white,
    },
    tagline: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.65)',
        fontWeight: '500',
        marginTop: 4,
        letterSpacing: 0.5,
    },

    // ── Form Sheet
    formSheet: {
        flex: 1,
        backgroundColor: Colors.background,
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        paddingHorizontal: 28,
        paddingTop: 36,
        paddingBottom: 40,
        // top shadow
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 12,
    },
    welcomeTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: Colors.text,
        marginBottom: 6,
    },
    welcomeSub: {
        fontSize: 15,
        color: Colors.textSecondary,
        marginBottom: 32,
        fontWeight: '400',
    },

    // ── Form Fields
    fieldGroup: {
        marginBottom: 20,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.textSecondary,
        marginBottom: 8,
        letterSpacing: 0.3,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: Colors.border,
        paddingHorizontal: 14,
        height: 54,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    inputWrapperFocused: {
        borderColor: Colors.primary,
        shadowColor: Colors.primary,
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 4,
    },
    inputIcon: {
        marginRight: 10,
    },
    textInput: {
        flex: 1,
        fontSize: 15,
        color: Colors.text,
        fontWeight: '500',
    },
    eyeButton: {
        padding: 4,
        marginLeft: 8,
    },

    // ── Forgot
    forgotRow: {
        alignSelf: 'flex-end',
        marginBottom: 28,
        marginTop: -4,
    },
    forgotText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '700',
    },

    // ── Login Button
    loginButton: {
        height: 56,
        backgroundColor: Colors.primary,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 10,
        marginBottom: 28,
    },
    loginButtonLoading: {
        opacity: 0.75,
        shadowOpacity: 0,
        elevation: 0,
    },
    loginButtonText: {
        color: Colors.white,
        fontSize: 17,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginRight: 12,
    },
    loginButtonArrow: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.white,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Footer
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    footerText: {
        fontSize: 12,
        color: Colors.textTertiary,
        fontWeight: '500',
    },
});

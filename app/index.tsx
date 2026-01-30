import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';

export default function LoginScreen() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('https://myomegahrms.in/api/login/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                // Save Token and User Data
                await AsyncStorage.setItem('auth_token', data.access);
                await AsyncStorage.setItem('user_data', JSON.stringify(data.user));

                // Navigate to Dashboard
                router.replace('/dashboard');
            } else {
                // Handle Error
                const errorMessage = data.detail || 'Login failed. Please check your credentials.';
                Alert.alert('Login Failed', errorMessage);
            }
        } catch (error) {
            console.error('Login Error:', error);
            Alert.alert('Error', 'Something went wrong. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.contentContainer}>

                    {/* Header / Logo Area */}
                    <View style={styles.headerContainer}>
                        <View style={styles.logoContainer}>
                            <Image
                                source={require('../assets/images/logo.jpg')}
                                style={styles.logoImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.appName}>

                            MY<Text style={styles.appNameHighlight}>OMEGA</Text>
                        </Text>
                        <Text style={styles.welcomeText}>Welcome Back</Text>
                        <Text style={styles.subText}>Sign in to continue</Text>
                    </View>

                    {/* Form Area */}
                    <View style={styles.formContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your email"
                                placeholderTextColor="#A0A0A0"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.inputLabel}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                placeholderTextColor="#A0A0A0"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>

                        <TouchableOpacity style={styles.forgotPassword}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                            onPress={handleLogin}
                            activeOpacity={0.8}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <>
                                    <Text style={styles.loginButtonText}>Login</Text>
                                    <Ionicons name="arrow-forward" size={20} color={Colors.white} />
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 30,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 50,
    },
    logoContainer: {
        width: 120,
        height: 120,
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    appName: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.text,
        letterSpacing: 2,
    },
    appNameHighlight: {
        color: Colors.primary,
    },
    welcomeText: {
        fontSize: 24,
        fontWeight: '600',
        color: Colors.text,
        marginTop: 10,
    },
    subText: {
        fontSize: 16,
        color: Colors.textSecondary,
        marginTop: 5,
    },
    formContainer: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 20,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: Colors.textSecondary,
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: Colors.white,
        height: 55,
        borderRadius: 16,
        paddingHorizontal: 20,
        fontSize: 16,
        color: Colors.text,
        borderWidth: 1,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    forgotPassword: {
        alignSelf: 'flex-end',
        marginBottom: 30,
    },
    forgotPasswordText: {
        color: Colors.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    loginButton: {
        backgroundColor: Colors.primary,
        height: 58,
        borderRadius: 18,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: {
            width: 0,
            height: 8,
        },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 8,
    },
    loginButtonDisabled: {
        backgroundColor: '#ff8a80',
        shadowOpacity: 0,
        elevation: 0,
    },
    loginButtonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 10,
    },
});

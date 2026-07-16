import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, Dimensions, Modal,
    Platform, RefreshControl, ScrollView,
    StatusBar, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';

let lastPunchInActionTime = 0;

const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const h = hours.toString().padStart(2, '0');
    const m = minutes.toString().padStart(2, '0');
    const s = seconds.toString().padStart(2, '0');
    return { hours: h, minutes: m, seconds: s, label: `${h}:${m}:${s}` };
};

const formatTime = (isoString: string | null) => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return 'Invalid'; }
};

const formatDate = (dateStr: string) => {
    try {
        return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return dateStr; }
};

const getLocalTodayString = () => {
    const d = new Date();
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
};

const LiveClock = React.memo(() => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(clockTimer);
    }, []);

    const formattedDate = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    return <Text style={styles.liveDate}>{formattedDate}</Text>;
});

const LiveTimer = React.memo(({ isPunchedIn, user }: { isPunchedIn: boolean, user: any }) => {
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    useEffect(() => {
        if (!user) return;
        let stopwatchTimer: ReturnType<typeof setInterval>;
        const keys = getKeys(user.id);

        const checkState = async () => {
            if (!isPunchedIn) {
                try {
                    const pausedDate = await AsyncStorage.getItem(keys.PAUSED_DATE);
                    const todayStr = getLocalTodayString();
                    if (pausedDate === todayStr) {
                        const pausedSecs = await AsyncStorage.getItem(keys.PAUSED_TIME);
                        if (pausedSecs) setElapsedSeconds(parseInt(pausedSecs, 10));
                    } else {
                        setElapsedSeconds(0);
                    }
                } catch (e) {}
                return;
            }

            try {
                const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
                if (!storedPunchIn) return;
                const punchInTs = parseInt(storedPunchIn, 10);
                
                let baseSeconds = 0;
                const pausedDate = await AsyncStorage.getItem(keys.PAUSED_DATE);
                const todayStr = getLocalTodayString();
                if (pausedDate === todayStr) {
                    const pausedSecs = await AsyncStorage.getItem(keys.PAUSED_TIME);
                    if (pausedSecs) baseSeconds = parseInt(pausedSecs, 10);
                }
                
                const updateTick = () => {
                    const currentSession = Math.floor((Date.now() - punchInTs) / 1000);
                    const totalDiff = baseSeconds + (currentSession >= 0 ? currentSession : 0);
                    setElapsedSeconds(totalDiff);
                };
                updateTick();
                stopwatchTimer = setInterval(updateTick, 1000);
            } catch (e) { console.warn("Timer update error:", e); }
        };

        checkState();
        return () => { if (stopwatchTimer) clearInterval(stopwatchTimer); };
    }, [isPunchedIn, user]);

    const duration = formatDuration(elapsedSeconds);

    return (
        <View style={styles.timerCard}>
            <Text style={styles.timerCardLabel}>Work Timer</Text>
            <View style={styles.timerRow}>
                <View style={styles.timerBlock}>
                    <Text style={[styles.timerDigit, isPunchedIn && styles.timerDigitActive]}>{duration.hours}</Text>
                    <Text style={styles.timerUnit}>HRS</Text>
                </View>
                <Text style={styles.timerSep}>:</Text>
                <View style={styles.timerBlock}>
                    <Text style={[styles.timerDigit, isPunchedIn && styles.timerDigitActive]}>{duration.minutes}</Text>
                    <Text style={styles.timerUnit}>MIN</Text>
                </View>
                <Text style={styles.timerSep}>:</Text>
                <View style={styles.timerBlock}>
                    <Text style={[styles.timerDigit, isPunchedIn && styles.timerDigitActive]}>{duration.seconds}</Text>
                    <Text style={styles.timerUnit}>SEC</Text>
                </View>
            </View>
        </View>
    );
});

const AttendanceCardItem = React.memo(({ record }: { record: AttendanceRecord }) => {
    const isFullDay = record.status_display === 'Full Day';
    const statusBg = isFullDay ? Colors.successLight : Colors.warningLight;
    const statusColor = isFullDay ? Colors.success : Colors.warning;

    return (
        <View style={styles.attendanceCard}>
            <View style={styles.attendanceCardHeader}>
                <View style={styles.attendanceDateBadge}>
                    <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
                    <Text style={styles.attendanceDateText}>{formatDate(record.date)}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                        {record.status_display}
                    </Text>
                </View>
            </View>

            <View style={styles.timeRowsContainer}>
                <View style={styles.timeRow}>
                    <View style={[styles.timeRowDot, { backgroundColor: Colors.success }]} />
                    <View style={styles.timeRowInfo}>
                        <Text style={styles.timeRowLabel}>Punch In</Text>
                        <Text style={styles.timeRowValue}>{formatTime(record.punch_in_time)}</Text>
                        {record.punch_in_location ? (
                            <Text style={styles.timeRowLocation} numberOfLines={1}>
                                {record.punch_in_location}
                            </Text>
                        ) : null}
                    </View>
                </View>

                <View style={styles.timeRowDivider} />

                <View style={styles.timeRow}>
                    <View style={[styles.timeRowDot, { backgroundColor: Colors.primary }]} />
                    <View style={styles.timeRowInfo}>
                        <Text style={styles.timeRowLabel}>Punch Out</Text>
                        <Text style={[
                            styles.timeRowValue,
                            !record.punch_out_time && styles.timeRowValueMuted
                        ]}>
                            {record.punch_out_time ? formatTime(record.punch_out_time) : 'Active'}
                        </Text>
                        {record.punch_out_location ? (
                            <Text style={styles.timeRowLocation} numberOfLines={1}>
                                {record.punch_out_location}
                            </Text>
                        ) : null}
                    </View>
                </View>
            </View>
        </View>
    );
});

const SummaryBox = React.memo(({ title, value, subtext, icon, color }: any) => (
    <View style={styles.summaryBox}>
        <View style={[styles.summaryIconBox, { backgroundColor: color + '15' }]}>
            <Ionicons name={icon} size={22} color={color} />
        </View>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryTitle}>{title}</Text>
        <Text style={styles.summarySubtext}>{subtext}</Text>
    </View>
));

const getKeys = (userId: string | number) => ({
    PUNCH_IN: `PUNCH_IN_TIMESTAMP_${userId}`,
    WORK_HISTORY: `WORK_HISTORY_${userId}`,
    PAUSED_TIME: `PAUSED_TIME_${userId}`,
    PAUSED_DATE: `PAUSED_DATE_${userId}`
});

interface WorkSession {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    totalWorkSeconds: number;
}

interface AttendanceRecord {
    id: number;
    date: string;
    punch_in_time: string | null;
    punch_in_location: string | null;
    punch_out_time: string | null;
    punch_out_location: string | null;
    status_display: string;
}

export default function Dashboard() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPunchedIn, setIsPunchedIn] = useState(false);

    const [workHistory, setWorkHistory] = useState<WorkSession[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [showAllAttendance, setShowAllAttendance] = useState(false);
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isPunching, setIsPunching] = useState(false);

    useEffect(() => { loadUserData(); }, []);

    const loadUserData = async () => {
        try {
            const userData = await AsyncStorage.getItem('user_data');
            if (userData) {
                const loginTimestamp = await AsyncStorage.getItem('login_timestamp');
                const now = Date.now();
                if (!loginTimestamp || (now - parseInt(loginTimestamp, 10)) > 22 * 60 * 60 * 1000) {
                    Alert.alert("Session Expired", "Please login again.");
                    await handleLogout();
                    return;
                }
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                await loadState(parsedUser.id);
                fetchAttendanceRecords(parsedUser); // Run network request in background without blocking UI
            } else {
                Alert.alert("Session Expired", "Please login again.");
                router.replace('/');
            }
        } catch (e) {
            console.error("Failed to load user", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchAttendanceRecords = async (currentUser = user) => {
        setLoadingAttendance(true);
        try {
            const authToken = await AsyncStorage.getItem('auth_token');
            if (!authToken) return;

            const response = await fetch(`${Config.API_BASE_URL}/attendance/my_records/?t=${Date.now()}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                },
            });

            if (!response.ok) return;

            const data = await response.json();
            const records: AttendanceRecord[] = data.map((record: any) => ({
                id: record.id,
                date: record.date,
                punch_in_time: record.punch_in_time,
                punch_in_location: record.punch_in_location,
                punch_out_time: record.punch_out_time,
                punch_out_location: record.punch_out_location,
                status_display: record.status_display,
            }));
            setAttendanceRecords(records);

            if (currentUser) {
                const keys = getKeys(currentUser.id);
                const todayLocal = new Date();
                const todayStr = [
                    todayLocal.getFullYear(),
                    String(todayLocal.getMonth() + 1).padStart(2, '0'),
                    String(todayLocal.getDate()).padStart(2, '0'),
                ].join('-');

                const todayActiveRecord = records.find(r => {
                    if (!r.punch_in_time) return false;
                    const recordDate = new Date(r.punch_in_time);
                    if (isNaN(recordDate.getTime()) && r.date) {
                        if (r.date !== todayStr) return false;
                    } else if (!isNaN(recordDate.getTime())) {
                        const isToday = recordDate.getFullYear() === todayLocal.getFullYear() &&
                                        recordDate.getMonth() === todayLocal.getMonth() &&
                                        recordDate.getDate() === todayLocal.getDate();
                        if (!isToday) return false;
                    }

                    if (!r.punch_out_time) return true;
                    
                    const outTimeDate = new Date(r.punch_out_time);
                    if (isNaN(outTimeDate.getTime())) return true;
                    
                    return recordDate.getTime() > outTimeDate.getTime();
                });

                if (todayActiveRecord) {
                    const serverMs = new Date(todayActiveRecord.punch_in_time!).getTime();
                    const localTs = await AsyncStorage.getItem(keys.PUNCH_IN);
                    if (!localTs) {
                        await AsyncStorage.setItem(keys.PUNCH_IN, serverMs.toString());
                    }
                    setIsPunchedIn(true);
                }
            }
        } catch (error) {
            console.error("Error fetching attendance records:", error);
        } finally {
            setLoadingAttendance(false);
        }
    };


    const loadState = async (userId: string | number) => {
        try {
            const keys = getKeys(userId);
            const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);

            if (storedPunchIn) {
                const punchInDate = new Date(parseInt(storedPunchIn, 10));
                const now = new Date();
                const isToday =
                    punchInDate.getFullYear() === now.getFullYear() &&
                    punchInDate.getMonth()    === now.getMonth()    &&
                    punchInDate.getDate()     === now.getDate();

                if (isToday) {
                    setIsPunchedIn(true);
                } else {
                    await AsyncStorage.removeItem(keys.PUNCH_IN);
                    setIsPunchedIn(false);
                }
            } else {
                setIsPunchedIn(false);
            }

            const historyJson = await AsyncStorage.getItem(keys.WORK_HISTORY);
            if (historyJson) setWorkHistory(JSON.parse(historyJson));
        } catch (e) {
            console.error("Failed to load state", e);
        }
    };

    const getCurrentLocation = async () => {
        try {
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                Alert.alert("Location Services Disabled", "Please enable location services to punch in/out.");
                return null;
            }

            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Location permission is required to punch in/out.");
                return null;
            }

            let locationResult: Location.LocationObject | null = null;

            try {
                const last = await Location.getLastKnownPositionAsync({});
                if (last) {
                    const ageMs = Date.now() - last.timestamp;
                    const freshEnough = ageMs <= 10 * 60 * 1000;
                    const accuracyOk = !last.coords.accuracy || last.coords.accuracy <= 500;
                    if (freshEnough && accuracyOk) {
                        locationResult = last;
                    }
                }
            } catch (_) { }

            if (!locationResult) {
                const accuracy = Location.Accuracy.Balanced;
                let bestSoFar: Location.LocationObject | null = null;

                const gpsPromise = (async () => {
                    for (let i = 0; i < 2; i++) {
                        const fix = await Location.getCurrentPositionAsync({ accuracy });
                        bestSoFar = fix;
                        if (!fix.coords.accuracy || fix.coords.accuracy <= 200) return fix;
                        if (i < 1) await new Promise(r => setTimeout(r, 1000));
                    }
                    return bestSoFar;
                })();

                const timeoutPromise = new Promise<null>(resolve =>
                    setTimeout(() => resolve(null), 15_000)
                );

                const result = await Promise.race([gpsPromise, timeoutPromise]);
                locationResult = result ?? bestSoFar;
            }

            if (!locationResult) {
                Alert.alert(
                    "Location Unavailable",
                    "Could not get your location within 15 seconds. Please check GPS signal and try again."
                );
                return null;
            }

            const { latitude, longitude } = locationResult.coords;

            let formattedAddress = `Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`;
            try {
                const geocodeResult = await Promise.race([
                    Location.reverseGeocodeAsync({ latitude, longitude }),
                    new Promise<null>(resolve => setTimeout(() => resolve(null), 5_000)),
                ]);
                if (geocodeResult && geocodeResult.length > 0) {
                    const addr = geocodeResult[0];
                    const parts = [addr.name, addr.street, addr.city, addr.region, addr.country].filter(Boolean);
                    if (parts.length > 0) formattedAddress = parts.join(', ');
                }
            } catch (geoError) {
                console.warn("Reverse geocoding failed, using coordinates:", geoError);
            }

            return { latitude, longitude, address: formattedAddress };
        } catch (error: any) {
            console.error("Error getting location:", error);
            Alert.alert("Location Error", `Failed to get your current location. ${error?.message || ''}`);
            return null;
        }
    };

    const togglePunch = async () => {
        if (!user || isPunching) return;
        
        const keys = getKeys(user.id);
        const authToken = await AsyncStorage.getItem('auth_token');
        if (!authToken) {
            Alert.alert("Authentication Error", "Please log in again.");
            return;
        }

        const wasPunchedIn = isPunchedIn;
        const targetState = !wasPunchedIn;

        // 🚀 OPTIMISTIC UPDATE: Instantly flip the button and start/stop the timer!
        setIsPunchedIn(targetState);
        if (targetState) {
            await AsyncStorage.setItem(keys.PUNCH_IN, Date.now().toString());
            // Do not remove PAUSED_TIME here, we need it to accumulate today's total hours!
        } else {
            const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
            if (storedPunchIn) {
                const currentSessionSeconds = Math.max(0, Math.floor((Date.now() - parseInt(storedPunchIn, 10)) / 1000));
                
                let baseSeconds = 0;
                const pausedDate = await AsyncStorage.getItem(keys.PAUSED_DATE);
                const todayStr = getLocalTodayString();
                if (pausedDate === todayStr) {
                    const pausedSecs = await AsyncStorage.getItem(keys.PAUSED_TIME);
                    if (pausedSecs) baseSeconds = parseInt(pausedSecs, 10);
                }
                
                const newTotalSeconds = baseSeconds + currentSessionSeconds;
                await AsyncStorage.setItem(keys.PAUSED_TIME, newTotalSeconds.toString());
                await AsyncStorage.setItem(keys.PAUSED_DATE, todayStr);
            }
            await AsyncStorage.removeItem(keys.PUNCH_IN);
        }

        // Lock button internally without showing a spinner
        setIsPunching(true);

        // Run location and network in background
        (async () => {
            try {
                const locationData = await getCurrentLocation();
                if (!locationData) {
                    // Revert on location failure
                    setIsPunchedIn(wasPunchedIn);
                    if (wasPunchedIn) await AsyncStorage.setItem(keys.PUNCH_IN, Date.now().toString());
                    else await AsyncStorage.removeItem(keys.PUNCH_IN);
                    return;
                }

                const url = `${Config.API_BASE_URL}/attendance/${targetState ? 'punch_in' : 'punch_out'}/`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
                    body: JSON.stringify({
                        location: locationData.address,
                        latitude: locationData.latitude.toString(),
                        longitude: locationData.longitude.toString(),
                    }),
                });

                const data = await response.json();
                if (!response.ok || data.error || data.status === 'error' || data.success === false) {
                    const errorMsg = data.message || data.error || data.detail || (typeof data === 'string' ? data : JSON.stringify(data));
                    
                    if (targetState && errorMsg.toLowerCase().includes("already") && errorMsg.toLowerCase().includes("punched in")) {
                        // Already synced!
                    } else if (!targetState && errorMsg.toLowerCase().includes("already") && errorMsg.toLowerCase().includes("punched out")) {
                        // Already synced!
                    } else {
                        // Revert on API failure
                        setIsPunchedIn(wasPunchedIn);
                        if (wasPunchedIn) await AsyncStorage.setItem(keys.PUNCH_IN, Date.now().toString());
                        else await AsyncStorage.removeItem(keys.PUNCH_IN);
                        Alert.alert(`Punch ${targetState ? 'In' : 'Out'} Failed`, errorMsg);
                    }
                    return;
                }

                // Success!
                if (targetState) {
                    lastPunchInActionTime = Date.now();
                }
                
                // Silently refresh the list
                fetchAttendanceRecords();
            } catch (error) {
                // Revert on network failure
                setIsPunchedIn(wasPunchedIn);
                if (wasPunchedIn) await AsyncStorage.setItem(keys.PUNCH_IN, Date.now().toString());
                else await AsyncStorage.removeItem(keys.PUNCH_IN);
                Alert.alert("Network Error", "Failed to connect to server. Your punch was not recorded.");
            } finally {
                // Unlock button
                setIsPunching(false);
            }
        })();
    };

    const handleLogout = async () => {
        setIsProfileVisible(false);
        await AsyncStorage.multiRemove(['auth_token', 'user_data', 'login_timestamp']);
        router.replace('/');
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        loadUserData().then(() => setRefreshing(false));
    }, []);

    const getUserName = () => user?.name || user?.email?.split('@')[0] || 'User';
    const getUserInitial = () => getUserName().charAt(0).toUpperCase();

    const punchBg = isPunchedIn ? Colors.success : Colors.primary;
    const punchRingBorder = isPunchedIn ? 'rgba(22,163,74,0.3)' : 'rgba(199,36,6,0.25)';

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.loadingText}>Loading Dashboard…</Text>
            </SafeAreaView>
        );
    }

    const todayStr = getLocalTodayString();
    const filteredRecords = [...attendanceRecords].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ).filter(r => showAllAttendance || r.date === todayStr);

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
            <StatusBar barStyle="dark-content" backgroundColor={Colors.surface} translucent={false} />
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View>
                    <Image 
                        source={require('../assets/images/logo.jpg')} 
                        style={styles.headerLogo} 
                        contentFit="contain" 
                    />
                </View>
                <TouchableOpacity onPress={() => setIsProfileVisible(true)} style={styles.avatarButton}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarInitial}>{getUserInitial()}</Text>
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Hero: date + status ── */}
                <View style={styles.heroSection}>
                    <LiveClock />
                    <View style={[styles.statusChip, {
                        backgroundColor: isPunchedIn ? Colors.successLight : Colors.primarySurface
                    }]}>
                        <View style={[styles.statusDot, {
                            backgroundColor: isPunchedIn ? Colors.success : Colors.primary
                        }]} />
                        <Text style={[styles.statusChipText, {
                            color: isPunchedIn ? Colors.success : Colors.primary
                        }]}>
                            {isPunchedIn ? 'Clocked In' : 'Not Clocked In'}
                        </Text>
                    </View>
                </View>

                {/* ── Work Timer ── */}
                <LiveTimer isPunchedIn={isPunchedIn} user={user} />

                {/* ── Punch Button ── */}
                <View style={styles.punchSection}>
                    {/* Outer decorative ring */}
                    <View style={[styles.punchOuterRing, { borderColor: punchRingBorder }]}>
                        <TouchableOpacity
                            style={[
                                styles.punchButton,
                                { backgroundColor: punchBg, shadowColor: punchBg }
                            ]}
                            onPress={togglePunch}
                            disabled={isPunching}
                            activeOpacity={0.82}
                        >
                            <View style={styles.punchInnerRing}>
                                {isPunching ? (
                                    <ActivityIndicator size="large" color={Colors.white} />
                                ) : (
                                    <>
                                        <Ionicons
                                            name={isPunchedIn ? 'stop-circle' : 'finger-print'}
                                            size={54}
                                            color={Colors.white}
                                        />
                                        <Text style={styles.punchLabel}>
                                            {isPunchedIn ? 'PUNCH OUT' : 'PUNCH IN'}
                                        </Text>
                                        <Text style={styles.punchSublabel}>
                                            {isPunchedIn ? 'Tap to clock out' : 'Tap to clock in'}
                                        </Text>
                                    </>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.officeTagRow}>
                        <Ionicons name="location-sharp" size={13} color={Colors.textTertiary} />
                        <Text style={styles.officeTagText}>Office HQ • Tirur, Kerala</Text>
                    </View>
                </View>

                {/* ── Services ── */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>My Services</Text>
                    <View style={styles.servicesRow}>
                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'leave' } })}
                        >
                            <View style={[styles.serviceIcon, { backgroundColor: '#EFF6FF' }]}>
                                <Ionicons name="calendar" size={24} color="#2563EB" />
                            </View>
                            <Text style={styles.serviceLabel}>Leave</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'late' } })}
                        >
                            <View style={[styles.serviceIcon, { backgroundColor: '#FFFBEB' }]}>
                                <Ionicons name="time" size={24} color="#D97706" />
                            </View>
                            <Text style={styles.serviceLabel}>Late Req</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'early' } })}
                        >
                            <View style={[styles.serviceIcon, { backgroundColor: '#F5F3FF' }]}>
                                <Ionicons name="exit" size={24} color="#7C3AED" />
                            </View>
                            <Text style={styles.serviceLabel}>Early Req</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Attendance Log ── */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Attendance Log</Text>
                        <TouchableOpacity
                            onPress={() => setShowAllAttendance(!showAllAttendance)}
                            style={styles.toggleButton}
                        >
                            <Text style={styles.toggleButtonText}>
                                {showAllAttendance ? 'Today' : 'All'}
                            </Text>
                            <Ionicons
                                name={showAllAttendance ? 'chevron-up' : 'chevron-down'}
                                size={16}
                                color={Colors.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    {loadingAttendance ? (
                        <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 30 }} />
                    ) : (
                        (() => {
                            const sorted = [...attendanceRecords].sort(
                                (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
                            );
                            const todayStr = new Date().toISOString().split('T')[0];
                            const displayed = showAllAttendance ? sorted : sorted.filter(r => r.date === todayStr);

                            if (displayed.length === 0) {
                                return (
                                    <View style={styles.emptyState}>
                                        <Ionicons name="calendar-outline" size={36} color={Colors.textTertiary} />
                                        <Text style={styles.emptyText}>
                                            {showAllAttendance ? 'No attendance records found.' : 'No records for today yet.'}
                                        </Text>
                                    </View>
                                );
                            }

                            return displayed.map(record => {
                                return <AttendanceCardItem key={record.id} record={record} />;
                            });
                        })()
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── Profile Modal ── */}
            <Modal
                animationType="fade"
                transparent
                visible={isProfileVisible}
                onRequestClose={() => setIsProfileVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsProfileVisible(false)}
                >
                    <View style={styles.modalCard}>
                        {/* Avatar */}
                        <View style={styles.modalAvatar}>
                            <Text style={styles.modalAvatarText}>{getUserInitial()}</Text>
                        </View>
                        <Text style={styles.modalName}>{user?.name || 'Unknown'}</Text>
                        <Text style={styles.modalEmail}>{user?.email || ''}</Text>
                        <View style={styles.modalIdBadge}>
                            <Text style={styles.modalIdText}>ID: {user?.id}</Text>
                        </View>

                        <View style={styles.modalDivider} />

                        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={20} color={Colors.error} />
                            <Text style={styles.logoutBtnText}>Logout</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeBtn} onPress={() => setIsProfileVisible(false)}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
// Dimensions
// ─────────────────────────────────────────────
const { width } = Dimensions.get('window');
const BUTTON_SIZE = width * 0.60;
const RING_SIZE = BUTTON_SIZE + 36;

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    // ── Layout
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.background,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 15,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingBottom: 20,
        alignItems: 'center',
    },

    // ── Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 20,
        paddingLeft: 0,
        paddingTop: 10,
        paddingBottom: 14,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderLight,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 4,
    },
    headerLogo: {
        width: 140,
        height: 45,
        marginLeft: -20,
    },
    avatarButton: {
        padding: 2,
    },
    avatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primarySurface,
        borderWidth: 2,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitial: {
        fontSize: 18,
        fontWeight: '800',
        color: Colors.primary,
    },

    // ── Hero
    heroSection: {
        alignItems: 'center',
        paddingTop: 32,
        paddingBottom: 20,
        width: '100%',
    },
    liveTime: {
        fontSize: 56,
        fontWeight: '200',
        color: Colors.text,
        letterSpacing: -1,
        lineHeight: 62,
    },
    liveDate: {
        fontSize: 14,
        color: Colors.textSecondary,
        fontWeight: '500',
        marginTop: 4,
        marginBottom: 16,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        gap: 7,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusChipText: {
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // ── Timer Card
    timerCard: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        paddingVertical: 22,
        paddingHorizontal: 20,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    timerCardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textTertiary,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        textAlign: 'center',
        marginBottom: 14,
    },
    timerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timerBlock: {
        alignItems: 'center',
        minWidth: 72,
    },
    timerDigit: {
        fontSize: 42,
        fontWeight: '700',
        color: Colors.textTertiary,
        fontVariant: ['tabular-nums'],
    },
    timerDigitActive: {
        color: Colors.text,
    },
    timerUnit: {
        fontSize: 10,
        fontWeight: '700',
        color: Colors.textTertiary,
        letterSpacing: 1,
        marginTop: 2,
    },
    timerSep: {
        fontSize: 36,
        fontWeight: '300',
        color: Colors.border,
        marginHorizontal: 4,
        marginBottom: 12,
    },

    // ── Punch Button
    punchSection: {
        alignItems: 'center',
        marginBottom: 28,
    },
    punchOuterRing: {
        width: RING_SIZE,
        height: RING_SIZE,
        borderRadius: RING_SIZE / 2,
        borderWidth: 3,
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    punchButton: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.40,
        shadowRadius: 28,
        elevation: 18,
    },
    punchInnerRing: {
        width: BUTTON_SIZE - 22,
        height: BUTTON_SIZE - 22,
        borderRadius: (BUTTON_SIZE - 22) / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    punchLabel: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginTop: 10,
    },
    punchSublabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        fontWeight: '500',
        marginTop: 4,
    },
    officeTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    officeTagText: {
        fontSize: 12,
        color: Colors.textTertiary,
        fontWeight: '500',
    },

    // ── Section Cards
    sectionCard: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 4,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text,
        letterSpacing: 0.2,
        marginBottom: 16,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: Colors.primarySurface,
        borderRadius: 12,
    },
    toggleButtonText: {
        fontSize: 13,
        color: Colors.primary,
        fontWeight: '700',
    },

    // ── Services
    servicesRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    serviceItem: {
        alignItems: 'center',
        flex: 1,
    },
    serviceIcon: {
        width: 58,
        height: 58,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.textSecondary,
    },

    // ── Attendance
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
        gap: 10,
    },
    emptyText: {
        fontSize: 14,
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },
    attendanceCard: {
        backgroundColor: Colors.cardAlt,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: Colors.borderLight,
    },
    attendanceCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    attendanceDateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    attendanceDateText: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text,
    },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 10,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.3,
    },
    timeRowsContainer: {
        gap: 10,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    timeRowDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
    },
    timeRowInfo: {
        flex: 1,
    },
    timeRowLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 2,
    },
    timeRowValue: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
    },
    timeRowValueMuted: {
        color: Colors.success,
    },
    timeRowLocation: {
        fontSize: 11,
        color: Colors.textSecondary,
        marginTop: 2,
        fontStyle: 'italic',
    },
    timeRowDivider: {
        height: 1,
        backgroundColor: Colors.border,
        marginLeft: 22,
    },

    // ── Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: Colors.overlay,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCard: {
        width: '82%',
        backgroundColor: Colors.surface,
        borderRadius: 24,
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.25,
        shadowRadius: 40,
        elevation: 20,
    },
    modalAvatar: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.primarySurface,
        borderWidth: 3,
        borderColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 14,
    },
    modalAvatarText: {
        fontSize: 32,
        fontWeight: '800',
        color: Colors.primary,
    },
    modalName: {
        fontSize: 20,
        fontWeight: '800',
        color: Colors.text,
    },
    modalEmail: {
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    modalIdBadge: {
        marginTop: 8,
        backgroundColor: Colors.cardAlt,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 10,
    },
    modalIdText: {
        fontSize: 12,
        color: Colors.textTertiary,
        fontWeight: '700',
    },
    modalDivider: {
        width: '100%',
        height: 1,
        backgroundColor: Colors.border,
        marginVertical: 20,
    },
    logoutBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.errorLight,
        paddingVertical: 13,
        paddingHorizontal: 28,
        borderRadius: 14,
        gap: 10,
        width: '100%',
        justifyContent: 'center',
        marginBottom: 12,
    },
    logoutBtnText: {
        color: Colors.error,
        fontWeight: '800',
        fontSize: 16,
    },
    closeBtn: {
        paddingVertical: 10,
    },
    closeBtnText: {
        fontSize: 15,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
});

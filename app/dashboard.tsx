import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Stack, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Modal, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { Config } from '../constants/Config';

// Office Location Constants
const OFFICE_LATITUDE = 10.921105;   // Tirur latitude
const OFFICE_LONGITUDE = 75.925967;  // Tirur longitude
const ALLOWED_RADIUS_METERS = 200;    // 100 meters radius

// Storage Keys Helper
const getKeys = (userId: string | number) => ({
    PUNCH_IN: `PUNCH_IN_TIMESTAMP_${userId}`,
    WORK_HISTORY: `WORK_HISTORY_${userId}`
});

interface BreakLog {
    id: string;
    startTime: string;
    endTime: string | null;
    duration: string;
}

interface WorkSession {
    id: string;
    date: string; // "YYYY-MM-DD"
    startTime: string; // ISO
    endTime: string; // ISO
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

    // User State
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const [isPunchedIn, setIsPunchedIn] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [elapsedSeconds, setElapsedSeconds] = useState(0);

    // History
    const [workHistory, setWorkHistory] = useState<WorkSession[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [loadingAttendance, setLoadingAttendance] = useState(false);
    const [showAllAttendance, setShowAllAttendance] = useState(false);

    // UI State
    const [isProfileVisible, setIsProfileVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isPunching, setIsPunching] = useState(false);

    // Load User & State
    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            const userData = await AsyncStorage.getItem('user_data');

            if (userData) {
                const loginTimestamp = await AsyncStorage.getItem('login_timestamp');
                const now = Date.now();
                const twentyTwoHoursInMs = 22 * 60 * 60 * 1000;

                if (!loginTimestamp || (now - parseInt(loginTimestamp, 10)) > twentyTwoHoursInMs) {
                    Alert.alert("Session Expired", "Session expired. Please login again.");
                    await handleLogout();
                    return;
                }

                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                await loadState(parsedUser.id);
                await fetchAttendanceRecords(parsedUser); // Fetch attendance records with fresh user data
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
            if (!authToken) {
                console.error("No auth token found");
                return;
            }

            const response = await fetch(`${Config.API_BASE_URL}/attendance/my_records/`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                console.error("Failed to fetch attendance records:", response.status);
                return;
            }

            const data = await response.json();

            // Map the API response to our interface
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

            // Check for ANY active session today
            if (currentUser && data.length > 0) {
                const todayDate = new Date().toISOString().split('T')[0];
                const todayRecords = data.filter((record: any) => record.date === todayDate);

                // Find if there is an active session (punched in but not out)
                const activeRecord = todayRecords.find((record: any) => record.punch_in_time && !record.punch_out_time);

                const keys = getKeys(currentUser.id);

                if (activeRecord) {
                    // User is actively punched in
                    const localPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
                    if (!localPunchIn) {
                        // Convert API time to timestamp
                        const punchInTimestamp = new Date(activeRecord.punch_in_time).getTime().toString();
                        await AsyncStorage.setItem(keys.PUNCH_IN, punchInTimestamp);
                    }
                    setIsPunchedIn(true);
                } else {
                    // No active session found for today
                    await AsyncStorage.removeItem(keys.PUNCH_IN);
                    setIsPunchedIn(false);
                    setElapsedSeconds(0);
                }
            }
        } catch (error) {
            console.error("Error fetching attendance records:", error);
        } finally {
            setLoadingAttendance(false);
        }
    };

    // Clock
    useEffect(() => {
        const clockTimer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(clockTimer);
    }, []);

    // Stopwatch Logic
    useEffect(() => {
        if (!user) return;

        let stopwatchTimer: NodeJS.Timeout;
        const keys = getKeys(user.id);

        const updateTimer = async () => {
            try {
                if (!isPunchedIn) {
                    setElapsedSeconds(0);
                    return;
                }

                const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
                if (!storedPunchIn) return;

                const punchInTime = parseInt(storedPunchIn, 10);
                const now = Date.now();
                const diff = Math.floor((now - punchInTime) / 1000);
                setElapsedSeconds(diff >= 0 ? diff : 0);
            } catch (e) {
                console.warn("Timer update error:", e);
            }
        };

        updateTimer();
        stopwatchTimer = setInterval(updateTimer, 1000);

        return () => {
            if (stopwatchTimer) clearInterval(stopwatchTimer);
        };
    }, [isPunchedIn, user]);

    const loadState = async (userId: string | number) => {
        try {
            const keys = getKeys(userId);

            // Load Active State
            const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
            setIsPunchedIn(!!storedPunchIn);

            // Load History
            const historyJson = await AsyncStorage.getItem(keys.WORK_HISTORY);
            if (historyJson) {
                setWorkHistory(JSON.parse(historyJson));
            }

        } catch (e) {
            console.error("Failed to load state", e);
        }
    };

    // Calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    };

    // Get current location with formatted address
    const getCurrentLocation = async () => {
        try {
            // Check if location services are enabled
            const enabled = await Location.hasServicesEnabledAsync();
            if (!enabled) {
                Alert.alert("Location Services Disabled", "Please enable location services to punch in/out.");
                return null;
            }

            // Request permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert("Permission Denied", "Location permission is required to punch in/out.");
                return null;
            }

            // Get current position
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            // Get formatted address
            const geocode = await Location.reverseGeocodeAsync({
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            });

            let formattedAddress = "Unknown Location";
            if (geocode && geocode.length > 0) {
                const addr = geocode[0];
                const parts = [
                    addr.name,
                    addr.street,
                    addr.city,
                    addr.region,
                    addr.country
                ].filter(Boolean);
                formattedAddress = parts.join(', ');
            }

            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                address: formattedAddress,
            };
        } catch (error: any) {
            console.error("Error getting location:", error);
            Alert.alert("Location Error", `Failed to get your current location. ${error?.message || ''}`);
            return null;
        }
    };

    const togglePunch = async () => {
        if (!user || isPunching) return;

        setIsPunching(true);
        const keys = getKeys(user.id);

        try {
            // Get auth token
            const authToken = await AsyncStorage.getItem('auth_token');
            if (!authToken) {
                Alert.alert("Authentication Error", "Please login again.");
                router.replace('/');
                return;
            }

            if (isPunchedIn) {
                // --- PUNCH OUT LOGIC ---

                // Get current location (no radius restriction for punch out)
                const locationData = await getCurrentLocation();
                if (!locationData) return;

                // Call Punch Out API
                try {
                    const response = await fetch(`${Config.API_BASE_URL}/attendance/punch_out/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                            location: locationData.address,
                            latitude: locationData.latitude.toString(),
                            longitude: locationData.longitude.toString(),
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        console.error("Punch out API error:", data);
                        const errorMsg = JSON.stringify(data);
                        Alert.alert("Punch Out Debug", `Status: ${response.status}\nResponse: ${errorMsg}`);
                        return;
                    }

                    // Calculate final details for local storage
                    const storedPunchIn = await AsyncStorage.getItem(keys.PUNCH_IN);
                    if (storedPunchIn) {
                        const punchInTime = parseInt(storedPunchIn, 10);
                        const endTime = Date.now();
                        const totalWorkMs = endTime - punchInTime;
                        const totalWorkSeconds = Math.floor(totalWorkMs / 1000);

                        // Create Session Object
                        const session: WorkSession = {
                            id: Date.now().toString(),
                            date: new Date().toISOString().split('T')[0],
                            startTime: new Date(punchInTime).toISOString(),
                            endTime: new Date(endTime).toISOString(),
                            totalWorkSeconds: totalWorkSeconds < 0 ? 0 : totalWorkSeconds,
                        };

                        // Update History
                        const existingHistoryStr = await AsyncStorage.getItem(keys.WORK_HISTORY);
                        const existingHistory: WorkSession[] = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
                        const updatedHistory = [session, ...existingHistory];

                        // Keep only last 3 days
                        const threeDaysAgo = new Date();
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                        const minDate = threeDaysAgo.toISOString().split('T')[0];
                        const filteredHistory = updatedHistory.filter(s => s.date >= minDate);

                        await AsyncStorage.setItem(keys.WORK_HISTORY, JSON.stringify(filteredHistory));
                        setWorkHistory(filteredHistory);

                        Alert.alert("Punched Out Successfully", `Session Saved.\nWork Time: ${formatDuration(totalWorkSeconds < 0 ? 0 : totalWorkSeconds).label}`);
                    } else {
                        Alert.alert("Punched Out Successfully", "Your punch out has been recorded.");
                    }

                    // Clear Active State
                    await AsyncStorage.removeItem(keys.PUNCH_IN);
                    setIsPunchedIn(false);
                    setElapsedSeconds(0);

                    // Refresh attendance records to sync state
                    await fetchAttendanceRecords();

                } catch (error) {
                    console.error("Punch out network error:", error);
                    Alert.alert("Network Error", "Failed to connect to server. Please check your internet connection.");
                }

            } else {
                // --- PUNCH IN LOGIC ---

                // Get current location
                const locationData = await getCurrentLocation();
                if (!locationData) return;

                // Check if user is within 100m radius of office
                const distance = calculateDistance(
                    locationData.latitude,
                    locationData.longitude,
                    OFFICE_LATITUDE,
                    OFFICE_LONGITUDE
                );

                if (distance > ALLOWED_RADIUS_METERS) {
                    Alert.alert(
                        "Location Mismatch",
                        `You must be within ${ALLOWED_RADIUS_METERS}m of the office to punch in.\nCurrent distance: ${Math.round(distance)}m`
                    );
                    return;
                }

                // Call Punch In API
                try {
                    const response = await fetch(`${Config.API_BASE_URL}/attendance/punch_in/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${authToken}`,
                        },
                        body: JSON.stringify({
                            location: locationData.address,
                            latitude: locationData.latitude.toString(),
                            longitude: locationData.longitude.toString(),
                        }),
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        console.error("Punch in API error:", data);
                        // Show more detailed error for debugging
                        const errorMsg = JSON.stringify(data);
                        Alert.alert("Punch In Debug", `Status: ${response.status}\nResponse: ${errorMsg}`);
                        return;
                    }

                    // Save punch in time locally
                    const now = Date.now().toString();
                    await AsyncStorage.setItem(keys.PUNCH_IN, now);
                    setIsPunchedIn(true);

                    Alert.alert("Punched In Successfully", "Your attendance has been recorded.");

                    // Refresh attendance records to sync state
                    await fetchAttendanceRecords();

                } catch (error) {
                    console.error("Punch in network error:", error);
                    Alert.alert("Network Error", "Failed to connect to server. Please check your internet connection.");
                }
            }
        } catch (e) {
            console.error("Failed to toggle punch state", e);
            Alert.alert("Error", "An unexpected error occurred. Please try again.");
        } finally {
            setIsPunching(false);
        }
    };

    const handleLogout = async () => {
        setIsProfileVisible(false);
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user_data');
        await AsyncStorage.removeItem('login_timestamp');
        router.replace('/');
    };

    const formatDuration = (totalSeconds: number) => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const hStr = hours.toString().padStart(2, '0');
        const mStr = minutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');

        return {
            hours: hStr,
            minutes: mStr,
            seconds: sStr,
            label: `${hStr}:${mStr}:${sStr}`
        };
    };

    const formatDateTime = (isoString: string | null) => {
        if (!isoString) return 'N/A';
        try {
            const date = new Date(isoString);
            const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `${dateStr}, ${timeStr}`;
        } catch (e) {
            return 'Invalid Date';
        }
    };

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        loadUserData().then(() => setRefreshing(false));
    }, []);

    const formattedTime = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    const formattedDate = currentTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    const duration = formatDuration(elapsedSeconds);

    // Button States
    const punchButtonColor = isPunchedIn ? Colors.primary : Colors.success;
    const punchButtonText = isPunchedIn ? "PUNCH OUT" : "PUNCH IN";

    // Status Logic
    let statusText = "Not Punched In";
    let statusDotColor = Colors.primary;
    if (isPunchedIn) {
        statusText = "Punched In";
        statusDotColor = Colors.success;
    }

    // Greeting name
    const getUserName = () => {
        if (user && user.email) {
            return user.name || user.email.split('@')[0];
        }
        return "User";
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.loadingContainer}>
                <Text>Loading Dashboard...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.headerBar}>
                <TouchableOpacity onPress={() => setIsProfileVisible(true)} style={styles.profileButton}>
                    <Ionicons name="person-circle-outline" size={40} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >

                <View style={styles.topSection}>
                    {/* <Text style={styles.greetingText}>GOOD MORNING, {getUserName()}</Text>
                    <Text style={styles.largeTimeText}>{formattedTime}</Text> */}

                    <View style={styles.statusRow}>
                        <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                        <Text style={styles.statusText}>{statusText} • {formattedDate}</Text>
                    </View>
                </View>

                <View style={styles.timerContainer}>
                    <View style={styles.timerBox}>
                        <Text style={styles.timerValue}>{duration.hours}</Text>
                        <Text style={styles.timerLabel}>HOURS</Text>
                    </View>
                    <View style={styles.timerBox}>
                        <Text style={styles.timerValue}>{duration.minutes}</Text>
                        <Text style={styles.timerLabel}>MINUTES</Text>
                    </View>
                    <View style={styles.timerBox}>
                        <Text style={styles.timerValue}>{duration.seconds}</Text>
                        <Text style={styles.timerLabel}>SECONDS</Text>
                    </View>
                </View>

                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.circularButton, { backgroundColor: punchButtonColor, opacity: isPunching ? 0.7 : 1 }]}
                        onPress={togglePunch}
                        activeOpacity={0.8}
                        disabled={isPunching}
                    >
                        <View style={styles.innerCircleOutline}>
                            {isPunching ? (
                                <ActivityIndicator size="large" color={Colors.white} />
                            ) : (
                                <>
                                    <Ionicons name="finger-print" size={50} color={Colors.white} />
                                    <Text style={styles.buttonText}>{punchButtonText}</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Work History (Last 3 Days) */}
                {/* {!isPunchedIn && (
                    <View style={styles.bottomPanel}>
                        <Text style={styles.bottomPanelTitle}>Recent Work History (Last 3 Days)</Text>
                        {workHistory.length > 0 ? (
                            workHistory.map((session) => (
                                <View key={session.id} style={styles.historyItem}>
                                    <View style={styles.historyHeader}>
                                        <Text style={styles.historyDate}>{session.date}</Text>
                                        <Text style={styles.historyTotal}>Total: {formatDuration(session.totalWorkSeconds).label}</Text>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <Text style={styles.emptyLogsText}>No recent work history.</Text>
                        )}
                    </View>
                )} */}

                {/* Services Section */}
                <View style={styles.servicesContainer}>
                    <Text style={styles.bottomPanelTitle}>My Services</Text>
                    <View style={styles.servicesGrid}>
                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'leave' } })}
                        >
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#E3F2FD' }]}>
                                <Ionicons name="calendar" size={24} color="#1E88E5" />
                            </View>
                            <Text style={styles.serviceText}>Leave</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'late' } })}
                        >
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#FFF3E0' }]}>
                                <Ionicons name="time" size={24} color="#FB8C00" />
                            </View>
                            <Text style={styles.serviceText}>Late Req</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.serviceItem}
                            onPress={() => router.push({ pathname: '/requests', params: { type: 'early' } })}
                        >
                            <View style={[styles.serviceIconContainer, { backgroundColor: '#F3E5F5' }]}>
                                <Ionicons name="exit" size={24} color="#8E24AA" />
                            </View>
                            <Text style={styles.serviceText}>Early Req</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Attendance Log Section */}
                <View style={styles.attendancePanel}>
                    <View style={styles.attendancePanelHeader}>
                        <Text style={styles.bottomPanelTitle}>Attendance Log</Text>
                        <TouchableOpacity
                            onPress={() => setShowAllAttendance(!showAllAttendance)}
                            style={styles.expandButton}
                        >
                            <Text style={styles.expandButtonText}>
                                {showAllAttendance ? 'Show Today' : 'Show All'}
                            </Text>
                            <Ionicons
                                name={showAllAttendance ? "chevron-up" : "chevron-down"}
                                size={20}
                                color={Colors.primary}
                            />
                        </TouchableOpacity>
                    </View>

                    {loadingAttendance ? (
                        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 20 }} />
                    ) : (
                        (() => {
                            // Sort records: Newest first
                            const sortedRecords = [...attendanceRecords].sort((a, b) =>
                                new Date(b.date).getTime() - new Date(a.date).getTime()
                            );

                            // Filter based on state
                            const displayedRecords = showAllAttendance
                                ? sortedRecords
                                : sortedRecords.filter(r => r.date === new Date().toISOString().split('T')[0]);

                            if (displayedRecords.length === 0) {
                                return (
                                    <Text style={styles.emptyLogsText}>
                                        {showAllAttendance ? 'No attendance records found.' : 'No filtered records for today.'}
                                    </Text>
                                );
                            }

                            return displayedRecords.map((record) => (
                                <View key={record.id} style={styles.attendanceCard}>
                                    <View style={styles.attendanceHeader}>
                                        <Text style={styles.attendanceDate}>
                                            {new Date(record.date).toLocaleDateString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric'
                                            })}
                                        </Text>
                                        <View style={[
                                            styles.statusBadge,
                                            { backgroundColor: record.status_display === 'Full Day' ? Colors.success : Colors.warning }
                                        ]}>
                                            <Text style={styles.statusBadgeText}>{record.status_display}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.attendanceDetails}>
                                        <View style={styles.attendanceRow}>
                                            <Ionicons name="log-in" size={16} color={Colors.success} />
                                            <View style={styles.attendanceInfo}>
                                                <Text style={styles.attendanceLabel}>Punch In</Text>
                                                <Text style={styles.attendanceTime}>{formatDateTime(record.punch_in_time)}</Text>
                                                <Text style={styles.attendanceLocation} numberOfLines={1}>
                                                    {record.punch_in_location || 'N/A'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.attendanceRow}>
                                            <Ionicons name="log-out" size={16} color={Colors.error} />
                                            <View style={styles.attendanceInfo}>
                                                <Text style={styles.attendanceLabel}>Punch Out</Text>
                                                <Text style={styles.attendanceTime}>{formatDateTime(record.punch_out_time)}</Text>
                                                <Text style={styles.attendanceLocation} numberOfLines={1}>
                                                    {record.punch_out_location || 'N/A'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ));
                        })()
                    )}
                </View>

                <View style={styles.locationContainer}>
                    <Ionicons name="location-sharp" size={16} color={Colors.textSecondary} />
                    <Text style={styles.locationText}>Office HQ • Tirur, Kerala</Text>
                </View>

            </ScrollView>

            <Modal
                animationType="fade"
                transparent={true}
                visible={isProfileVisible}
                onRequestClose={() => setIsProfileVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setIsProfileVisible(false)}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Ionicons name="person-circle" size={60} color={Colors.primary} />
                            <Text style={styles.modalUserName}>{user ? user.name : 'Unknown'}</Text>
                            <Text style={styles.modalUserRole}>{user ? user.email : ''}</Text>
                            <Text style={styles.modalUserRole}>User ID: {user ? user.id : ''}</Text>
                        </View>

                        <View style={styles.modalDivider} />

                        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                            <Ionicons name="log-out-outline" size={24} color={Colors.error} />
                            <Text style={styles.logoutText}>Logout</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.closeButton} onPress={() => setIsProfileVisible(false)}>
                            <Text style={styles.closeButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

        </SafeAreaView>
    );
}

const { width } = Dimensions.get('window');
const BUTTON_SIZE = width * 0.65;

const styles = StyleSheet.create({
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
    headerBar: {
        position: 'absolute',
        top: 50,
        right: 20,
        zIndex: 10,
    },
    profileButton: {
        padding: 5,
    },
    scrollContent: {
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 40,
    },
    topSection: {
        alignItems: 'center',
        marginBottom: 30,
    },
    greetingText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
        letterSpacing: 1,
        marginBottom: 10,
        textTransform: 'uppercase',
    },
    largeTimeText: {
        fontSize: 48,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 10,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 8,
    },
    statusText: {
        fontSize: 16,
        color: Colors.textSecondary,
        fontWeight: '500',
    },
    timerContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 15,
        marginBottom: 40,
    },
    timerBox: {
        backgroundColor: Colors.white,
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderRadius: 16,
        alignItems: 'center',
        minWidth: 80,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    timerValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text,
    },
    timerLabel: {
        fontSize: 10,
        color: Colors.textSecondary,
        marginTop: 4,
        fontWeight: '600',
    },
    actionContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 30,
    },
    circularButton: {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        borderRadius: BUTTON_SIZE / 2,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    },
    innerCircleOutline: {
        width: BUTTON_SIZE - 20,
        height: BUTTON_SIZE - 20,
        borderRadius: (BUTTON_SIZE - 20) / 2,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: Colors.white,
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 10,
        letterSpacing: 1,
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 20,
    },
    locationText: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginLeft: 5,
    },
    servicesContainer: {
        width: '90%',
        backgroundColor: Colors.card,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    servicesGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 15,
    },
    serviceItem: {
        alignItems: 'center',
        width: '30%',
    },
    serviceIconContainer: {
        width: 55,
        height: 55,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceText: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text,
    },
    bottomPanel: {
        width: '90%',
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 40,
    },
    bottomPanelTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 15,
    },
    emptyLogsText: {
        color: Colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 10,
    },
    historyItem: {
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
        paddingBottom: 15,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    historyDate: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    historyTotal: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.success,
    },
    // Attendance Log Styles
    attendancePanel: {
        width: '90%',
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 40,
    },
    attendancePanelHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
    },
    expandButtonText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
        marginRight: 4,
    },
    attendanceCard: {
        backgroundColor: Colors.background,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    attendanceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    attendanceDate: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusBadgeText: {
        color: Colors.white,
        fontSize: 12,
        fontWeight: 'bold',
    },
    attendanceDetails: {
        gap: 12,
    },
    attendanceRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    attendanceInfo: {
        flex: 1,
    },
    attendanceLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
        marginBottom: 2,
    },
    attendanceTime: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
        marginBottom: 2,
    },
    attendanceLocation: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontStyle: 'italic',
    },
    // Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: Colors.white,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    modalUserName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: Colors.text,
        marginTop: 10,
    },
    modalUserRole: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginTop: 4,
    },
    modalDivider: {
        width: '100%',
        height: 1,
        backgroundColor: Colors.border,
        marginBottom: 20,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginBottom: 15,
        width: '100%',
        justifyContent: 'center',
    },
    logoutText: {
        color: Colors.error,
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
    },
    closeButton: {
        padding: 10,
    },
    closeButtonText: {
        color: Colors.textSecondary,
        fontSize: 16,
    }
});

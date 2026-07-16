import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
    ActivityIndicator, 
    Alert,
    FlatList, 
    RefreshControl, 
    StyleSheet, 
    Text, 
    TouchableOpacity, 
    View 
} from 'react-native';
import { Config } from '../../constants/Config';
import { Colors } from '../../constants/Colors';

type RequestType = 'leave' | 'late' | 'early';

interface UserRequest {
    id: number;
    date?: string;
    from_date?: string;
    to_date?: string;
    reason: string;
    status: string;
    created_at: string;
    // Common fields for all requests
}

export default function RequestsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type: RequestType }>();
    const [activeTab, setActiveTab] = useState<RequestType>(params.type || 'leave');
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        setRequests([]); // Instantly clear old data when switching tabs
        fetchRequests();
    }, [activeTab]);

    const getApiUrl = (type: RequestType) => {
        switch (type) {
            case 'leave': return `${Config.API_BASE_URL}/leave/my-requests/`;
            case 'late': return `${Config.API_BASE_URL}/late-requests/my-requests/`;
            case 'early': return `${Config.API_BASE_URL}/early-requests/my-requests/`;
        }
    };

    const fetchRequests = async () => {
        setRefreshing(true); // Show non-blocking refresh spinner instead of full-screen loader
        const url = getApiUrl(activeTab);
        console.log(`[DEBUG] Fetching requests from: ${url}`);
        
        try {
            const authToken = await AsyncStorage.getItem('auth_token');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                },
                signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();
            if (response.ok) {
                setRequests(data);
            } else {
                console.warn(`[DEBUG] Request failed with status ${response.status}:`, data);
            }
        } catch (error: any) {
            console.error(`[DEBUG] Error fetching requests from ${url}:`, error);
            if (error.name === 'AbortError') {
                Alert.alert('Timeout', 'The request took too long. Is your server running?');
            } else {
                Alert.alert('Network Error', `Failed to connect to ${url}. Please ensure your server is reachable.`);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchRequests();
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved': return Colors.success;
            case 'rejected': return Colors.error;
            case 'pending': return Colors.warning;
            default: return Colors.textSecondary;
        }
    };

    const renderRequestItem = React.useCallback(({ item }: { item: any }) => (
        <View style={styles.requestCard}>
            <View style={styles.cardHeader}>
                <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{activeTab.toUpperCase()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status || 'Pending') + '20' }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(item.status || 'Pending') }]}>
                        {item.status || 'Pending'}
                    </Text>
                </View>
            </View>
            
            <View style={styles.cardBody}>
                {activeTab === 'leave' ? (
                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color={Colors.textSecondary} />
                        <Text style={styles.infoText}>{item.from_date} to {item.to_date}</Text>
                    </View>
                ) : (
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                        <Text style={styles.infoText}>{item.date}</Text>
                    </View>
                )}
                
                <View style={styles.reasonContainer}>
                    <Text style={styles.reasonLabel}>Reason:</Text>
                    <Text style={styles.reasonText} numberOfLines={2}>{item.reason}</Text>
                </View>
            </View>
            
            <View style={styles.cardFooter}>
                <Text style={styles.timestamp}>Submitted on {new Date(item.created_at || Date.now()).toLocaleDateString()}</Text>
            </View>
        </View>
    ), [activeTab]);

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {(['leave', 'late', 'early'] as RequestType[]).map((tab) => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderRequestItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    initialNumToRender={10}
                    windowSize={5}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    ListEmptyComponent={() => (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="document-text-outline" size={60} color={Colors.border} />
                            <Text style={styles.emptyText}>No {activeTab} requests found.</Text>
                        </View>
                    )}
                />
            )}

            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => router.push({ pathname: '/requests/new', params: { type: activeTab } })}
            >
                <Ionicons name="add" size={30} color={Colors.white} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: Colors.white,
        padding: 10,
        marginHorizontal: 15,
        marginTop: 15,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: Colors.primary + '10',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    activeTabText: {
        color: Colors.primary,
    },
    listContent: {
        padding: 15,
        paddingBottom: 100,
    },
    requestCard: {
        backgroundColor: Colors.white,
        borderRadius: 16,
        padding: 16,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    typeBadge: {
        backgroundColor: Colors.background,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    cardBody: {
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    infoText: {
        marginLeft: 8,
        fontSize: 14,
        color: Colors.text,
        fontWeight: '500',
    },
    reasonContainer: {
        marginTop: 4,
    },
    reasonLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        marginBottom: 2,
    },
    reasonText: {
        fontSize: 14,
        color: Colors.text,
        lineHeight: 20,
    },
    cardFooter: {
        borderTopWidth: 1,
        borderTopColor: Colors.background,
        paddingTop: 10,
    },
    timestamp: {
        fontSize: 11,
        color: Colors.textSecondary,
        textAlign: 'right',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 100,
    },
    emptyText: {
        marginTop: 15,
        fontSize: 16,
        color: Colors.textSecondary,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    },
});

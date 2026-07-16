import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { 
    ActivityIndicator, 
    Alert, 
    KeyboardAvoidingView, 
    Modal,
    Platform, 
    SafeAreaView, 
    ScrollView, 
    StyleSheet, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View 
} from 'react-native';
import { Config } from '../../constants/Config';
import { Colors } from '../../constants/Colors';

type RequestType = 'leave' | 'late' | 'early';

export default function NewRequestScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ type: RequestType }>();
    const requestType = params.type || 'leave';

    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState('');
    const [leaveMaster, setLeaveMaster] = useState('1'); // Default to ID 1
    const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
    const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(''); // We'll use this for 'minutes'
    const [isPickerVisible, setIsPickerVisible] = useState(false);
    const [leaveTypes, setLeaveTypes] = useState<{id: string, name: string}[]>([
        { id: '5', name: 'Casual Leave' },
        { id: '9', name: 'SICK LEAVE' }
    ]);

    useEffect(() => {
        // Leave types are hardcoded, so no need to fetch from API.
        if (requestType === 'leave' && !leaveMaster) {
            setLeaveMaster('5');
        }
    }, [requestType]);

    const getTitle = () => {
        switch (requestType) {
            case 'leave': return 'Apply for Leave';
            case 'late': return 'Late Arrival Request';
            case 'early': return 'Early Exit Request';
            default: return 'New Request';
        }
    };

    const handleSubmit = async () => {
        if (!reason.trim()) {
            Alert.alert('Error', 'Please provide a reason for the request.');
            return;
        }

        setLoading(true);
        let url = '';
        let body: any = { reason };

        if (requestType === 'leave') {
            url = `${Config.API_BASE_URL}/leave/`;
            body.from_date = fromDate;
            body.to_date = toDate;
            body.leave_master = parseInt(leaveMaster, 10);
        } else if (requestType === 'late') {
            url = `${Config.API_BASE_URL}/late-requests/`;
            body.date = date;
            body.late_by_minutes = parseInt(time, 10); // Changed from 'minutes' to 'late_by_minutes'
        } else {
            url = `${Config.API_BASE_URL}/early-requests/`;
            body.date = date;
            body.early_by_minutes = parseInt(time, 10); // Adjust accordingly for early requests
        }

        console.log(`[DEBUG] Submitting request to: ${url}`);
        console.log(`[DEBUG] Body:`, body);

        try {
            const authToken = await AsyncStorage.getItem('auth_token');
            
            // Fire network request in background (no await) to make UI instantly responsive
            fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            }).then(async (response) => {
                if (!response.ok) {
                    const data = await response.json();
                    Alert.alert('Submission Failed', data.detail || 'Something went wrong.');
                }
            }).catch(error => {
                Alert.alert('Network Error', 'Failed to connect to server.');
            });

            // Instantly show success and go back
            Alert.alert('Success', 'Request submitted successfully!', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{getTitle()}</Text>
                        <Text style={styles.subtitle}>Fill in the details below to submit your request.</Text>
                    </View>

                    <View style={styles.form}>
                        {requestType === 'leave' ? (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Leave Type *</Text>
                                    <TouchableOpacity 
                                        style={styles.inputWrapper}
                                        onPress={() => setIsPickerVisible(true)}
                                    >
                                        <Ionicons name="list" size={20} color={Colors.textSecondary} />
                                        <Text style={[styles.input, { color: leaveMaster ? Colors.text : Colors.textSecondary, paddingTop: 16 }]}>
                                            {leaveTypes.find((l: any) => l.id === leaveMaster)?.name || '-- Select Leave Type --'}
                                        </Text>
                                        <Ionicons name="chevron-down" size={20} color={Colors.textSecondary} />
                                    </TouchableOpacity>
                                </View>
                                
                                {/* <View style={styles.inputGroup}>
                                    <Text style={styles.label}>[DEBUG] Manual Leave ID Override</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="construct-outline" size={20} color={Colors.error} />
                                        <TextInput 
                                            style={styles.input} 
                                            value={leaveMaster}
                                            onChangeText={setLeaveMaster}
                                            keyboardType="numeric"
                                            placeholder="Try 2, 3, 4 until it works"
                                        />
                                    </View>
                                    <Text style={styles.hintText}>Since ID 1 failed, test other numbers here!</Text>
                                </View> */}

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Start Date *</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
                                        <TextInput 
                                            style={styles.input} 
                                            value={fromDate}
                                            onChangeText={setFromDate}
                                            placeholder="yyyy-mm-dd"
                                        />
                                    </View>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>End Date *</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
                                        <TextInput 
                                            style={styles.input} 
                                            value={toDate}
                                            onChangeText={setToDate}
                                            placeholder="yyyy-mm-dd"
                                        />
                                    </View>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Date *</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="calendar-outline" size={20} color={Colors.textSecondary} />
                                        <TextInput 
                                            style={styles.input} 
                                            value={date}
                                            onChangeText={setDate}
                                            placeholder="yyyy-mm-dd"
                                        />
                                    </View>
                                </View>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>{requestType === 'late' ? 'Minutes Late *' : 'Minutes Early *'}</Text>
                                    <View style={styles.inputWrapper}>
                                        <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                                        <TextInput 
                                            style={styles.input} 
                                            value={time}
                                            onChangeText={setTime}
                                            placeholder={requestType === 'late' ? "e.g. 15" : "e.g. 30"}
                                            keyboardType="numeric"
                                        />
                                    </View>
                                    <Text style={styles.hintText}>
                                        {requestType === 'late' 
                                            ? 'How many minutes after your scheduled time?' 
                                            : 'How many minutes before your scheduled time?'}
                                    </Text>
                                </View>
                            </>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Reason / Remarks</Text>
                            <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                                <TextInput 
                                    style={[styles.input, styles.textArea]} 
                                    multiline 
                                    numberOfLines={4}
                                    value={reason}
                                    onChangeText={setReason}
                                    placeholder="Enter your reason here..."
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>

                        <TouchableOpacity 
                            style={[styles.submitButton, loading && styles.disabledButton]} 
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={Colors.white} />
                            ) : (
                                <>
                                    <Text style={styles.submitButtonText}>Submit Request</Text>
                                    <Ionicons name="checkmark-circle" size={20} color={Colors.white} style={{ marginLeft: 8 }} />
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.cancelButton}
                            onPress={() => router.back()}
                        >
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Leave Type Picker Modal */}
            <Modal visible={isPickerVisible} transparent animationType="fade">
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerContainer}>
                        <Text style={styles.pickerTitle}>Select Leave Type</Text>
                        
                        {leaveTypes.length > 0 ? (
                            leaveTypes.map((type) => (
                                <TouchableOpacity 
                                    key={type.id}
                                    style={styles.pickerItem} 
                                    onPress={() => { setLeaveMaster(type.id); setIsPickerVisible(false); }}
                                >
                                    <Text style={styles.pickerItemText}>{type.name}</Text>
                                </TouchableOpacity>
                            ))
                        ) : (
                            <Text style={{ textAlign: 'center', padding: 20, color: Colors.textSecondary }}>
                                Loading leave types...
                            </Text>
                        )}
                        
                        <TouchableOpacity 
                            style={styles.pickerCancelButton} 
                            onPress={() => setIsPickerVisible(false)}
                        >
                            <Text style={styles.pickerCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    scrollContent: {
        padding: 24,
    },
    header: {
        marginBottom: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.text,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: Colors.textSecondary,
    },
    form: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 8,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.white,
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    input: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: Colors.text,
    },
    textAreaWrapper: {
        height: 120,
        paddingVertical: 12,
        alignItems: 'flex-start',
    },
    textArea: {
        marginLeft: 0,
        height: '100%',
    },
    submitButton: {
        backgroundColor: Colors.primary,
        height: 56,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    disabledButton: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: Colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelButton: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
    },
    cancelButtonText: {
        color: Colors.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    },
    hintText: {
        fontSize: 12,
        color: '#A0A0A0',
        marginTop: 6,
        marginLeft: 4,
    },
    pickerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    pickerContainer: {
        backgroundColor: Colors.white,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    pickerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: Colors.text,
        textAlign: 'center',
    },
    pickerItem: {
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
    },
    pickerItemText: {
        fontSize: 16,
        color: Colors.text,
        textAlign: 'center',
    },
    pickerCancelButton: {
        marginTop: 15,
        paddingVertical: 15,
        backgroundColor: Colors.background,
        borderRadius: 12,
    },
    pickerCancelText: {
        fontSize: 16,
        color: Colors.error,
        fontWeight: 'bold',
        textAlign: 'center',
    },
});

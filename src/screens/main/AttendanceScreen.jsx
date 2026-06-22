import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
  Platform,
  StatusBar,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Icon from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '../../config';

// ─── constants ────────────────────────────────────────────────────────────────
const API = API_BASE_URL;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── helpers ──────────────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

const todayStr = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

const initials = (name = '') =>
  name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

// ─── theme tokens ─────────────────────────────────────────────────────────────
const getTheme = isDark => ({
  bg: isDark ? '#030712' : '#f9fafb',
  cardBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  borderLight: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  hover: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
  text1: isDark ? '#f1f5f9' : '#1e293b',
  text2: isDark ? '#94a3b8' : '#475569',
  text3: isDark ? '#64748b' : '#94a3b8',
  accent: '#5a7bf6',
  accentSoft: isDark ? 'rgba(90,123,246,0.18)' : 'rgba(90,123,246,0.08)',
  accentBorder: isDark ? 'rgba(90,123,246,0.30)' : 'rgba(90,123,246,0.20)',
  presentBg: isDark ? 'rgba(46,107,62,0.25)' : '#e8f5ec',
  presentText: isDark ? '#4ade80' : '#2e6b3e',
  presentDot: isDark ? '#4ade80' : '#3b8c4f',
  absentBg: isDark ? 'rgba(163,45,45,0.25)' : '#fef2f2',
  absentText: isDark ? '#f87171' : '#b91c1c',
  absentDot: isDark ? '#f87171' : '#dc2626',
  inputBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
  avatarBg: isDark ? 'rgba(90,123,246,0.18)' : 'rgba(90,123,246,0.10)',
  avatarColor: '#5a7bf6',
  cellSelected: isDark ? 'rgba(90,123,246,0.18)' : 'rgba(90,123,246,0.10)',
  cellToday: isDark ? 'rgba(90,123,246,0.10)' : 'rgba(90,123,246,0.06)',
  cellEmpty: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
  sundayColor: isDark ? '#f87171' : '#e05050',
  tabBg: isDark ? 'rgba(15,23,42,0.97)' : 'rgba(255,255,255,0.97)',
  tabBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
  white: '#ffffff',
});

// ─── main component ───────────────────────────────────────────────────────────
const AttendanceScreen = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const T = getTheme(isDark);
  const insets = useSafeAreaInsets();

  const { user, accessToken: token } = useSelector(s => s.auth);
  const isAdmin = user?.role === 'admin';

  // ── tab state (admin mobile) ────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState('calendar'); // calendar | team | detail

  // ── date state ─────────────────────────────────────────────────────────
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelected] = useState(todayStr());
  const today = todayStr();

  // ── data state ─────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState({});
  const [dayDetail, setDayDetail] = useState(null);
  const [userMonthly, setUserMonthly] = useState({});
  const [myRecords, setMyRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [markLoading, setMarkLoading] = useState(false);

  // ── OTP state ──────────────────────────────────────────────────────────
  const [otpStep, setOtpStep] = useState('idle'); // idle | pending
  const [otpType, setOtpType] = useState('checkIn');
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  const todayRecord = myRecords[today];
  const checkedIn = !!todayRecord;
  const checkedOut = !!todayRecord?.checkOut;
  const isCheckOut = otpType === 'checkOut';

  // ── auth header ────────────────────────────────────────────────────────
  const authHeader = () => {
    const tk = token;
    return { headers: { Authorization: `Bearer ${tk}` } };
  };

  // ── OTP timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (otpTimer <= 0) return;
    const id = setInterval(() => {
      setOtpTimer(t => {
        if (t <= 1) {
          setOtpStep('idle');
          setOtpValue('');
          setOtpError('OTP expired. Please request a new one.');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [otpTimer]);

  // ── API calls ──────────────────────────────────────────────────────────
  const fetchAdminMonthly = useCallback(async (m, y) => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/attendance/admin/monthly?month=${m}&year=${y}`,
        authHeader(),
      );
      setMonthlySummary(data.summary || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDayDetail = useCallback(async date => {
    try {
      const { data } = await axios.get(
        `${API}/attendance/admin/day?date=${date}`,
        authHeader(),
      );
      setDayDetail(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchUsers = useCallback(async (q = '') => {
    try {
      const { data } = await axios.get(
        `${API}/attendance/admin/users?search=${q}`,
        authHeader(),
      );
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchUserMonthly = useCallback(async (uid, m, y) => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/attendance/admin/user/${uid}?month=${m}&year=${y}`,
        authHeader(),
      );
      setUserMonthly(data.records || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyMonthly = useCallback(async (m, y) => {
    setLoading(true);
    try {
      const { data } = await axios.get(
        `${API}/attendance/my?month=${m}&year=${y}`,
        authHeader(),
      );
      setMyRecords(data.records || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── effects ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) {
      fetchUsers(searchQ);
      fetchAdminMonthly(month, year);
      fetchDayDetail(selectedDate);
    } else {
      fetchMyMonthly(month, year);
    }
  }, [month, year, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => fetchUsers(searchQ), 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  useEffect(() => {
    if (isAdmin) {
      fetchDayDetail(selectedDate);
      if (selectedUser) fetchUserMonthly(selectedUser._id, month, year);
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isAdmin) return;
    if (selectedUser) fetchUserMonthly(selectedUser._id, month, year);
    else fetchAdminMonthly(month, year);
  }, [selectedUser, month, year]);

  // ── OTP actions ────────────────────────────────────────────────────────
  const requestOtp = async type => {
    setMarkLoading(true);
    setOtpError('');
    setOtpType(type);
    try {
      await axios.post(`${API}/attendance/otp/request`, { type }, authHeader());
      setOtpStep('pending');
      setOtpValue('');
      setOtpTimer(300);
    } catch (e) {
      if (e.response?.status === 409) fetchMyMonthly(month, year);
      else
        setOtpError(
          e.response?.data?.message || 'Failed to send OTP. Try again.',
        );
    } finally {
      setMarkLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otpValue.trim()) {
      setOtpError('Please enter the OTP');
      return;
    }
    setMarkLoading(true);
    setOtpError('');
    try {
      await axios.post(
        `${API}/attendance/otp/verify`,
        { otp: otpValue, type: otpType },
        authHeader(),
      );
      setOtpStep('idle');
      setOtpValue('');
      setOtpTimer(0);
      fetchMyMonthly(month, year);
    } catch (e) {
      setOtpError(e.response?.data?.message || 'Invalid OTP. Try again.');
    } finally {
      setMarkLoading(false);
    }
  };

  // ── calendar helpers ───────────────────────────────────────────────────
  const buildCalendar = () => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      cells.push(`${year}-${pad(month)}-${pad(d)}`);
    return cells;
  };

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else setMonth(m => m + 1);
  };
  const goToday = () => {
    const n = new Date();
    setMonth(n.getMonth() + 1);
    setYear(n.getFullYear());
    setSelected(todayStr());
  };

  const getCellData = date => {
    if (!date) return null;
    if (!isAdmin) {
      const rec = myRecords[date];
      if (!rec) return null;
      return {
        present: 1,
        absent: 0,
        status: rec.status,
        checkOut: rec.checkOut,
      };
    }
    if (selectedUser) {
      const rec = userMonthly[date];
      const isPast = date <= today;
      if (rec) return { present: 1, absent: 0 };
      if (isPast) return { present: 0, absent: 1 };
      return null;
    }
    return monthlySummary[date] || null;
  };

  const cells = buildCalendar();

  // ── screen width for cell sizing ───────────────────────────────────────
  const screenW = Dimensions.get('window').width;
  const cellWidth = Math.floor(screenW / 7);
  const cellHeight = 72;

  // ══════════════════════════════════════════════════════════════════════
  // SUB-COMPONENTS
  // ══════════════════════════════════════════════════════════════════════

  // ── Employee Bar ───────────────────────────────────────────────────────
  const EmployeeBar = () => {
    if (isAdmin) return null;
    const barColor = isCheckOut && otpStep === 'pending' ? '#dc2626' : T.accent;
    const barEnd = isCheckOut && otpStep === 'pending' ? '#991b1b' : '#4f46e5';
    const dateLabel = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Kolkata',
    });

    return (
      <View style={[s.employeeBar, { backgroundColor: barColor }]}>
        {/* date row */}
        <View style={s.ebRow}>
          <Icon
            name="calendar-outline"
            size={15}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={s.ebDate}>{dateLabel}</Text>
        </View>

        {/* action row */}
        {otpStep === 'idle' && (
          <View style={s.ebActionRow}>
            {checkedIn && (
              <View style={s.ebBadge}>
                <Icon name="log-in-outline" size={12} color="#fff" />
                <Text style={s.ebBadgeText}>In: {todayRecord.checkIn}</Text>
              </View>
            )}
            {checkedIn && checkedOut && (
              <View style={s.ebBadge}>
                <Icon name="log-out-outline" size={12} color="#fff" />
                <Text style={s.ebBadgeText}>Out: {todayRecord.checkOut}</Text>
              </View>
            )}
            {!checkedIn && (
              <TouchableOpacity
                onPress={() => requestOtp('checkIn')}
                disabled={markLoading}
                style={[s.ebBtn, { backgroundColor: '#fff' }]}
              >
                {markLoading ? (
                  <ActivityIndicator size={13} color={T.accent} />
                ) : (
                  <>
                    <Icon name="log-in-outline" size={14} color={T.accent} />
                    <Text style={[s.ebBtnText, { color: T.accent }]}>
                      Mark Check In
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {checkedIn && !checkedOut && (
              <TouchableOpacity
                onPress={() => requestOtp('checkOut')}
                disabled={markLoading}
                style={[s.ebBtn, { backgroundColor: '#fff' }]}
              >
                {markLoading ? (
                  <ActivityIndicator size={13} color="#dc2626" />
                ) : (
                  <>
                    <Icon name="log-out-outline" size={14} color="#dc2626" />
                    <Text style={[s.ebBtnText, { color: '#dc2626' }]}>
                      Mark Check Out
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {otpStep === 'pending' && (
          <View style={s.otpRow}>
            {/* timer */}
            <View style={s.otpTimerBadge}>
              <Icon
                name="time-outline"
                size={11}
                color="rgba(255,255,255,0.8)"
              />
              <Text
                style={[s.otpTimerText, otpTimer < 60 && { color: '#fca5a5' }]}
              >
                {Math.floor(otpTimer / 60)}:{pad(otpTimer % 60)}
              </Text>
            </View>
            {/* input */}
            <TextInput
              value={otpValue}
              onChangeText={v => {
                setOtpValue(v.replace(/\D/g, '').slice(0, 6));
                setOtpError('');
              }}
              placeholder="000000"
              placeholderTextColor="rgba(255,255,255,0.4)"
              keyboardType="number-pad"
              maxLength={6}
              style={[s.otpInput, otpError && { borderColor: '#fca5a5' }]}
            />
            {/* verify */}
            <TouchableOpacity
              onPress={verifyOtp}
              disabled={markLoading || otpValue.length < 6}
              style={[
                s.otpVerifyBtn,
                { opacity: markLoading || otpValue.length < 6 ? 0.5 : 1 },
              ]}
            >
              <Text
                style={[
                  s.otpVerifyText,
                  { color: isCheckOut ? '#dc2626' : '#4f46e5' },
                ]}
              >
                {markLoading ? '...' : 'Verify'}
              </Text>
            </TouchableOpacity>
            {/* resend */}
            <TouchableOpacity
              onPress={() => requestOtp(otpType)}
              disabled={markLoading}
              style={s.otpResendBtn}
            >
              <Icon name="refresh-outline" size={11} color="#fff" />
            </TouchableOpacity>
            {/* cancel */}
            <TouchableOpacity
              onPress={() => {
                setOtpStep('idle');
                setOtpValue('');
                setOtpError('');
                setOtpTimer(0);
              }}
              style={s.otpCancelBtn}
            >
              <Text style={s.otpCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* mail hint */}
        {otpStep === 'pending' && !otpError && (
          <View style={s.ebHintRow}>
            <Icon name="mail-outline" size={11} color="rgba(255,255,255,0.7)" />
            <Text style={s.ebHintText}>
              {isCheckOut
                ? 'Check-out OTP sent to admin.'
                : 'Check-in OTP sent to admin. Ask admin for the code.'}
            </Text>
          </View>
        )}
        {otpError ? (
          <View style={s.ebHintRow}>
            <Icon name="close-circle-outline" size={11} color="#fca5a5" />
            <Text style={[s.ebHintText, { color: '#fca5a5' }]}>{otpError}</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // ── Calendar Header ────────────────────────────────────────────────────
  const CalendarHeader = () => (
    <View
      style={[
        s.calHeader,
        { backgroundColor: T.cardBg, borderBottomColor: T.border },
      ]}
    >
      <View style={s.calHeaderRow}>
        <Text style={[s.calMonthText, { color: T.text1 }]}>
          {MONTHS[month - 1]} <Text style={{ color: T.accent }}>{year}</Text>
        </Text>
        <View style={s.calHeaderActions}>
          <TouchableOpacity
            onPress={prevMonth}
            style={[s.navBtn, { backgroundColor: T.accent }]}
          >
            <Icon name="chevron-back" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToday}
            style={[s.todayBtn, { borderColor: T.border }]}
          >
            <Text style={[s.todayBtnText, { color: T.text2 }]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={nextMonth}
            style={[s.navBtn, { backgroundColor: T.accent }]}
          >
            <Icon name="chevron-forward" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {/* selected user badge (admin) */}
      {isAdmin && selectedUser && (
        <View
          style={[
            s.userBadge,
            { backgroundColor: T.accentSoft, borderColor: T.accentBorder },
          ]}
        >
          <View style={[s.userBadgeAvatar, { backgroundColor: T.accent }]}>
            <Text style={s.userBadgeAvatarText}>
              {initials(selectedUser.name)}
            </Text>
          </View>
          <Text style={[s.userBadgeName, { color: T.accent }]}>
            {selectedUser.name}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedUser(null)}
            style={[s.userBadgeClear, { backgroundColor: T.hover }]}
          >
            <Text style={[s.userBadgeClearText, { color: T.text3 }]}>
              ✕ Clear
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Calendar Grid ──────────────────────────────────────────────────────
  const CalendarGrid = () => (
    <View style={{ flex: 1 }}>
      {/* Day headers */}
      <View style={[s.dayHeaderRow, { borderBottomColor: T.border }]}>
        {DAYS_SHORT.map((d, i) => (
          <View
            key={i}
            style={{
              width: cellWidth,
              alignItems: 'center',
              paddingVertical: 8,
            }}
          >
            <Text style={[s.dayHeaderText, { color: T.text3 }]}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Grid body */}
      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="small" color={T.accent} />
          <Text style={[s.loadingText, { color: T.text3 }]}>Loading…</Text>
        </View>
      ) : (
        <ScrollView>
          <View style={s.gridWrap}>
            {cells.map((date, idx) => {
              const data = getCellData(date);
              const isToday = date === today;
              const isSelected = date === selectedDate;
              const isSunday = date
                ? new Date(date + 'T00:00:00').getDay() === 0
                : false;
              const isPresentDay = data && data.present > 0;
              const hasCheckOut = data?.checkOut;

              let cellBg = 'transparent';
              if (!date) cellBg = T.cellEmpty;
              else if (isSelected) cellBg = T.cellSelected;
              else if (isToday) cellBg = T.cellToday;

              return (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={date ? 0.7 : 1}
                  onPress={() => {
                    if (!date) return;
                    setSelected(date);
                    if (isAdmin) {
                      fetchDayDetail(date);
                      setMobileTab('detail');
                    }
                  }}
                  style={[
                    s.cell,
                    {
                      width: cellWidth,
                      minHeight: cellHeight,
                      backgroundColor: cellBg,
                      borderBottomColor: T.borderLight,
                      borderRightColor: T.borderLight,
                      borderWidth: isSelected ? 0 : undefined,
                    },
                    isSelected && {
                      borderWidth: 2,
                      borderColor: T.accent,
                    },
                  ]}
                >
                  {date && (
                    <>
                      <View style={s.cellTopRow}>
                        <Text
                          style={[
                            s.cellDateNum,
                            {
                              color: isToday
                                ? T.accent
                                : isSunday
                                ? T.sundayColor
                                : T.text2,
                            },
                          ]}
                        >
                          {parseInt(date.split('-')[2])}
                        </Text>
                        {isToday && <View style={s.todayDot} />}
                      </View>
                      {data && (
                        <View style={{ marginTop: 2 }}>
                          {isAdmin && !selectedUser ? (
                            // Admin summary
                            <View>
                              <View style={s.cellStatRow}>
                                <Icon
                                  name="checkmark-circle"
                                  size={10}
                                  color={T.presentDot}
                                />
                                <Text
                                  style={[s.cellStatText, { color: T.text1 }]}
                                >
                                  {data.present}
                                </Text>
                              </View>
                              <View style={s.cellStatRow}>
                                <Icon
                                  name="close-circle"
                                  size={10}
                                  color={T.absentDot}
                                />
                                <Text
                                  style={[s.cellStatText, { color: T.text2 }]}
                                >
                                  {data.absent}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            // Employee / single user
                            <View>
                              <View
                                style={[
                                  s.cellChip,
                                  {
                                    backgroundColor: isPresentDay
                                      ? T.presentBg
                                      : T.absentBg,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.cellChipText,
                                    {
                                      color: isPresentDay
                                        ? T.presentText
                                        : T.absentText,
                                    },
                                  ]}
                                >
                                  {isPresentDay ? 'In' : 'Abs'}
                                </Text>
                              </View>
                              {isPresentDay && hasCheckOut && (
                                <View
                                  style={[
                                    s.cellChip,
                                    {
                                      backgroundColor: T.absentBg,
                                      marginTop: 2,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.cellChipText,
                                      { color: T.absentText },
                                    ]}
                                  >
                                    Out
                                  </Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );

  // ── Right Panel / Detail Content ───────────────────────────────────────
  const DetailContent = () => {
    if (isAdmin && dayDetail) {
      return (
        <>
          {/* present / absent summary */}
          <View style={s.detailSummaryRow}>
            <View
              style={[s.detailSummaryCard, { backgroundColor: T.presentBg }]}
            >
              <Text style={[s.detailSummaryNum, { color: T.presentText }]}>
                {dayDetail.presentCount}
              </Text>
              <Text style={[s.detailSummaryLabel, { color: T.presentDot }]}>
                Present
              </Text>
            </View>
            <View
              style={[s.detailSummaryCard, { backgroundColor: T.absentBg }]}
            >
              <Text style={[s.detailSummaryNum, { color: T.absentText }]}>
                {dayDetail.absentCount}
              </Text>
              <Text style={[s.detailSummaryLabel, { color: T.absentDot }]}>
                Absent
              </Text>
            </View>
          </View>

          {/* present list */}
          {dayDetail.present.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: T.text3 }]}>
                PRESENT TODAY
              </Text>
              {dayDetail.present.map(u => (
                <View
                  key={u._id}
                  style={[s.userRow, { backgroundColor: T.hover }]}
                >
                  <View style={[s.avatar, { backgroundColor: T.avatarBg }]}>
                    <Text style={[s.avatarText, { color: T.avatarColor }]}>
                      {initials(u.name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[s.userRowName, { color: T.text1 }]}
                      numberOfLines={1}
                    >
                      {u.name}
                    </Text>
                    <View style={s.userRowTimes}>
                      {u.checkIn && (
                        <View style={s.timeBadge}>
                          <Icon
                            name="log-in-outline"
                            size={8}
                            color={T.text3}
                          />
                          <Text style={[s.timeBadgeText, { color: T.text3 }]}>
                            {u.checkIn}
                          </Text>
                        </View>
                      )}
                      {u.checkOut && (
                        <View style={s.timeBadge}>
                          <Icon
                            name="log-out-outline"
                            size={8}
                            color={T.absentText}
                          />
                          <Text
                            style={[s.timeBadgeText, { color: T.absentText }]}
                          >
                            {u.checkOut}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[s.statusDot, { backgroundColor: T.presentDot }]}
                  />
                </View>
              ))}
            </>
          )}

          {/* absent list */}
          {dayDetail.absent.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: T.text3, marginTop: 12 }]}>
                NOT MARKED
              </Text>
              {dayDetail.absent.map(u => (
                <View
                  key={u._id}
                  style={[s.userRow, { backgroundColor: T.hover }]}
                >
                  <View style={[s.avatar, { backgroundColor: T.hover }]}>
                    <Text style={[s.avatarText, { color: T.text3 }]}>
                      {initials(u.name)}
                    </Text>
                  </View>
                  <Text
                    style={[s.userRowName, { color: T.text3, flex: 1 }]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  <View
                    style={[s.statusDot, { backgroundColor: T.absentDot }]}
                  />
                </View>
              ))}
            </>
          )}

          {dayDetail.present.length === 0 && dayDetail.absent.length === 0 && (
            <Text style={[s.emptyText, { color: T.text3 }]}>
              No data for this date
            </Text>
          )}
        </>
      );
    }

    if (!isAdmin) {
      const rec = myRecords[selectedDate];
      return (
        <View style={{ gap: 8 }}>
          {rec ? (
            <>
              <View style={[s.recordRow, { backgroundColor: T.presentBg }]}>
                <Icon name="log-in-outline" size={16} color={T.presentText} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[s.recordLabel, { color: T.presentText }]}>
                    Check In
                  </Text>
                  {rec.checkIn && (
                    <View style={s.recordTimeRow}>
                      <Icon
                        name="time-outline"
                        size={10}
                        color={T.presentDot}
                      />
                      <Text style={[s.recordTime, { color: T.presentDot }]}>
                        {rec.checkIn}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {rec.checkOut ? (
                <View style={[s.recordRow, { backgroundColor: T.absentBg }]}>
                  <Icon name="log-out-outline" size={16} color={T.absentText} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[s.recordLabel, { color: T.absentText }]}>
                      Check Out
                    </Text>
                    <View style={s.recordTimeRow}>
                      <Icon name="time-outline" size={10} color={T.absentDot} />
                      <Text style={[s.recordTime, { color: T.absentDot }]}>
                        {rec.checkOut}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : selectedDate === today ? (
                <View style={[s.recordRow, { backgroundColor: T.hover }]}>
                  <Icon name="log-out-outline" size={16} color={T.text3} />
                  <Text
                    style={[s.recordLabel, { color: T.text3, marginLeft: 10 }]}
                  >
                    Not checked out yet
                  </Text>
                </View>
              ) : (
                <View style={[s.recordRow, { backgroundColor: T.absentBg }]}>
                  <Icon name="log-out-outline" size={16} color={T.absentText} />
                  <Text
                    style={[
                      s.recordLabel,
                      { color: T.absentText, marginLeft: 10 },
                    ]}
                  >
                    No check-out
                  </Text>
                </View>
              )}
            </>
          ) : selectedDate <= today ? (
            <View style={[s.recordRow, { backgroundColor: T.absentBg }]}>
              <Icon
                name="close-circle-outline"
                size={18}
                color={T.absentText}
              />
              <Text
                style={[s.recordLabel, { color: T.absentText, marginLeft: 10 }]}
              >
                {selectedDate === today ? 'Not marked yet' : 'Absent'}
              </Text>
            </View>
          ) : (
            <Text style={[s.emptyText, { color: T.text3 }]}>Future date</Text>
          )}
        </View>
      );
    }

    return null;
  };

  // ── Team Panel ─────────────────────────────────────────────────────────
  const TeamPanel = () => (
    <View style={[{ flex: 1 }, { backgroundColor: T.cardBg }]}>
      {/* header */}
      <View style={[s.teamHeader, { borderBottomColor: T.border }]}>
        <View style={s.teamHeaderTitle}>
          <Icon name="people-outline" size={14} color={T.accent} />
          <Text style={[s.teamHeaderTitleText, { color: T.text1 }]}>
            Team Attendance
          </Text>
        </View>
        <Text style={[s.teamHeaderSub, { color: T.text3 }]}>
          Select teammate for individual view
        </Text>
        <View
          style={[
            s.searchWrap,
            { borderColor: T.border, backgroundColor: T.inputBg },
          ]}
        >
          <Icon
            name="search-outline"
            size={13}
            color={T.text3}
            style={{ marginRight: 6 }}
          />
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search user…"
            placeholderTextColor={T.text3}
            style={[s.searchInput, { color: T.text1 }]}
          />
        </View>
      </View>
      {/* list */}
      <ScrollView style={{ flex: 1 }}>
        {/* All users row */}
        <TouchableOpacity
          onPress={() => {
            setSelectedUser(null);
            setMobileTab('calendar');
          }}
          style={[
            s.teamUserRow,
            { borderBottomColor: T.borderLight },
            !selectedUser && { backgroundColor: T.accentSoft },
          ]}
        >
          <Icon
            name="people-outline"
            size={14}
            color={!selectedUser ? T.accent : T.text2}
          />
          <Text
            style={[
              s.teamUserName,
              { color: !selectedUser ? T.accent : T.text2, marginLeft: 8 },
            ]}
          >
            All users
          </Text>
        </TouchableOpacity>
        {users.length === 0 && (
          <Text style={[s.emptyText, { color: T.text3 }]}>
            {searchQ ? 'No users match' : 'No active users'}
          </Text>
        )}
        {users.map(u => {
          const isActive = selectedUser?._id === u._id;
          return (
            <TouchableOpacity
              key={u._id}
              onPress={() => {
                setSelectedUser(u);
                setMobileTab('calendar');
              }}
              style={[
                s.teamUserRow,
                { borderBottomColor: T.borderLight },
                isActive && { backgroundColor: T.accentSoft },
              ]}
            >
              <View
                style={[
                  s.avatar,
                  {
                    backgroundColor: isActive ? T.accent : T.avatarBg,
                  },
                ]}
              >
                <Text
                  style={[
                    s.avatarText,
                    { color: isActive ? '#fff' : T.avatarColor },
                  ]}
                >
                  {initials(u.name)}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text
                  style={[s.teamUserName, { color: T.text1 }]}
                  numberOfLines={1}
                >
                  {u.name}
                </Text>
                {u.role === 'admin' && (
                  <Text style={[s.adminLabel, { color: T.accent }]}>ADMIN</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Detail selected date header ────────────────────────────────────────
  const DetailHeader = () => (
    <View style={s.detailDateRow}>
      <Icon name="calendar-outline" size={14} color={T.accent} />
      <Text style={[s.detailDateText, { color: T.text1 }]}>
        {selectedDate
          ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'Select a date'}
      </Text>
    </View>
  );

  // ══════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════
  const TAB_HEIGHT = 56;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: T.bg }]} edges={['top']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={T.bg}
      />

      {/* Employee check-in bar */}
      <EmployeeBar />

      {/* Calendar header */}
      <CalendarHeader />

      {/* Content area */}
      <View style={{ flex: 1, paddingBottom: isAdmin ? TAB_HEIGHT : 0 }}>
        {isAdmin ? (
          <>
            {mobileTab === 'calendar' && <CalendarGrid />}
            {mobileTab === 'team' && <TeamPanel />}
            {mobileTab === 'detail' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12 }}
              >
                <DetailHeader />
                <DetailContent />
              </ScrollView>
            )}
          </>
        ) : (
          /* Employee: calendar + detail stacked */
          <ScrollView style={{ flex: 1 }}>
            <CalendarGrid />
            <View
              style={[
                s.empDetailSection,
                {
                  borderTopColor: T.border,
                  backgroundColor: T.cardBg,
                },
              ]}
            >
              <View style={s.detailDateRow}>
                <Icon name="calendar-outline" size={14} color={T.accent} />
                <Text style={[s.detailDateText, { color: T.text1 }]}>
                  {selectedDate
                    ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(
                        'en-IN',
                        {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        },
                      )
                    : 'Select a date'}
                </Text>
              </View>
              <DetailContent />
            </View>
          </ScrollView>
        )}
      </View>

      {/* Bottom tab bar (admin only) */}
      {isAdmin && (
        <View
          style={[
            s.tabBar,
            {
              backgroundColor: T.tabBg,
              borderTopColor: T.tabBorder,
              height: TAB_HEIGHT + insets.bottom,
              paddingBottom: insets.bottom,
            },
          ]}
        >
          {[
            {
              key: 'calendar',
              icon: 'calendar-outline',
              iconActive: 'calendar',
              label: 'Calendar',
            },
            {
              key: 'team',
              icon: 'people-outline',
              iconActive: 'people',
              label: 'Team',
            },
            {
              key: 'detail',
              icon: 'checkmark-circle-outline',
              iconActive: 'checkmark-circle',
              label: 'Detail',
            },
          ].map(tab => {
            const active = mobileTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setMobileTab(tab.key)}
                style={s.tabItem}
                activeOpacity={0.7}
              >
                <Icon
                  name={active ? tab.iconActive : tab.icon}
                  size={20}
                  color={active ? T.accent : T.text3}
                />
                <Text
                  style={[s.tabLabel, { color: active ? T.accent : T.text3 }]}
                >
                  {tab.label}
                </Text>
                {active && (
                  <View
                    style={[s.tabIndicator, { backgroundColor: T.accent }]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },

  // employee bar
  employeeBar: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#5a7bf6',
  },
  ebRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  ebDate: { fontSize: 13, color: 'rgba(255,255,255,0.9)', fontWeight: '500' },
  ebActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  ebBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  ebBadgeText: { fontSize: 11, color: '#fff', fontWeight: '600' },
  ebBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ebBtnText: { fontSize: 12, fontWeight: '700' },
  ebHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  ebHintText: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },

  // OTP
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  otpTimerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  otpTimerText: {
    fontSize: 11,
    color: '#fff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  otpInput: {
    width: 110,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: '#fff',
  },
  otpVerifyBtn: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  otpVerifyText: { fontSize: 12, fontWeight: '700' },
  otpResendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  otpCancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  otpCancelText: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },

  // calendar header
  calHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calMonthText: { fontSize: 20, fontWeight: '800' },
  calHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  todayBtnText: { fontSize: 12, fontWeight: '500' },

  // user badge
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    gap: 8,
  },
  userBadgeAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userBadgeAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  userBadgeName: { flex: 1, fontSize: 12, fontWeight: '600' },
  userBadgeClear: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  userBadgeClearText: { fontSize: 10 },

  // day headers
  dayHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  dayHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // grid
  gridWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    borderBottomWidth: 1,
    borderRightWidth: 1,
    padding: 4,
    overflow: 'hidden',
  },
  cellTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cellDateNum: { fontSize: 11, fontWeight: '600' },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6366f1',
    marginTop: 2,
  },
  cellStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 1,
  },
  cellStatText: { fontSize: 10 },
  cellChip: { borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  cellChipText: { fontSize: 9, fontWeight: '700' },

  // loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: { fontSize: 13, marginTop: 8 },

  // detail panel
  detailSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  detailSummaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  detailSummaryNum: { fontSize: 24, fontWeight: '700' },
  detailSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  userRowName: { fontSize: 12, fontWeight: '500' },
  userRowTimes: { flexDirection: 'row', gap: 8, marginTop: 2 },
  timeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  timeBadgeText: { fontSize: 10 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
    flexShrink: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 11, fontWeight: '700' },

  // record rows (employee detail)
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
  },
  recordLabel: { fontSize: 13, fontWeight: '600' },
  recordTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  recordTime: { fontSize: 11 },

  // team panel
  teamHeader: { padding: 12, borderBottomWidth: 1 },
  teamHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  teamHeaderTitleText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  teamHeaderSub: { fontSize: 11, marginBottom: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 12, padding: 0, margin: 0 },
  teamUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  teamUserName: { fontSize: 13, fontWeight: '500' },
  adminLabel: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // employee detail section
  empDetailSection: { borderTopWidth: 1, padding: 12 },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailDateText: { fontSize: 13, fontWeight: '500' },

  // tab bar
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    borderTopWidth: 1,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    position: 'relative',
  },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 2,
    borderRadius: 2,
  },

  // misc
  emptyText: { textAlign: 'center', fontSize: 12, paddingVertical: 24 },
});

export default AttendanceScreen;

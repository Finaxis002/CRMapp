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
  Platform,
  StatusBar,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import axios from 'axios';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { API_BASE_URL } from '../../config';
import { useUISystem } from '../../hooks/useUISystem';
import { useToast as useKitToast } from '../../components/ui/CustomToast';

// ─── UI Kit imports ────────────────────────────────────────────────────────
import PageHeader from '../../components/ui/PageHeader';
import ImprovedButton from '../../components/ui/ImprovedButton';
import ImprovedCard from '../../components/ui/ImprovedCard';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';

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

// ══════════════════════════════════════════════════════════════════════
//  MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════
const AttendanceScreen = () => {
  const { colors, typography, borderRadius, spacing } = useUISystem();

  const insets = useSafeAreaInsets();
  const toast = useKitToast();

  const { user, accessToken: token } = useSelector(s => s.auth);
  const isAdmin = user?.role === 'admin';

  // ── state management ───────────────────────────────────────────────────
  const [mobileTab, setMobileTab] = useState('calendar');
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedDate, setSelected] = useState(todayStr());
  const today = todayStr();

  const [users, setUsers] = useState([]);
  const [searchQ, setSearchQ] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [monthlySummary, setMonthlySummary] = useState({});
  const [dayDetail, setDayDetail] = useState(null);
  const [userMonthly, setUserMonthly] = useState({});
  const [myRecords, setMyRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [markLoading, setMarkLoading] = useState(false);

  // OTP state
  const [otpStep, setOtpStep] = useState('idle');
  const [otpType, setOtpType] = useState('checkIn');
  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);

  const todayRecord = myRecords[today];
  const checkedIn = !!todayRecord;
  const checkedOut = !!todayRecord?.checkOut;
  const isCheckOut = otpType === 'checkOut';

  const authHeader = () => ({ headers: { Authorization: `Bearer ${token}` } });

  // OTP Timer logic
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

  // ── API methods ────────────────────────────────────────────────────────
  const fetchAdminMonthly = useCallback(
    async (m, y) => {
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
    },
    [token],
  );

  const fetchDayDetail = useCallback(
    async date => {
      try {
        const { data } = await axios.get(
          `${API}/attendance/admin/day?date=${date}`,
          authHeader(),
        );
        setDayDetail(data);
      } catch (e) {
        console.error(e);
      }
    },
    [token],
  );

  const fetchUsers = useCallback(
    async (q = '') => {
      try {
        const { data } = await axios.get(
          `${API}/attendance/admin/users?search=${q}`,
          authHeader(),
        );
        setUsers(data);
      } catch (e) {
        console.error(e);
      }
    },
    [token],
  );

  const fetchUserMonthly = useCallback(
    async (uid, m, y) => {
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
    },
    [token],
  );

  const fetchMyMonthly = useCallback(
    async (m, y) => {
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
    },
    [token],
  );

  // Effects
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

  // OTP Handlers
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

  // ── Grid helper logic ───────────────────────────────────────────────────
  const cells = (() => {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const arr = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      arr.push(`${year}-${pad(month)}-${pad(d)}`);
    return arr;
  })();

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
      return rec
        ? { present: 1, absent: 0, status: rec.status, checkOut: rec.checkOut }
        : null;
    }
    if (selectedUser) {
      const rec = userMonthly[date];
      return rec
        ? { present: 1, absent: 0 }
        : date <= today
        ? { present: 0, absent: 1 }
        : null;
    }
    return monthlySummary[date] || null;
  };

  const screenW = Dimensions.get('window').width;
  const cellWidth = Math.floor(screenW / 7);
  const cellHeight = 72;

  // ─── Theme-derived tokens (replace T.accent etc with colors) ────────────
  const accent = colors.primary;
  const presentBg = colors.successSoft;
  const presentText = colors.success;
  const presentDot = colors.success;
  const absentBg = colors.dangerSoft;
  const absentText = colors.danger;
  const absentDot = colors.danger;
  const sundayColor = colors.danger;

  // ══════════════════════════════════════════════════════════════════════
  //  RENDER FUNCTIONS
  // ══════════════════════════════════════════════════════════════════════

  const renderEmployeeBar = () => {
    if (isAdmin) return null;
    const barColor = isCheckOut && otpStep === 'pending' ? '#dc2626' : accent;
    const dateLabel = new Date().toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      timeZone: 'Asia/Kolkata',
    });

    return (
      <View style={[s.employeeBar, { backgroundColor: barColor }]}>
        <View style={s.ebRow}>
          <Icon
            name="calendar-outline"
            size={15}
            color="rgba(255,255,255,0.8)"
          />
          <Text style={s.ebDate}>{dateLabel}</Text>
        </View>

        {otpStep === 'idle' && (
          <View style={s.ebActionRow}>
            {checkedIn && (
              <View style={s.ebBadge}>
                <Icon name="login" size={12} color="#fff" />
                <Text style={s.ebBadgeText}>In: {todayRecord.checkIn}</Text>
              </View>
            )}
            {checkedIn && checkedOut && (
              <View style={s.ebBadge}>
                <Icon name="logout" size={12} color="#fff" />
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
                  <ActivityIndicator size={13} color={accent} />
                ) : (
                  <>
                    <Icon name="login" size={14} color={accent} />
                    <Text style={[s.ebBtnText, { color: accent }]}>
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
                    <Icon name="logout" size={14} color="#dc2626" />
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
            <View style={s.otpTimerBadge}>
              <Icon
                name="clock-outline"
                size={11}
                color="rgba(255,255,255,0.8)"
              />
              <Text
                style={[s.otpTimerText, otpTimer < 60 && { color: '#fca5a5' }]}
              >
                {Math.floor(otpTimer / 60)}:{pad(otpTimer % 60)}
              </Text>
            </View>
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
            <TouchableOpacity
              onPress={() => requestOtp(otpType)}
              disabled={markLoading}
              style={s.otpResendBtn}
            >
              <Icon name="refresh" size={11} color="#fff" />
            </TouchableOpacity>
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

        {otpStep === 'pending' && !otpError && (
          <View style={s.ebHintRow}>
            <Icon
              name="email-outline"
              size={11}
              color="rgba(255,255,255,0.7)"
            />
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

  const renderCalendarHeader = () => (
    <View
      style={[
        s.calHeader,
        { backgroundColor: colors.surface, borderBottomColor: colors.border },
      ]}
    >
      <View style={s.calHeaderRow}>
        <Text style={[s.calMonthText, { color: colors.textPrimary }]}>
          {MONTHS[month - 1]} <Text style={{ color: accent }}>{year}</Text>
        </Text>
        <View style={s.calHeaderActions}>
          <TouchableOpacity
            onPress={prevMonth}
            style={[s.navBtn, { backgroundColor: accent }]}
          >
            <Icon name="chevron-left" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={goToday}
            style={[s.todayBtn, { borderColor: colors.border }]}
          >
            <Text style={[s.todayBtnText, { color: colors.textSecondary }]}>
              Today
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={nextMonth}
            style={[s.navBtn, { backgroundColor: accent }]}
          >
            <Icon name="chevron-right" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      {isAdmin && selectedUser && (
        <View
          style={[
            s.userBadge,
            {
              backgroundColor: colors.primarySoft,
              borderColor: colors.primaryBorder,
            },
          ]}
        >
          <Avatar
            name={selectedUser.name}
            size={24}
            rounded={12}
            variant="solid"
          />
          <Text style={[s.userBadgeName, { color: accent }]}>
            {selectedUser.name}
          </Text>
          <TouchableOpacity
            onPress={() => setSelectedUser(null)}
            style={[
              s.userBadgeClear,
              { backgroundColor: colors.backgroundSecondary },
            ]}
          >
            <Text
              style={[s.userBadgeClearText, { color: colors.textTertiary }]}
            >
              ✕ Clear
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderCalendarGrid = () => (
    <View style={{ flex: 1 }}>
      <View style={[s.dayHeaderRow, { borderBottomColor: colors.border }]}>
        {DAYS_SHORT.map((d, i) => (
          <View
            key={i}
            style={{
              width: cellWidth,
              alignItems: 'center',
              paddingVertical: 8,
            }}
          >
            <Text style={[s.dayHeaderText, { color: colors.textTertiary }]}>
              {d}
            </Text>
          </View>
        ))}
      </View>
      {loading ? (
        <View style={s.loadingCenter}>
          <ActivityIndicator size="small" color={accent} />
          <Text style={[s.loadingText, { color: colors.textTertiary }]}>
            Loading…
          </Text>
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
              if (!date) cellBg = colors.backgroundSecondary;
              else if (isSelected) cellBg = colors.primarySoft;
              else if (isToday) cellBg = colors.primarySoft;

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
                      borderBottomColor: colors.border,
                      borderRightColor: colors.border,
                    },
                    isSelected && { borderWidth: 2, borderColor: accent },
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
                                ? accent
                                : isSunday
                                ? sundayColor
                                : colors.textSecondary,
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
                            <View>
                              <View style={s.cellStatRow}>
                                <Icon
                                  name="check-circle"
                                  size={10}
                                  color={presentDot}
                                />
                                <Text
                                  style={[
                                    s.cellStatText,
                                    { color: colors.textPrimary },
                                  ]}
                                >
                                  {data.present}
                                </Text>
                              </View>
                              <View style={s.cellStatRow}>
                                <Icon
                                  name="close-circle"
                                  size={10}
                                  color={absentDot}
                                />
                                <Text
                                  style={[
                                    s.cellStatText,
                                    { color: colors.textSecondary },
                                  ]}
                                >
                                  {data.absent}
                                </Text>
                              </View>
                            </View>
                          ) : (
                            <View>
                              <View
                                style={[
                                  s.cellChip,
                                  {
                                    backgroundColor: isPresentDay
                                      ? presentBg
                                      : absentBg,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    s.cellChipText,
                                    {
                                      color: isPresentDay
                                        ? presentText
                                        : absentText,
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
                                      backgroundColor: absentBg,
                                      marginTop: 2,
                                    },
                                  ]}
                                >
                                  <Text
                                    style={[
                                      s.cellChipText,
                                      { color: absentText },
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

  const renderDetailContent = () => {
    if (isAdmin && dayDetail) {
      return (
        <>
          <View style={s.detailSummaryRow}>
            <View style={[s.detailSummaryCard, { backgroundColor: presentBg }]}>
              <Text style={[s.detailSummaryNum, { color: presentText }]}>
                {dayDetail.presentCount}
              </Text>
              <Text style={[s.detailSummaryLabel, { color: presentDot }]}>
                Present
              </Text>
            </View>
            <View style={[s.detailSummaryCard, { backgroundColor: absentBg }]}>
              <Text style={[s.detailSummaryNum, { color: absentText }]}>
                {dayDetail.absentCount}
              </Text>
              <Text style={[s.detailSummaryLabel, { color: absentDot }]}>
                Absent
              </Text>
            </View>
          </View>

          {dayDetail.present.length > 0 && (
            <>
              <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>
                PRESENT TODAY
              </Text>
              {dayDetail.present.map(u => (
                <View
                  key={u._id}
                  style={[
                    s.userRow,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Avatar name={u.name} size={32} rounded={16} variant="soft" />
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                    <Text
                      style={[s.userRowName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {u.name}
                    </Text>
                    <View style={s.userRowTimes}>
                      {u.checkIn && (
                        <View style={s.timeBadge}>
                          <Icon
                            name="login"
                            size={8}
                            color={colors.textTertiary}
                          />
                          <Text
                            style={[
                              s.timeBadgeText,
                              { color: colors.textTertiary },
                            ]}
                          >
                            {u.checkIn}
                          </Text>
                        </View>
                      )}
                      {u.checkOut && (
                        <View style={s.timeBadge}>
                          <Icon name="logout" size={8} color={absentText} />
                          <Text
                            style={[s.timeBadgeText, { color: absentText }]}
                          >
                            {u.checkOut}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View
                    style={[s.statusDot, { backgroundColor: presentDot }]}
                  />
                </View>
              ))}
            </>
          )}

          {dayDetail.absent.length > 0 && (
            <>
              <Text
                style={[
                  s.sectionLabel,
                  { color: colors.textTertiary, marginTop: 12 },
                ]}
              >
                NOT MARKED
              </Text>
              {dayDetail.absent.map(u => (
                <View
                  key={u._id}
                  style={[
                    s.userRow,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Avatar name={u.name} size={32} rounded={16} variant="soft" />
                  <Text
                    style={[
                      s.userRowName,
                      { color: colors.textTertiary, flex: 1, marginLeft: 10 },
                    ]}
                    numberOfLines={1}
                  >
                    {u.name}
                  </Text>
                  <View style={[s.statusDot, { backgroundColor: absentDot }]} />
                </View>
              ))}
            </>
          )}

          {dayDetail.present.length === 0 && dayDetail.absent.length === 0 && (
            <Text style={[s.emptyText, { color: colors.textTertiary }]}>
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
              <View style={[s.recordRow, { backgroundColor: presentBg }]}>
                <Icon name="login" size={16} color={presentText} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={[s.recordLabel, { color: presentText }]}>
                    Check In
                  </Text>
                  {rec.checkIn && (
                    <View style={s.recordTimeRow}>
                      <Icon name="clock-outline" size={10} color={presentDot} />
                      <Text style={[s.recordTime, { color: presentDot }]}>
                        {rec.checkIn}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {rec.checkOut ? (
                <View style={[s.recordRow, { backgroundColor: absentBg }]}>
                  <Icon name="logout" size={16} color={absentText} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={[s.recordLabel, { color: absentText }]}>
                      Check Out
                    </Text>
                    <View style={s.recordTimeRow}>
                      <Icon name="clock-outline" size={10} color={absentDot} />
                      <Text style={[s.recordTime, { color: absentDot }]}>
                        {rec.checkOut}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : selectedDate === today ? (
                <View
                  style={[
                    s.recordRow,
                    { backgroundColor: colors.backgroundSecondary },
                  ]}
                >
                  <Icon name="logout" size={16} color={colors.textTertiary} />
                  <Text
                    style={[
                      s.recordLabel,
                      { color: colors.textTertiary, marginLeft: 10 },
                    ]}
                  >
                    Not checked out yet
                  </Text>
                </View>
              ) : (
                <View style={[s.recordRow, { backgroundColor: absentBg }]}>
                  <Icon name="logout" size={16} color={absentText} />
                  <Text
                    style={[
                      s.recordLabel,
                      { color: absentText, marginLeft: 10 },
                    ]}
                  >
                    No check-out
                  </Text>
                </View>
              )}
            </>
          ) : selectedDate <= today ? (
            <View style={[s.recordRow, { backgroundColor: absentBg }]}>
              <Icon name="close-circle-outline" size={18} color={absentText} />
              <Text
                style={[s.recordLabel, { color: absentText, marginLeft: 10 }]}
              >
                {selectedDate === today ? 'Not marked yet' : 'Absent'}
              </Text>
            </View>
          ) : (
            <Text style={[s.emptyText, { color: colors.textTertiary }]}>
              Future date
            </Text>
          )}
        </View>
      );
    }
    return null;
  };

  const renderTeamPanel = () => (
    <View style={[{ flex: 1 }, { backgroundColor: colors.surface }]}>
      <View style={[s.teamHeader, { borderBottomColor: colors.border }]}>
        <View style={s.teamHeaderTitle}>
          <Icon name="account-group-outline" size={14} color={accent} />
          <Text style={[s.teamHeaderTitleText, { color: colors.textPrimary }]}>
            Team Attendance
          </Text>
        </View>
        <Text style={[s.teamHeaderSub, { color: colors.textTertiary }]}>
          Select teammate for individual view
        </Text>
        <View
          style={[
            s.searchWrap,
            {
              borderColor: colors.border,
              backgroundColor: colors.backgroundSecondary,
            },
          ]}
        >
          <Icon
            name="magnify"
            size={13}
            color={colors.textTertiary}
            style={{ marginRight: 6 }}
          />
          <TextInput
            value={searchQ}
            onChangeText={setSearchQ}
            placeholder="Search user…"
            placeholderTextColor={colors.placeholder}
            style={[s.searchInput, { color: colors.textPrimary }]}
          />
        </View>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <TouchableOpacity
          onPress={() => {
            setSelectedUser(null);
            setMobileTab('calendar');
          }}
          style={[
            s.teamUserRow,
            { borderBottomColor: colors.border },
            !selectedUser && { backgroundColor: colors.primarySoft },
          ]}
        >
          <Icon
            name="account-group-outline"
            size={14}
            color={!selectedUser ? accent : colors.textSecondary}
          />
          <Text
            style={[
              s.teamUserName,
              {
                color: !selectedUser ? accent : colors.textSecondary,
                marginLeft: 8,
              },
            ]}
          >
            All users
          </Text>
        </TouchableOpacity>
        {users.length === 0 && (
          <Text style={[s.emptyText, { color: colors.textTertiary }]}>
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
                { borderBottomColor: colors.border },
                isActive && { backgroundColor: colors.primarySoft },
              ]}
            >
              <Avatar
                name={u.name}
                size={32}
                rounded={16}
                variant={isActive ? 'solid' : 'soft'}
              />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text
                  style={[s.teamUserName, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {u.name}
                </Text>
                {u.role === 'admin' && (
                  <Text style={[s.adminLabel, { color: accent }]}>ADMIN</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderDetailHeader = () => (
    <View style={s.detailDateRow}>
      <Icon name="calendar-outline" size={14} color={accent} />
      <Text style={[s.detailDateText, { color: colors.textPrimary }]}>
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

  const TAB_HEIGHT = 56;

  return (
    <SafeAreaView
      style={[s.root, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* RENDER FUNCTIONS INSTEAD OF CUSTOM COMPONENTS */}
      {renderEmployeeBar()}
      {renderCalendarHeader()}

      <View style={{ flex: 1, paddingBottom: isAdmin ? TAB_HEIGHT : 0 }}>
        {isAdmin ? (
          <>
            {mobileTab === 'calendar' && renderCalendarGrid()}
            {mobileTab === 'team' && renderTeamPanel()}
            {mobileTab === 'detail' && (
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12 }}
              >
                {renderDetailHeader()}
                {renderDetailContent()}
              </ScrollView>
            )}
          </>
        ) : (
          <ScrollView style={{ flex: 1 }}>
            {renderCalendarGrid()}
            <View
              style={[
                s.empDetailSection,
                {
                  borderTopColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <View style={s.detailDateRow}>
                <Icon name="calendar-outline" size={14} color={accent} />
                <Text style={[s.detailDateText, { color: colors.textPrimary }]}>
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
              {renderDetailContent()}
            </View>
          </ScrollView>
        )}
      </View>

      {isAdmin && (
        <View
          style={[
            s.tabBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
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
              icon: 'account-group-outline',
              iconActive: 'account-group',
              label: 'Team',
            },
            {
              key: 'detail',
              icon: 'check-circle-outline',
              iconActive: 'check-circle',
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
                  color={active ? accent : colors.textTertiary}
                />
                <Text
                  style={[
                    s.tabLabel,
                    { color: active ? accent : colors.textTertiary },
                  ]}
                >
                  {tab.label}
                </Text>
                {active && (
                  <View style={[s.tabIndicator, { backgroundColor: accent }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── styles (keep intact) ───────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
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
  userBadgeName: { flex: 1, fontSize: 12, fontWeight: '600' },
  userBadgeClear: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  userBadgeClearText: { fontSize: 10 },
  dayHeaderRow: { flexDirection: 'row', borderBottomWidth: 1 },
  dayHeaderText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
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
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: { fontSize: 13, marginTop: 8 },
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
  empDetailSection: { borderTopWidth: 1, padding: 12 },
  detailDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  detailDateText: { fontSize: 13, fontWeight: '500' },
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
  emptyText: { textAlign: 'center', fontSize: 12, paddingVertical: 24 },
});

export default AttendanceScreen;

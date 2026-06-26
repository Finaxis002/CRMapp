import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Animated,
  useColorScheme,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = ['#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#dc2626'];

const getInitials = (name = '') =>
  name
    .split(' ')
    .map((x) => x[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const formatTime = (timestamp) => {
  const date = new Date(timestamp || Date.now());
  return date.toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' });
};

// ─── Custom Marker ────────────────────────────────────────────────────────────
const AgentMarker = ({ agent, color, isSelected }) => {
  const name = agent.agent?.name || agent.name || 'Agent';
  return (
    <View style={[styles.markerWrapper, isSelected && styles.markerWrapperSelected]}>
      <View style={[styles.markerPin, { backgroundColor: color }]}>
        <Text style={styles.markerInitials}>{getInitials(name)}</Text>
      </View>
      <View style={[styles.markerTail, { borderTopColor: color }]} />
      {isSelected && <View style={[styles.markerRing, { borderColor: color }]} />}
    </View>
  );
};

// ─── Agent List Item ──────────────────────────────────────────────────────────
const AgentListItem = ({ agent, index, isSelected, onPress, isDark }) => {
  const name = agent.agent?.name || agent.name || 'Agent';
  const color = COLORS[index % COLORS.length];
  const id = agent.agent?._id || agent.agent_id || agent._id;

  return (
    <TouchableOpacity
      style={[
        styles.agentItem,
        isDark ? styles.agentItemDark : styles.agentItemLight,
        isSelected && (isDark ? styles.agentItemSelectedDark : styles.agentItemSelectedLight),
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left border accent */}
      <View style={[styles.agentItemAccent, { backgroundColor: isSelected ? '#2563eb' : 'transparent' }]} />

      <View style={[styles.agentAvatar, { backgroundColor: color }]}>
        <Text style={styles.agentAvatarText}>{getInitials(name)}</Text>
      </View>

      <View style={styles.agentInfo}>
        <Text
          style={[styles.agentName, isDark ? styles.textPrimaryDark : styles.textPrimaryLight]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text style={[styles.agentTime, isDark ? styles.textMutedDark : styles.textMutedLight]}>
          {formatTime(agent.timestamp)}
        </Text>
      </View>

      {isSelected && (
        <View style={styles.agentSelectedDot}>
          <View style={styles.agentSelectedDotInner} />
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AgentMap() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const mapRef = useRef(null);
  const [agents, setAgents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);
  const [bearing, setBearing] = useState(0);

  // Sidebar slide animation
  const sidebarAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  const openSidebar = () => {
    setShowSidebar(true);
    Animated.spring(sidebarAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: SCREEN_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(() => setShowSidebar(false));
  };

  // ── Fetch agents ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const token =
          (await AsyncStorage.getItem('token')) ||
          (await AsyncStorage.getItem('authToken')) ||
          (await AsyncStorage.getItem('accessToken'));

        const res = await fetch('/api/v1/location/all-latest', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await res.json();
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.locations)
          ? data.locations
          : [];
        setAgents(list);
      } catch (e) {
        setError('Failed to load location data.');
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  // ── Focus on agent ──────────────────────────────────────────────────────────
  const focusAgent = useCallback(
    (agent) => {
      const id = agent.agent?._id || agent.agent_id || agent._id;
      const lat = agent.lat || agent.latitude;
      const lng = agent.lng || agent.longitude;
      if (!lat || !lng) return;

      setSelected(id);
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 },
        500
      );
      if (showSidebar) closeSidebar();
    },
    [showSidebar]
  );

  // ── Rotate controls ─────────────────────────────────────────────────────────
  const rotateBy = (delta) => {
    const next = (((bearing + delta) % 360) + 360) % 360;
    setBearing(next);
    mapRef.current?.animateCamera({ heading: next }, { duration: 300 });
  };

  const resetNorth = () => {
    setBearing(0);
    mapRef.current?.animateCamera({ heading: 0, pitch: 0 }, { duration: 300 });
  };

  // ── Initial region ──────────────────────────────────────────────────────────
  const agentsWithLocation = agents.filter(
    (a) => (a.lat || a.latitude) && (a.lng || a.longitude)
  );

  const initialRegion =
    agentsWithLocation.length > 0
      ? {
          latitude: agentsWithLocation[0].lat || agentsWithLocation[0].latitude,
          longitude: agentsWithLocation[0].lng || agentsWithLocation[0].longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }
      : {
          latitude: 23.2599,
          longitude: 77.4126,
          latitudeDelta: 0.5,
          longitudeDelta: 0.5,
        };

  // ── Theme tokens ─────────────────────────────────────────────────────────────
  const t = isDark ? darkTheme : lightTheme;

  return (
    <View style={[styles.container, { borderColor: t.border }]}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <View style={[styles.topBar, { backgroundColor: t.headerBg, borderBottomColor: t.border }]}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveDot} />
          <Text style={[styles.topBarTitle, { color: t.textMuted }]}>LIVE MAP</Text>
        </View>
        <TouchableOpacity
          style={[styles.agentsBtn, { backgroundColor: t.cardBg, borderColor: t.border }]}
          onPress={openSidebar}
        >
          <Text style={{ fontSize: 12 }}>👥</Text>
          <Text style={[styles.agentsBtnText, { color: t.textMain }]}>
            Agents ({agents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Map ─────────────────────────────────────────────────────────────── */}
      <View style={styles.mapWrapper}>
        {loading ? (
          <View style={[styles.mapLoader, { backgroundColor: t.cardBg }]}>
            <ActivityIndicator color="#2563eb" size="large" />
            <Text style={[styles.mapLoaderText, { color: t.textMuted }]}>
              Loading agent locations...
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            rotateEnabled
            onRegionChange={(r, { isGesture }) => {
              // heading is not exposed directly in RN maps region, use camera
            }}
            onTouchEnd={async () => {
              // sync bearing from camera after gesture
              try {
                const cam = await mapRef.current?.getCamera();
                if (cam?.heading !== undefined) setBearing(Math.round(cam.heading));
              } catch (_) {}
            }}
          >
            {agentsWithLocation.map((agent, i) => {
              const id = agent.agent?._id || agent.agent_id || agent._id;
              const lat = agent.lat || agent.latitude;
              const lng = agent.lng || agent.longitude;
              const color = COLORS[i % COLORS.length];
              return (
                <Marker
                  key={id || i}
                  coordinate={{ latitude: lat, longitude: lng }}
                  onPress={() => focusAgent(agent)}
                  tracksViewChanges={false}
                >
                  <AgentMarker
                    agent={agent}
                    color={color}
                    isSelected={selected === id}
                  />
                </Marker>
              );
            })}
          </MapView>
        )}

        {/* ── Rotate controls (floating) ─────────────────────────────────── */}
        <View style={[styles.rotatePanel, { backgroundColor: t.panelBg, borderColor: t.border }]}>
          <View style={styles.rotateRow}>
            <TouchableOpacity
              style={[styles.rotateBtn, { backgroundColor: t.cardBg, borderColor: t.border }]}
              onPress={() => rotateBy(-30)}
            >
              <Text style={{ color: t.textMain, fontSize: 16 }}>↺</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rotateBtn, { backgroundColor: t.cardBg, borderColor: t.border }]}
              onPress={() => rotateBy(30)}
            >
              <Text style={{ color: t.textMain, fontSize: 16 }}>↻</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.bearingText, { color: t.textMuted }]}>{bearing}°</Text>
          <TouchableOpacity
            style={[styles.resetBtn, { backgroundColor: t.cardBg, borderColor: t.border }]}
            onPress={resetNorth}
          >
            <Text style={[styles.resetBtnText, { color: t.textMuted }]}>⬆ N</Text>
          </TouchableOpacity>
        </View>

        {/* ── My location btn ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.myLocBtn, { backgroundColor: t.cardBg, borderColor: t.border }]}
          onPress={() => {
            mapRef.current?.animateToRegion(initialRegion, 500);
          }}
        >
          <Text style={{ fontSize: 16 }}>🎯</Text>
        </TouchableOpacity>

        {/* ── No agents overlay ──────────────────────────────────────────── */}
        {!loading && agentsWithLocation.length === 0 && (
          <View style={styles.noAgentsOverlay} pointerEvents="none">
            <View style={styles.noAgentsBadge}>
              <Text style={styles.noAgentsText}>
                {error || 'No agents online'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Bottom Sheet Sidebar ─────────────────────────────────────────────── */}
      <Modal
        visible={showSidebar}
        transparent
        animationType="none"
        onRequestClose={closeSidebar}
      >
        <TouchableOpacity
          style={styles.sidebarOverlay}
          activeOpacity={1}
          onPress={closeSidebar}
        />
        <Animated.View
          style={[
            styles.sidebarSheet,
            { backgroundColor: t.cardBg, borderColor: t.border },
            { transform: [{ translateY: sidebarAnim }] },
          ]}
        >
          {/* Sheet handle */}
          <View style={styles.sheetHandle} />

          {/* Sheet header */}
          <View style={[styles.sheetHeader, { borderBottomColor: t.border, backgroundColor: t.headerBg }]}>
            <Text style={[styles.sheetHeaderTitle, { color: t.textMuted }]}>
              FIELD AGENTS
            </Text>
            <TouchableOpacity onPress={closeSidebar} style={styles.sheetCloseBtn}>
              <Text style={[styles.sheetCloseBtnText, { color: t.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Agent list */}
          <ScrollView
            style={styles.sheetList}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {error && (
              <View style={[styles.errorBanner, isDark ? styles.errorBannerDark : styles.errorBannerLight]}>
                <Text style={styles.errorBannerText}>⚠️ {error}</Text>
              </View>
            )}

            {agents.length === 0 && !error && (
              <View style={styles.emptyAgents}>
                <Text style={[styles.emptyAgentsText, { color: t.textMuted }]}>
                  No agents online.{'\n'}Location data will appear here.
                </Text>
              </View>
            )}

            {agents.map((agent, i) => {
              const id = agent.agent?._id || agent.agent_id || agent._id;
              return (
                <AgentListItem
                  key={id || i}
                  agent={agent}
                  index={i}
                  isSelected={selected === id}
                  onPress={() => focusAgent(agent)}
                  isDark={isDark}
                />
              );
            })}

            <View style={{ height: 32 }} />
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  topBarTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  agentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  agentsBtnText: { fontSize: 12, fontWeight: '600' },

  // Map
  mapWrapper: { height: 340, position: 'relative' },
  map: { flex: 1 },
  mapLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  mapLoaderText: { fontSize: 13, marginTop: 8 },

  // Marker
  markerWrapper: { alignItems: 'center' },
  markerWrapperSelected: { transform: [{ scale: 1.15 }] },
  markerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  markerInitials: { color: '#fff', fontSize: 12, fontWeight: '700' },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  markerRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    opacity: 0.4,
  },

  // Rotate panel
  rotatePanel: {
    position: 'absolute',
    top: 10,
    right: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  rotateRow: { flexDirection: 'row', gap: 4 },
  rotateBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bearingText: { fontSize: 10, fontWeight: '700' },
  resetBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetBtnText: { fontSize: 10, fontWeight: '600' },

  // My location btn
  myLocBtn: {
    position: 'absolute',
    bottom: 12,
    right: 10,
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  // No agents
  noAgentsOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noAgentsBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  noAgentsText: { color: '#fff', fontSize: 13 },

  // Sidebar / Bottom sheet
  sidebarOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sidebarSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: SCREEN_HEIGHT * 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  sheetHeaderTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },
  sheetCloseBtn: { padding: 4 },
  sheetCloseBtnText: { fontSize: 16 },
  sheetList: { flex: 1 },

  // Agent list item
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingRight: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    gap: 10,
  },
  agentItemLight: { backgroundColor: 'transparent' },
  agentItemDark: { backgroundColor: 'transparent' },
  agentItemSelectedLight: { backgroundColor: '#EFF6FF' },
  agentItemSelectedDark: { backgroundColor: '#1e3a5f' },
  agentItemAccent: { width: 3, height: '100%', borderRadius: 2, marginRight: 2 },
  agentAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  agentAvatarText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  agentInfo: { flex: 1, minWidth: 0 },
  agentName: { fontSize: 13, fontWeight: '600' },
  agentTime: { fontSize: 11, marginTop: 2 },
  agentSelectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb', opacity: 0.8 },
  agentSelectedDotInner: { flex: 1 },

  // Error
  errorBanner: { padding: 12, margin: 10, borderRadius: 8 },
  errorBannerLight: { backgroundColor: '#FEF2F2' },
  errorBannerDark: { backgroundColor: '#2d1515' },
  errorBannerText: { color: '#ef4444', fontSize: 12 },

  // Empty
  emptyAgents: { padding: 24, alignItems: 'center' },
  emptyAgentsText: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Text utilities
  textPrimaryLight: { color: '#111827' },
  textPrimaryDark: { color: '#F9FAFB' },
  textMutedLight: { color: '#6B7280' },
  textMutedDark: { color: '#9CA3AF' },
});

// ─── Theme tokens ─────────────────────────────────────────────────────────────
const lightTheme = {
  cardBg: '#FFFFFF',
  headerBg: '#F9FAFB',
  border: '#E5E7EB',
  textMain: '#111827',
  textMuted: '#6B7280',
  panelBg: 'rgba(255,255,255,0.92)',
};

const darkTheme = {
  cardBg: '#1E293B',
  headerBg: '#1a2030',
  border: '#334155',
  textMain: '#F1F5F9',
  textMuted: '#9CA3AF',
  panelBg: 'rgba(30,37,51,0.92)',
};
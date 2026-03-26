import { useState, useEffect, useRef } from "react";
import { useSpring, animated } from "@react-spring/web";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  fetchTrafficStats,
  fetchTrafficHistory,
  subscribeToTrafficUpdates,
  trackPageView,
  updateSessionActivity,
  type TrafficStats,
  type TrafficDataPoint,
} from "../lib/traffic-analytics";

interface DeviceData {
  name: string;
  value: number;
}

// Animated counter component
function AnimatedCounter({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const spring = useSpring({
    val: value,
    from: { val: 0 },
    config: { tension: 120, friction: 14 },
  });

  return (
    <div className="traffic-stat-card">
      <animated.span className="traffic-stat-value">
        {spring.val.to((v) => Math.floor(v).toLocaleString() + suffix)}
      </animated.span>
      <span className="traffic-stat-label">{label}</span>
    </div>
  );
}

// Pulsing live indicator
function LiveIndicator() {
  return (
    <div className="live-indicator">
      <span className="live-dot"></span>
      <span className="live-text">LIVE</span>
    </div>
  );
}

export default function RealtimeTrafficStats() {
  const [stats, setStats] = useState<TrafficStats>({
    activeUsers: 0,
    totalPageViews: 0,
    avgSessionDuration: 0,
    newVisitors: 0,
    deviceBreakdown: { desktop: 0, mobile: 0, tablet: 0 },
    trafficSources: { direct: 0, social: 0, organic: 0, referral: 0 },
  });
  const [trafficHistory, setTrafficHistory] = useState<TrafficDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const activityIntervalRef = useRef<number | null>(null);

  // Fade-in animation for the section
  const fadeSpring = useSpring({
    from: { opacity: 0, transform: "translateY(30px)" },
    to: { opacity: 1, transform: "translateY(0px)" },
    config: { tension: 180, friction: 22 },
  });

  // Calculate device breakdown percentages
  const getDeviceData = (): DeviceData[] => {
    const total = stats.deviceBreakdown.desktop + stats.deviceBreakdown.mobile + stats.deviceBreakdown.tablet;
    if (total === 0) {
      return [
        { name: "Desktop", value: 0 },
        { name: "Mobile", value: 0 },
        { name: "Tablet", value: 0 },
      ];
    }
    return [
      { name: "Desktop", value: Math.round((stats.deviceBreakdown.desktop / total) * 100) },
      { name: "Mobile", value: Math.round((stats.deviceBreakdown.mobile / total) * 100) },
      { name: "Tablet", value: Math.round((stats.deviceBreakdown.tablet / total) * 100) },
    ];
  };

  // Calculate traffic source percentages
  const getSourcePercentages = () => {
    const total = stats.trafficSources.direct + stats.trafficSources.social +
                  stats.trafficSources.organic + stats.trafficSources.referral;
    if (total === 0) {
      return { direct: 0, social: 0, organic: 0, referral: 0 };
    }
    return {
      direct: Math.round((stats.trafficSources.direct / total) * 100),
      social: Math.round((stats.trafficSources.social / total) * 100),
      organic: Math.round((stats.trafficSources.organic / total) * 100),
      referral: Math.round((stats.trafficSources.referral / total) * 100),
    };
  };

  // Initial data fetch and tracking
  useEffect(() => {
    const initializeTracking = async () => {
      // Track this page view
      await trackPageView('/landing');

      // Fetch initial stats
      const [initialStats, history] = await Promise.all([
        fetchTrafficStats(),
        fetchTrafficHistory(),
      ]);

      setStats(initialStats);
      setTrafficHistory(history);
      setLoading(false);
    };

    initializeTracking();

    // Subscribe to realtime updates
    const unsubscribe = subscribeToTrafficUpdates((newStats) => {
      setStats(newStats);
    });

    // Periodically refresh history data (every 5 minutes since it's daily data)
    intervalRef.current = window.setInterval(async () => {
      const history = await fetchTrafficHistory();
      setTrafficHistory(history);
    }, 300000);

    // Update session activity every minute
    activityIntervalRef.current = window.setInterval(() => {
      updateSessionActivity();
    }, 60000);

    return () => {
      unsubscribe();
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    };
  }, []);

  const sourcePercentages = getSourcePercentages();
  const deviceData = getDeviceData();

  if (loading) {
    return (
      <section className="traffic-stats-section" id="traffic">
        <div className="traffic-stats-container">
          <div className="traffic-header">
            <div className="traffic-title-area">
              <h2 className="traffic-title">Realtime User Traffic</h2>
              <p className="traffic-subtitle">Loading analytics data...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <animated.section style={fadeSpring} className="traffic-stats-section" id="traffic">
      <div className="traffic-stats-container">
        {/* Header */}
        <div className="traffic-header">
          <div className="traffic-title-area">
            <h2 className="traffic-title">Realtime User Traffic</h2>
            <p className="traffic-subtitle">Live analytics and user engagement metrics</p>
          </div>
          <LiveIndicator />
        </div>

        {/* Stats Cards */}
        <div className="traffic-stats-grid">
          <AnimatedCounter value={stats.activeUsers} label="Active Users" />
          <AnimatedCounter value={stats.totalPageViews} label="Total Page Views" />
          <AnimatedCounter value={stats.avgSessionDuration} label="Avg. Session" suffix="s" />
          <AnimatedCounter value={stats.newVisitors} label="New Visitors" />
        </div>

        {/* Charts Grid */}
        <div className="traffic-charts-grid">
          {/* Main Line Chart - Active Users By Date */}
          <div className="traffic-chart-card traffic-chart-main">
            <h3 className="chart-title">Active Users (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={trafficHistory}>
                <defs>
                  <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis
                  dataKey="time"
                  stroke="#666"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  fill="url(#userGradient)"
                  animationDuration={300}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Page Views Chart */}
          <div className="traffic-chart-card">
            <h3 className="chart-title">Page Views (Daily)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trafficHistory} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="time" stroke="#666" fontSize={9} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" fontSize={10} tickLine={false} axisLine={false} width={30} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pageViews"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#06b6d4" }}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Device Distribution */}
          <div className="traffic-chart-card">
            <h3 className="chart-title">Device Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deviceData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" stroke="#666" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#666"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a1a",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value) => [`${value}%`, "Share"]}
                />
                <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic Sources Mini Cards */}
        <div className="traffic-sources">
          <div className="traffic-source-card">
            <span className="source-icon" style={{ backgroundColor: "#3b82f6" }}>D</span>
            <div className="source-info">
              <span className="source-name">Direct</span>
              <span className="source-percent">{sourcePercentages.direct}%</span>
            </div>
          </div>
          <div className="traffic-source-card">
            <span className="source-icon" style={{ backgroundColor: "#ef4444" }}>S</span>
            <div className="source-info">
              <span className="source-name">Social</span>
              <span className="source-percent">{sourcePercentages.social}%</span>
            </div>
          </div>
          <div className="traffic-source-card">
            <span className="source-icon" style={{ backgroundColor: "#22c55e" }}>O</span>
            <div className="source-info">
              <span className="source-name">Organic</span>
              <span className="source-percent">{sourcePercentages.organic}%</span>
            </div>
          </div>
          <div className="traffic-source-card">
            <span className="source-icon" style={{ backgroundColor: "#f59e0b" }}>R</span>
            <div className="source-info">
              <span className="source-name">Referral</span>
              <span className="source-percent">{sourcePercentages.referral}%</span>
            </div>
          </div>
        </div>
      </div>
    </animated.section>
  );
}

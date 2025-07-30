-- lighthouse CI performance testing schema
-- extends existing database with lighthouse-specific tables

-- lighthouse test results table
CREATE TABLE IF NOT EXISTS lighthouse_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  config TEXT NOT NULL DEFAULT 'desktop', -- 'desktop' or 'mobile'
  
  -- lighthouse scores (0-1 scale)
  performance_score REAL NOT NULL,
  accessibility_score REAL NOT NULL,
  best_practices_score REAL NOT NULL,
  seo_score REAL NOT NULL,
  
  -- core web vitals (milliseconds, except CLS)
  lcp REAL NOT NULL, -- largest contentful paint
  fcp REAL NOT NULL, -- first contentful paint
  cls REAL NOT NULL, -- cumulative layout shift (0-1 scale)
  tbt REAL NOT NULL, -- total blocking time
  si REAL NOT NULL,  -- speed index
  tti REAL NOT NULL, -- time to interactive
  ttfb REAL,         -- time to first byte
  
  -- additional metrics
  total_byte_weight INTEGER DEFAULT 0,
  unused_css_rules INTEGER DEFAULT 0,
  unused_javascript INTEGER DEFAULT 0,
  render_blocking_resources REAL DEFAULT 0,
  
  -- environment data (JSON)
  environment_data TEXT,
  
  -- metadata
  commit_hash TEXT,
  branch_name TEXT,
  build_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- lighthouse baselines table (stores best results for comparison)
CREATE TABLE IF NOT EXISTS lighthouse_baselines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT 'desktop',
  result_id INTEGER NOT NULL,
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  
  FOREIGN KEY (result_id) REFERENCES lighthouse_results(id) ON DELETE CASCADE,
  UNIQUE(url, config)
);

-- performance regressions table
CREATE TABLE IF NOT EXISTS performance_regressions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lighthouse_result_id INTEGER NOT NULL,
  baseline_result_id INTEGER NOT NULL,
  
  -- regression details
  metric_name TEXT NOT NULL, -- 'performance_score', 'lcp', 'fcp', etc.
  current_value REAL NOT NULL,
  baseline_value REAL NOT NULL,
  regression_percentage REAL NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  
  -- metadata
  detected_at INTEGER DEFAULT (strftime('%s', 'now')),
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at INTEGER,
  resolution_notes TEXT,
  
  FOREIGN KEY (lighthouse_result_id) REFERENCES lighthouse_results(id) ON DELETE CASCADE,
  FOREIGN KEY (baseline_result_id) REFERENCES lighthouse_results(id) ON DELETE CASCADE
);

-- performance trends aggregation table
CREATE TABLE IF NOT EXISTS performance_trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT 'desktop',
  metric_name TEXT NOT NULL,
  
  -- trend analysis
  trend_direction TEXT NOT NULL DEFAULT 'stable', -- 'improving', 'stable', 'degrading'
  trend_strength REAL NOT NULL DEFAULT 0, -- 0-1 scale
  
  -- time period
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  sample_count INTEGER NOT NULL,
  
  -- statistical data
  avg_value REAL NOT NULL,
  min_value REAL NOT NULL,
  max_value REAL NOT NULL,
  std_deviation REAL,
  
  -- metadata
  calculated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- lighthouse CI configuration table
CREATE TABLE IF NOT EXISTS lighthouse_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  config_data TEXT NOT NULL, -- JSON configuration
  is_active BOOLEAN DEFAULT TRUE,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alert_type TEXT NOT NULL, -- 'regression', 'budget_exceeded', 'threshold_violation'
  severity TEXT NOT NULL DEFAULT 'medium',
  
  -- alert details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  url TEXT NOT NULL,
  metric_name TEXT,
  current_value REAL,
  threshold_value REAL,
  
  -- related records
  lighthouse_result_id INTEGER,
  regression_id INTEGER,
  
  -- alert status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved'
  acknowledged_by TEXT,
  acknowledged_at INTEGER,
  resolved_at INTEGER,
  resolution_notes TEXT,
  
  -- metadata
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  
  FOREIGN KEY (lighthouse_result_id) REFERENCES lighthouse_results(id) ON DELETE SET NULL,
  FOREIGN KEY (regression_id) REFERENCES performance_regressions(id) ON DELETE SET NULL
);

-- create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lighthouse_results_url_timestamp ON lighthouse_results(url, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_lighthouse_results_config ON lighthouse_results(config);
CREATE INDEX IF NOT EXISTS idx_lighthouse_results_performance_score ON lighthouse_results(performance_score);
CREATE INDEX IF NOT EXISTS idx_lighthouse_results_lcp ON lighthouse_results(lcp);
CREATE INDEX IF NOT EXISTS idx_lighthouse_results_created_at ON lighthouse_results(created_at);

CREATE INDEX IF NOT EXISTS idx_lighthouse_baselines_url_config ON lighthouse_baselines(url, config);

CREATE INDEX IF NOT EXISTS idx_performance_regressions_severity ON performance_regressions(severity);
CREATE INDEX IF NOT EXISTS idx_performance_regressions_detected_at ON performance_regressions(detected_at);
CREATE INDEX IF NOT EXISTS idx_performance_regressions_acknowledged ON performance_regressions(acknowledged);

CREATE INDEX IF NOT EXISTS idx_performance_trends_url_config ON performance_trends(url, config);
CREATE INDEX IF NOT EXISTS idx_performance_trends_metric ON performance_trends(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_trends_period ON performance_trends(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_performance_alerts_status ON performance_alerts(status);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_created_at ON performance_alerts(created_at);

-- create views for common queries
CREATE VIEW IF NOT EXISTS lighthouse_results_summary AS
SELECT 
  url,
  config,
  COUNT(*) as total_tests,
  AVG(performance_score) as avg_performance,
  AVG(lcp) as avg_lcp,
  AVG(fcp) as avg_fcp,
  AVG(cls) as avg_cls,
  AVG(tbt) as avg_tbt,
  MIN(timestamp) as first_test,
  MAX(timestamp) as last_test
FROM lighthouse_results 
GROUP BY url, config;

CREATE VIEW IF NOT EXISTS recent_performance_regressions AS
SELECT 
  pr.*,
  lr.url,
  lr.timestamp as test_timestamp,
  bl.result_id as baseline_result_id
FROM performance_regressions pr
JOIN lighthouse_results lr ON pr.lighthouse_result_id = lr.id
JOIN lighthouse_baselines bl ON pr.baseline_result_id = bl.result_id
WHERE pr.detected_at > strftime('%s', 'now', '-7 days')
  AND pr.acknowledged = FALSE
ORDER BY pr.detected_at DESC;

CREATE VIEW IF NOT EXISTS performance_alerts_summary AS
SELECT 
  status,
  severity,
  COUNT(*) as alert_count,
  MIN(created_at) as oldest_alert,
  MAX(created_at) as newest_alert
FROM performance_alerts
WHERE created_at > strftime('%s', 'now', '-30 days')
GROUP BY status, severity;

-- insert default lighthouse CI configuration
INSERT OR IGNORE INTO lighthouse_config (name, config_data) VALUES 
('default-desktop', '{"preset": "desktop", "throttling": {"rttMs": 40, "throughputKbps": 10240, "cpuSlowdownMultiplier": 1}}'),
('default-mobile', '{"preset": "mobile", "throttling": {"rttMs": 150, "throughputKbps": 1638.4, "cpuSlowdownMultiplier": 4}}');

-- insert sample performance budgets
INSERT OR IGNORE INTO performance_alerts (
  alert_type, 
  title, 
  message, 
  url, 
  metric_name, 
  threshold_value,
  status
) VALUES 
('budget_exceeded', 'Performance Score Budget', 'Performance score should be >= 95', '*', 'performance_score', 0.95, 'active'),
('budget_exceeded', 'LCP Budget', 'Largest Contentful Paint should be <= 2.5s', '*', 'lcp', 2500, 'active'),
('budget_exceeded', 'CLS Budget', 'Cumulative Layout Shift should be <= 0.1', '*', 'cls', 0.1, 'active'),
('budget_exceeded', 'TBT Budget', 'Total Blocking Time should be <= 200ms', '*', 'tbt', 200, 'active');
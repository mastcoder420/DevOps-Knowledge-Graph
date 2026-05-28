export interface HistoricalPostMortem {
  incident_id: string;
  company: string;
  title: string;
  date: string;
  symptoms: string;
  root_cause: string;
  resolution: string;
  remediation_commands: string[];
  severity: "CRITICAL" | "MAJOR";
}

export const postMortemsDatabase: HistoricalPostMortem[] = [
  {
    incident_id: "PM-AWS-S3-2017",
    company: "Amazon Web Services (AWS)",
    title: "S3 US-EAST-1 Outage and Index Subsystem Failure",
    date: "2017-02-28",
    symptoms: "High rates of HTTP 500 and 503 errors on S3 API calls in US-EAST-1. Cascading outages hit dependent services including EC2, EBS, Lambda, and thousands of external websites relying on S3 storage buckets.",
    root_cause: "An authorized S3 operator executed an automated command-line script to remove a small number of billing servers. A typo in one of the command parameters caused the script to terminate a much larger set of servers than intended, including servers belonging to two critical S3 subsystems: the index subsystem (manages metadata/mappings) and the placement subsystem (allocates new storage slots). Since the subsystems had not been restarted fully in years, the recovery/re-indexing took hours to complete.",
    resolution: "The billing servers and both the index and placement subsystems had to undergo a slow, sequence-controlled cold start. Safety checks were implemented in CLI provisioning tools to prevent bulk terminations of core subsystem groups, and the S3 index service was split into smaller partition clusters.",
    remediation_commands: [
      "# Limit blast radius of server terminations via safety flags",
      "aws-sre-tool limit-blast-radius --subsystem s3-index --max-terminate-percent 5",
      "# Trigger sequencial rolling recovery of the indexing cluster",
      "systemctl restart s3-index-node-01.service --sequence-control=strict"
    ],
    severity: "CRITICAL"
  },
  {
    incident_id: "PM-CLOUDFLARE-WAF-2019",
    company: "Cloudflare",
    title: "Global Edge WAF CPU Exhaustion and Service Interruption",
    date: "2019-07-02",
    symptoms: "HTTP 502 Bad Gateway errors returned globally. Cloudflare edge CPU utilization spiked to 100% on all proxy engines, blocking HTTP request parsing and taking down millions of active web applications worldwide.",
    root_cause: "A deployment of a new Web Application Firewall (WAF) rule designed to block cross-site scripting (XSS) attacks contained a poorly optimized regular expression: `(?:.*=.*)`. A specific incoming query triggered catastrophic regular expression backtracking, causing the Nginx/Lua regex engine to loop infinitely, pegging all available CPU cores on edge proxy nodes.",
    resolution: "SREs isolated the faulty WAF rule and executed a global emergency rollback of WAF configurations. The regex engine was modified to enforce strict execution timeouts and compile-time backtracking limits.",
    remediation_commands: [
      "# Emergency global bypass of Web Application Firewall (WAF) rules",
      "cf-edge-cli waf --bypass-ruleset global_xss_block",
      "# Re-compile and deploy WAF configurations with backtracking thresholds",
      "cf-waf-compiler --validate-regex-backtracking --max-backtracks 1000 --out /etc/nginx/waf.rules"
    ],
    severity: "CRITICAL"
  },
  {
    incident_id: "PM-GITLAB-DB-2017",
    company: "GitLab",
    title: "Accidental Production Database Deletion and Multi-Backup Restore Failures",
    date: "2017-01-31",
    symptoms: "Complete GitLab.com site offline. Primary database directory vanished, all API and web requests throwing database connection failures. 6 hours of user production data (repos, issues, comments) permanently deleted.",
    root_cause: "A tired sysadmin attempting to fix a lagging staging replica database accidentally ran `rm -rf` on the production PostgreSQL directory `/var/opt/gitlab/postgresql/data` of the primary database server instead of the staging replica. Subsequent investigation revealed that five redundant backup mechanisms (pg_dump, Azure snapshotting, LVM snapshots, S3 sync) had silently been failing due to permission issues, mismatched PostgreSQL version binaries, or unmonitored cron jobs.",
    resolution: "SREs manually reconstructed the database using a 6-hour-old staging db snapshot, re-synced orphaned Git repositories, and overhauled back-up automation with active heartbeat monitoring and automated test-restoration dry-runs.",
    remediation_commands: [
      "# Check PostgreSQL database size and configuration paths",
      "pg_controldata -D /var/opt/gitlab/postgresql/data",
      "# Re-initialize WAL archival syncing and verify backup stream integrity",
      "pg_basebackup -h primary-db -D /var/opt/gitlab/postgresql/data -U replication --wal-method=stream"
    ],
    severity: "CRITICAL"
  },
  {
    incident_id: "PM-GITHUB-DB-2018",
    company: "GitHub",
    title: "Database Failover, Split-Brain and Write Block Outage",
    date: "2018-10-21",
    symptoms: "Storefront and repository dashboards showing database read-only blocks. Users unable to commit code, merge pull requests, or authenticate. Outage lasted 24 hours.",
    root_cause: "During routine network maintenance replacing a pair of optical fiber switches, a brief 43-second network split occurred between GitHub's primary database cluster and its remote replicas. The orchestrator (database high-availability manager) initiated an automated failover, promoting a replica in a secondary data center to primary. However, the replica was slightly out-of-sync. When the network split resolved, the old primary continued writing while the new primary accepted new connections, causing a classic database split-brain scenario.",
    resolution: "SREs blocked database writes, manually reconciliated out-of-sync transaction logs, and re-synchronized the replica nodes to the designated master before unlocking writes. Automated failover triggers were updated to require quorum checks across multiple distinct availability zones.",
    remediation_commands: [
      "# Query database cluster topology and check replication lag",
      "orchestrator-client -c discover -i db-primary-01.github.net",
      "# Block all database writes on out-of-sync database clusters",
      "mysql -e 'SET GLOBAL read_only = 1;'"
    ],
    severity: "MAJOR"
  },
  {
    incident_id: "PM-GOOGLE-LB-2014",
    company: "Google",
    title: "Global Load Balancer Blackhole Configuration Outage",
    date: "2014-04-18",
    symptoms: "Google search, Gmail, YouTube, and Google Cloud services unreachable globally. Users received 502/504 errors, and DNS requests were dropped or timed out.",
    root_cause: "Google deployed an update to its global software-defined load balancer (GSLB) configuration. A bug in the configuration translation tool failed to parse empty fields in a routing block correctly. It generated a configuration that instructed edge routers to blackhole all incoming HTTP/HTTPS traffic by setting the default route interface to null, dropping packet telemetry immediately.",
    resolution: "The GSLB control plane executed a automatic emergency fallback to the previous known-good configuration. GSLB compilers were updated with static safety assertions to prevent null-route assignments.",
    remediation_commands: [
      "# Check router default route tables for blackhole routes",
      "ip route show | grep null",
      "# Force rollback GSLB configuration to the previous validated epoch",
      "gslb-control-client rollback --target-epoch 80112 --force"
    ],
    severity: "CRITICAL"
  }
];

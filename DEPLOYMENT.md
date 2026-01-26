# Deployment Guide

This guide explains how to host the Tier List MCP Server on a Linux machine using Apache as a reverse proxy.

## Prerequisites
-   Linux server (Ubuntu/Debian assumed)
-   Node.js & npm installed
-   Apache2 installed

## 1. Installation on Server

Clone the repo and build:

```bash
cd /opt
git clone <your-repo-url> tier-list-mcp
cd tier-list-mcp
npm install
npm run build
```

## 2. Systemd Service

Create a service file to keep the server running.

**File:** `/etc/systemd/system/tier-mcp.service`

```ini
[Unit]
Description=Tier List MCP Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/tier-list-mcp
Environment=MCP_TRANSPORT=sse
Environment=PORT=3000
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable tier-mcp
sudo systemctl start tier-mcp
```

## 3. Apache Configuration

Configure Apache to proxy requests to the local Node.js server.
Ensure modules are enabled: `a2enmod proxy proxy_http proxy_wstunnel rewrite`

**File:** `/etc/apache2/sites-available/tier-mcp.conf`

```apache
<VirtualHost *:80>
    ServerName tier-mcp.yourdomain.com

    ProxyPreserveHost On
    ProxyRequests Off

    # Proxy SSE endpoint
    ProxyPass /sse http://localhost:3000/sse flushpackets=on
    ProxyPassReverse /sse http://localhost:3000/sse

    # Proxy Messages endpoint
    ProxyPass /messages http://localhost:3000/messages
    ProxyPassReverse /messages http://localhost:3000/messages

    # Optional: logs
    ErrorLog ${APACHE_LOG_DIR}/tier-mcp-error.log
    CustomLog ${APACHE_LOG_DIR}/tier-mcp-access.log combined
</VirtualHost>
```

Enable site:
```bash
sudo a2ensite tier-mcp
sudo systemctl reload apache2
```

## 4. Connecting a Client

Your MCP client (e.g., Claude Desktop) needs to be configured to connect to the SSE endpoint.

**Client Config:**
```json
{
    }
  }
}
```

## 5. Security & Performance (Rate Limiting)
To protect your server from high utilization (DoS) or abusive clients, configure Apache to limit requests.

### A. Limit Concurrent Connections (503 Service Unavailable)
Prevent the server from being overwhelmed by too many simultaneous users.

Update `/etc/apache2/mods-enabled/mpm_event.conf` (or similar depending on your MPM):
```apache
<IfModule mpm_event_module>
    # Limit to 150 simultaneous connections
    MaxRequestWorkers 150
</IfModule>
```

### B. Rate Limiting per IP (429 Too Many Requests)
Install `mod_evasive` to block clients hammering the server.
```bash
sudo apt install libapache2-mod-evasive
```
Configure `/etc/apache2/mods-enabled/evasive.conf`:
```apache
<IfModule mod_evasive20.c>
    DOSHashTableSize    3097
    DOSPageCount        5        # Max 5 requests to same page
    DOSPageInterval     1        # ... per 1 second
    DOSSiteCount        50       # Max 50 requests to site overall
    DOSSiteInterval     1        # ... per 1 second
    DOSBlockingPeriod   10       # Block IP for 10 seconds if limit exceeded
</IfModule>
```

## 6. Security (SSL/TLS)

Since this server allows public execution of code/tools, it is **highly recommended** to use HTTPS.

Install Certbot:
```bash
sudo apt install certbot python3-certbot-apache
```

Run Certbot to automatically configure SSL for your domain:
```bash
sudo certbot --apache -d tier-mcp.yourdomain.com
```

This will automatically redirect HTTP traffic to HTTPS.

**Client Config (Update):**
```json
{
  "mcpServers": {
    "tier-list-remote": {
      "endpoint": "https://tier-mcp.yourdomain.com/sse"
    }
  }
}
```


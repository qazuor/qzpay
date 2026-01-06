# QZPay Load Tests

Performance and load testing suite using [k6](https://k6.io/).

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

## Available Tests

### 1. Customer API Load Test

Tests customer management endpoints (create, read, update, list).

```bash
k6 run customer-api.load.js
```

### 2. Payment API Load Test

Tests payment processing performance.

```bash
k6 run payment-api.load.js
```

### 3. Subscription API Load Test

Tests subscription lifecycle operations.

```bash
k6 run subscription-api.load.js
```

### 4. Webhook Processing Load Test

Stress tests webhook ingestion and processing.

```bash
k6 run webhook-api.load.js
```

### 5. Mixed Workload Test

Simulates realistic mixed traffic patterns.

```bash
k6 run mixed-workload.load.js
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BASE_URL` | API base URL | `http://localhost:3000` |
| `API_KEY` | API authentication key | `sk_test_load_test_key` |
| `WEBHOOK_SECRET` | Webhook signing secret | `whsec_test_secret` |

### Example with Custom Config

```bash
k6 run \
  --env BASE_URL=https://api.example.com \
  --env API_KEY=sk_live_xxx \
  customer-api.load.js
```

## Test Types

### Standard Load Test (default)

```bash
k6 run customer-api.load.js
```

Ramps up to 50 virtual users over 4 minutes.

### Stress Test

```bash
k6 run --config stress.json customer-api.load.js
```

Pushes the system to 300+ virtual users to find breaking points.

### Spike Test

```bash
k6 run --config spike.json customer-api.load.js
```

Tests sudden traffic spikes (10 → 500 → 10 users).

### Soak Test

```bash
k6 run --config soak.json customer-api.load.js
```

Extended 30+ minute test for memory leak detection.

### Quick Test

```bash
k6 run --vus 10 --duration 30s customer-api.load.js
```

Quick validation with 10 users for 30 seconds.

## Thresholds

Default pass/fail criteria:

| Metric | Threshold |
|--------|-----------|
| `http_req_duration` | p(95) < 500ms |
| `http_req_failed` | < 1% |
| `http_reqs` | > 10 req/s |

## Output Formats

### Console Summary (default)

```bash
k6 run customer-api.load.js
```

### JSON Output

```bash
k6 run --out json=results.json customer-api.load.js
```

### CSV Output

```bash
k6 run --out csv=results.csv customer-api.load.js
```

### InfluxDB + Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 customer-api.load.js
```

### Cloud (k6 Cloud)

```bash
k6 cloud customer-api.load.js
```

## Docker Usage

```bash
docker run --rm -v $(pwd):/scripts grafana/k6 run /scripts/customer-api.load.js
```

With network access to local API:

```bash
docker run --rm \
  --network host \
  -v $(pwd):/scripts \
  -e BASE_URL=http://localhost:3000 \
  grafana/k6 run /scripts/customer-api.load.js
```

## Custom Metrics

Each test exports custom metrics:

- `customers_created` - Counter of successfully created customers
- `payments_processed` - Counter of processed payments
- `payment_processing_time` - Trend of payment processing latency
- `webhooks_processed` - Counter of processed webhooks
- `operation_latency` - Trend of overall operation latency

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run load tests
  uses: grafana/k6-action@v0.3.1
  with:
    filename: e2e/load/customer-api.load.js
  env:
    BASE_URL: ${{ secrets.API_URL }}
    API_KEY: ${{ secrets.API_KEY }}
```

### GitLab CI

```yaml
load_test:
  image: grafana/k6:latest
  script:
    - k6 run e2e/load/customer-api.load.js
  variables:
    BASE_URL: $API_URL
```

## Best Practices

1. **Warm up the system** before running load tests
2. **Use realistic data** patterns
3. **Monitor infrastructure** during tests
4. **Run from multiple locations** for distributed testing
5. **Compare results** against baselines
6. **Clean up test data** after tests

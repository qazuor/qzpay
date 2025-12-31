# Functional Requirements: Background Jobs

Requirements for scheduled background jobs that power billing automation.

## Table of Contents

1. [Overview](#overview)
2. [Job Registry](#job-registry)
3. [FR-JOBS-001: Process Trial Expirations](#fr-jobs-001-process-trial-expirations)
4. [FR-JOBS-002: Retry Failed Payments](#fr-jobs-002-retry-failed-payments)
5. [FR-JOBS-003: Sync Provider Status](#fr-jobs-003-sync-provider-status)
6. [FR-JOBS-004: Send Expiration Reminders](#fr-jobs-004-send-expiration-reminders)
7. [FR-JOBS-005: Process Grace Period Expirations](#fr-jobs-005-process-grace-period-expirations)
8. [FR-JOBS-006: Cleanup Expired Sessions](#fr-jobs-006-cleanup-expired-sessions)
9. [FR-JOBS-007: Generate Scheduled Reports](#fr-jobs-007-generate-scheduled-reports)
10. [Job Execution API](#job-execution-api)
11. [Monitoring and Alerting](#monitoring-and-alerting)

---

## Overview

Background jobs are essential for billing operations that cannot be triggered by user actions or webhooks. They ensure:

1. **Trial management**: Expire trials, send reminders
2. **Payment recovery**: Retry failed payments on schedule
3. **Data consistency**: Sync with payment providers
4. **Notifications**: Send time-based reminders
5. **Cleanup**: Remove stale data

### Design Principles

1. **Idempotent**: Jobs can be run multiple times safely
2. **Resumable**: Jobs can be interrupted and continued
3. **Observable**: All job runs are logged and monitored
4. **Configurable**: Job schedules can be adjusted without code changes
5. **Testable**: Jobs can be triggered manually for testing

---

## Job Registry

### Built-in Jobs

| Job ID | Description | Default Schedule | Priority |
|--------|-------------|------------------|----------|
| `process-trial-expirations` | Handle expired trials | Hourly | Critical |
| `retry-failed-payments` | Retry payments in grace period | Every 6 hours | Critical |
| `sync-provider-status` | Sync subscription status | Daily at 2am UTC | High |
| `send-trial-reminders` | Remind users of expiring trials | Daily at 9am UTC | High |
| `send-subscription-reminders` | Remind of upcoming renewals | Daily at 9am UTC | Medium |
| `process-grace-expirations` | Cancel subscriptions after grace | Hourly | Critical |
| `cleanup-expired-sessions` | Remove expired checkout sessions | Daily at 3am UTC | Low |
| `cleanup-old-webhooks` | Archive old webhook events | Weekly | Low |
| `generate-daily-report` | Generate billing metrics | Daily at 6am UTC | Medium |
| `process-scheduled-changes` | Apply scheduled plan changes | Hourly | High |

### Job Configuration Schema

```typescript
interface JobConfiguration {
  /** Unique job identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Job description */
  description: string;

  /** Cron expression for schedule */
  schedule: string;

  /** Whether job is enabled */
  enabled: boolean;

  /** Maximum execution time (ms) */
  timeout: number;

  /** Maximum retries on failure */
  maxRetries: number;

  /** Batch size for processing */
  batchSize: number;

  /** Job-specific configuration */
  config?: Record<string, unknown>;
}
```

### Default Configuration

```typescript
const defaultJobConfigs: JobConfiguration[] = [
  {
    id: 'process-trial-expirations',
    name: 'Process Trial Expirations',
    description: 'Handle subscriptions where trial has ended',
    schedule: '0 * * * *', // Every hour
    enabled: true,
    timeout: 300000, // 5 minutes
    maxRetries: 3,
    batchSize: 100,
  },
  {
    id: 'retry-failed-payments',
    name: 'Retry Failed Payments',
    description: 'Retry payments for subscriptions in grace period',
    schedule: '0 */6 * * *', // Every 6 hours
    enabled: true,
    timeout: 600000, // 10 minutes
    maxRetries: 3,
    batchSize: 50,
    config: {
      retryIntervals: [1, 3, 5, 7], // Days after failure
      maxAttempts: 4,
    },
  },
  {
    id: 'send-trial-reminders',
    name: 'Send Trial Reminders',
    description: 'Send emails to users with expiring trials',
    schedule: '0 9 * * *', // Daily at 9am UTC
    enabled: true,
    timeout: 300000,
    maxRetries: 2,
    batchSize: 200,
    config: {
      reminderDays: [3, 1], // Days before expiration
    },
  },
  {
    id: 'process-grace-expirations',
    name: 'Process Grace Period Expirations',
    description: 'Cancel subscriptions after grace period ends',
    schedule: '30 * * * *', // Every hour at :30
    enabled: true,
    timeout: 300000,
    maxRetries: 3,
    batchSize: 100,
  },
];
```

---

## FR-JOBS-001: Process Trial Expirations

**Priority**: Critical

**Description**: Process subscriptions where the trial period has ended.

### Behavior

```
┌──────────────────────────────────────────────────────────────┐
│                    Trial Expiration Logic                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Find subscriptions where:                                │
│     - status = 'trialing'                                    │
│     - trial_end <= NOW()                                     │
│                                                              │
│  2. For each subscription:                                   │
│                                                              │
│     IF hasPaymentMethod:                                     │
│       → Attempt first charge                                 │
│       → IF success: status = 'active'                        │
│       → IF failure: status = 'past_due', start grace         │
│                                                              │
│     IF NOT hasPaymentMethod:                                 │
│       → status = 'expired'                                   │
│       → revoke access immediately                            │
│       → send "Trial Expired" email                           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Input

No input required. Job queries database for expired trials.

### Processing Steps

1. Query subscriptions with `status = 'trialing'` AND `trial_end <= NOW()`
2. Process in batches of 100
3. For each subscription:
   - Check if customer has payment method
   - If yes: Initiate first charge via payment adapter
   - If charge succeeds: Update status to `active`
   - If charge fails: Update status to `past_due`, start grace period
   - If no payment method: Update status to `expired`
4. Emit appropriate events for each outcome
5. Send notifications based on outcome

### Events Emitted

| Scenario | Event |
|----------|-------|
| Trial converted to active | `TRIAL_CONVERTED` |
| Trial converted but payment failed | `TRIAL_PAYMENT_FAILED` |
| Trial expired (no payment method) | `TRIAL_EXPIRED` |

### Acceptance Criteria

```gherkin
Scenario: Trial ends with valid payment method - payment succeeds
  Given a subscription in "trialing" status
  And trial_end was yesterday
  And customer has a valid payment method
  When job runs
  Then payment is attempted
  And payment succeeds
  And subscription status becomes "active"
  And event TRIAL_CONVERTED is emitted
  And customer receives "Welcome to [Plan]" email

Scenario: Trial ends with valid payment method - payment fails
  Given a subscription in "trialing" status
  And trial_end was yesterday
  And customer has a payment method
  And payment method will be declined
  When job runs
  Then payment is attempted
  And payment fails
  And subscription status becomes "past_due"
  And grace_period_start is set to NOW()
  And event TRIAL_PAYMENT_FAILED is emitted
  And customer receives "Payment Failed" email

Scenario: Trial ends without payment method
  Given a subscription in "trialing" status
  And trial_end was yesterday
  And customer has NO payment method
  When job runs
  Then NO payment is attempted
  And subscription status becomes "expired"
  And hasAccess() returns false
  And event TRIAL_EXPIRED is emitted
  And customer receives "Trial Ended" email

Scenario: Trial not yet expired
  Given a subscription in "trialing" status
  And trial_end is tomorrow
  When job runs
  Then subscription is NOT processed
  And status remains "trialing"
```

---

## FR-JOBS-002: Retry Failed Payments

**Priority**: Critical

**Description**: Automatically retry failed payments according to configured schedule.

### Retry Configuration

```typescript
interface PaymentRetryConfig {
  /** Days after initial failure to retry */
  retryIntervals: number[];

  /** Maximum retry attempts */
  maxAttempts: number;

  /** Grace period duration in days */
  gracePeriodDays: number;
}

// Default configuration
const defaultRetryConfig: PaymentRetryConfig = {
  retryIntervals: [1, 3, 5, 7], // Days 1, 3, 5, 7 after failure
  maxAttempts: 4,
  gracePeriodDays: 7,
};
```

### Retry Timeline

```
Day 0: Initial payment fails → status = 'past_due', grace starts
Day 1: Retry #1 → if fails, continue grace
Day 3: Retry #2 → if fails, continue grace
Day 5: Retry #3 → if fails, continue grace
Day 7: Retry #4 (final) → if fails, status = 'canceled' or 'unpaid'
```

### Processing Steps

1. Query subscriptions where:
   - `status = 'past_due'`
   - `retry_count < maxAttempts`
   - `last_retry_at` matches retry interval
2. Process in batches of 50
3. For each subscription:
   - Attempt payment via payment adapter
   - If success: Update status to `active`, reset retry count
   - If failure: Increment retry count, schedule next retry
   - If max retries reached: Update status to `canceled` or `unpaid`
4. Emit events and send notifications

### Events Emitted

| Scenario | Event |
|----------|-------|
| Retry succeeded | `PAYMENT_SUCCEEDED`, `SUBSCRIPTION_RECOVERED` |
| Retry failed (more attempts) | `PAYMENT_FAILED`, `PAYMENT_RETRY_SCHEDULED` |
| All retries exhausted | `PAYMENT_FAILED_FINAL`, `SUBSCRIPTION_CANCELED` |

### Acceptance Criteria

```gherkin
Scenario: Retry succeeds
  Given a subscription in "past_due" status
  And retry_count is 1
  And it's time for retry #2
  And customer updated their payment method
  When retry job runs
  Then payment is attempted
  And payment succeeds
  And subscription status becomes "active"
  And retry_count resets to 0
  And event SUBSCRIPTION_RECOVERED is emitted
  And customer receives "Payment Successful" email

Scenario: Retry fails but more attempts available
  Given a subscription in "past_due" status
  And retry_count is 1
  And it's time for retry #2
  When retry job runs
  Then payment is attempted
  And payment fails
  And retry_count becomes 2
  And next_retry_at is set to Day 5
  And event PAYMENT_RETRY_SCHEDULED is emitted
  And customer receives "Payment Failed - Retry Scheduled" email

Scenario: Final retry fails
  Given a subscription in "past_due" status
  And retry_count is 3
  And it's time for retry #4 (final)
  When retry job runs
  Then payment is attempted
  And payment fails
  And subscription status becomes "canceled"
  And hasAccess() returns false
  And event PAYMENT_FAILED_FINAL is emitted
  And event SUBSCRIPTION_CANCELED is emitted
  And customer receives "Subscription Canceled" email

Scenario: Customer updates payment method mid-retry
  Given a subscription in "past_due" status
  And retry #2 is scheduled for tomorrow
  When customer updates payment method today
  Then immediate retry is triggered (outside normal job)
  And if successful, subscription is recovered
  And scheduled retry is canceled
```

---

## FR-JOBS-003: Sync Provider Status

**Priority**: High

**Description**: Synchronize subscription status with payment provider to catch missed webhooks.

### Processing Steps

1. Query subscriptions updated more than 24 hours ago
2. For each subscription:
   - Fetch current status from payment provider
   - Compare with local status
   - If different: Update local status, emit event
3. Log all discrepancies for investigation

### Business Rules

1. Run daily to catch any missed webhooks
2. Only update if provider status is more recent
3. Log all discrepancies for monitoring
4. Alert if > 1% of subscriptions are out of sync

### Acceptance Criteria

```gherkin
Scenario: Local status matches provider
  Given subscription "sub_123" has local status "active"
  And provider status is also "active"
  When sync job runs
  Then no update occurs
  And no event is emitted

Scenario: Provider status differs from local
  Given subscription "sub_123" has local status "active"
  And provider status is "canceled"
  When sync job runs
  Then local status is updated to "canceled"
  And event SUBSCRIPTION_SYNCED is emitted
  And discrepancy is logged

Scenario: Provider subscription not found
  Given subscription "sub_123" exists locally
  And provider returns "not found"
  When sync job runs
  Then subscription is flagged for review
  And alert is triggered
  And NO automatic status change occurs
```

---

## FR-JOBS-004: Send Expiration Reminders

**Priority**: High

**Description**: Send reminder emails before trials and subscriptions expire.

### Reminder Configuration

```typescript
interface ReminderConfig {
  /** Days before trial end to send reminders */
  trialReminderDays: number[];

  /** Days before subscription renewal to remind */
  renewalReminderDays: number[];

  /** Days before payment method expiration */
  paymentMethodReminderDays: number[];
}

const defaultReminderConfig: ReminderConfig = {
  trialReminderDays: [3, 1], // 3 days and 1 day before
  renewalReminderDays: [7, 1], // 7 days and 1 day before
  paymentMethodReminderDays: [30, 7], // 30 days and 7 days before
};
```

### Processing Steps

1. Query trials expiring in configured days
2. Query subscriptions renewing in configured days
3. Query payment methods expiring in configured days
4. For each match:
   - Check if reminder was already sent (avoid duplicates)
   - Send appropriate email
   - Record reminder sent

### Events Emitted

| Scenario | Event |
|----------|-------|
| Trial reminder sent | `TRIAL_EXPIRING` |
| Renewal reminder sent | `SUBSCRIPTION_EXPIRING` |
| Payment method reminder sent | `PAYMENT_METHOD_EXPIRING` |

### Acceptance Criteria

```gherkin
Scenario: Send 3-day trial reminder
  Given a subscription in "trialing" status
  And trial_end is exactly 3 days from now
  And no reminder has been sent yet
  When reminder job runs
  Then "Trial Expiring" email is sent
  And event TRIAL_EXPIRING is emitted
  And reminder is recorded to prevent duplicates

Scenario: Skip if reminder already sent
  Given a subscription in "trialing" status
  And trial_end is 3 days from now
  And 3-day reminder was already sent
  When reminder job runs
  Then no email is sent
  And no duplicate event is emitted

Scenario: Payment method expiring reminder
  Given a customer with card expiring next month
  And today is 30 days before expiration
  When reminder job runs
  Then "Update Payment Method" email is sent
  And event PAYMENT_METHOD_EXPIRING is emitted
```

---

## FR-JOBS-005: Process Grace Period Expirations

**Priority**: Critical

**Description**: Cancel subscriptions when grace period ends without payment recovery.

### Processing Steps

1. Query subscriptions where:
   - `status = 'past_due'`
   - `grace_period_start + gracePeriodDays < NOW()`
   - `retry_count >= maxAttempts`
2. For each subscription:
   - Update status to `canceled` or `unpaid`
   - Revoke access
   - Send final cancellation email
   - Emit events

### Acceptance Criteria

```gherkin
Scenario: Grace period expires
  Given a subscription in "past_due" status
  And grace_period_start was 8 days ago
  And grace period is 7 days
  And all retry attempts have failed
  When grace expiration job runs
  Then subscription status becomes "canceled"
  And hasAccess() returns false
  And event SUBSCRIPTION_GRACE_EXPIRED is emitted
  And customer receives "Subscription Canceled" email

Scenario: Grace period not yet expired
  Given a subscription in "past_due" status
  And grace_period_start was 5 days ago
  And grace period is 7 days
  When grace expiration job runs
  Then subscription is NOT processed
  And status remains "past_due"
  And hasAccess() still returns true
```

---

## FR-JOBS-006: Cleanup Expired Sessions

**Priority**: Low

**Description**: Remove expired checkout sessions and incomplete subscriptions.

### Processing Steps

1. Delete checkout sessions older than 24 hours that are not completed
2. Delete `incomplete_expired` subscriptions older than 30 days
3. Archive webhook events older than 90 days
4. Clean up idempotency keys older than 24 hours

### Acceptance Criteria

```gherkin
Scenario: Cleanup incomplete subscription
  Given a subscription with status "incomplete_expired"
  And created_at was 31 days ago
  When cleanup job runs
  Then subscription is permanently deleted
  And related records are cleaned up

Scenario: Keep recent incomplete subscription
  Given a subscription with status "incomplete_expired"
  And created_at was 5 days ago
  When cleanup job runs
  Then subscription is NOT deleted
```

---

## FR-JOBS-007: Generate Scheduled Reports

**Priority**: Medium

**Description**: Generate daily/weekly/monthly billing reports.

### Reports Generated

| Report | Schedule | Contents |
|--------|----------|----------|
| Daily Summary | Daily 6am UTC | MRR, new subs, cancellations, payments |
| Weekly Metrics | Monday 7am UTC | Week-over-week trends |
| Monthly Report | 1st of month | Full monthly summary |

### Processing Steps

1. Aggregate metrics for the reporting period
2. Generate report data structure
3. Store in reports table
4. Send email to configured recipients
5. Emit event with report data

### Acceptance Criteria

```gherkin
Scenario: Generate daily report
  Given it is 6am UTC
  When report job runs
  Then metrics for previous day are calculated:
    | Metric | Value |
    | new_subscriptions | count |
    | canceled_subscriptions | count |
    | total_revenue | sum |
    | mrr_change | delta |
  And report is stored in database
  And email is sent to admins
  And event DAILY_REPORT_GENERATED is emitted
```

---

## Job Execution API

### Endpoints

```typescript
// Run a specific job manually
POST /billing/jobs/:jobId/run
// Response: { jobRunId: string, status: 'started' }

// Get job status
GET /billing/jobs/:jobId
// Response: JobConfiguration & { lastRun: JobRun | null }

// Get all jobs
GET /billing/jobs
// Response: JobConfiguration[]

// Get job run history
GET /billing/jobs/:jobId/runs
// Response: JobRun[]

// Update job configuration
PATCH /billing/jobs/:jobId
// Body: Partial<JobConfiguration>

// Process due jobs (called by external cron)
POST /billing/jobs/run-due
// Response: { jobsStarted: string[] }
```

### Job Run Record

```typescript
interface JobRun {
  id: string;
  jobId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  itemsProcessed: number;
  itemsFailed: number;
  error?: string;
  metadata?: Record<string, unknown>;
}
```

### Database Schema

```sql
CREATE TABLE billing_job_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  items_processed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  error TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  INDEX idx_job_runs_job_id (job_id),
  INDEX idx_job_runs_started (started_at)
);
```

---

## Monitoring and Alerting

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `qzpay_job_runs_total` | Counter | Total job runs by job_id and status |
| `qzpay_job_duration_seconds` | Histogram | Job execution duration |
| `qzpay_job_items_processed` | Counter | Items processed per job run |
| `qzpay_job_items_failed` | Counter | Items failed per job run |
| `qzpay_job_last_success` | Gauge | Timestamp of last successful run |

### Alerts

| Alert | Condition | Severity |
|-------|-----------|----------|
| Job Failed | `status = 'failed'` | High |
| Job Timeout | `duration > timeout` | High |
| Job Stale | `lastSuccessRun > 2 * schedule` | Medium |
| High Failure Rate | `items_failed / items_processed > 0.1` | High |

### Logging

```json
{
  "level": "info",
  "message": "Job completed",
  "job_id": "process-trial-expirations",
  "job_run_id": "run_abc123",
  "duration_ms": 15234,
  "items_processed": 47,
  "items_failed": 2,
  "timestamp": "2025-01-15T10:00:15.234Z"
}
```

---

## Deployment Requirements

### Cron Configuration

Projects MUST configure external cron to call the job execution endpoint:

```bash
# Recommended: Call every minute, jobs self-schedule
* * * * * curl -X POST https://api.example.com/billing/jobs/run-due

# Alternative: Call specific jobs at specific times
0 * * * * curl -X POST https://api.example.com/billing/jobs/process-trial-expirations/run
```

### Platform Examples

**Vercel Cron** (`vercel.json`):
```json
{
  "crons": [{
    "path": "/api/billing/jobs/run-due",
    "schedule": "* * * * *"
  }]
}
```

**AWS EventBridge**:
```yaml
Resources:
  BillingJobsTrigger:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: rate(1 minute)
      Targets:
        - Id: billing-jobs
          Arn: !GetAtt BillingLambda.Arn
```

**Cloudflare Workers** (`wrangler.toml`):
```toml
[triggers]
crons = ["* * * * *"]
```

---

## References

- [Functional Requirements](./FUNCTIONAL.md)
- [Resilience Patterns](../03-architecture/RESILIENCE.md)
- [Events Reference](../05-api/EVENTS.md)
- [Observability](../03-architecture/OBSERVABILITY.md)

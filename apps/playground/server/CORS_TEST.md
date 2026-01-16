# CORS Configuration Test Guide

## Overview

The playground backend server now implements restrictive CORS policies for improved security.

## Configuration

### Default Behavior
- **Allowed Origin**: `http://localhost:3001` (Vite dev server)
- **Credentials**: Enabled
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Max Age**: 600 seconds

### Environment Variable

Set `ALLOWED_ORIGINS` to customize allowed origins:

```bash
# Single origin (default)
ALLOWED_ORIGINS=http://localhost:3001

# Multiple origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000,https://qzpay.example.com
```

## Test Scenarios

### Test 1: Allowed Origin (Should Succeed)

```bash
curl -X OPTIONS http://localhost:3010/api/init \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected**: Response with `Access-Control-Allow-Origin: http://localhost:3001`

### Test 2: Rejected Origin (Should Fail)

```bash
curl -X OPTIONS http://localhost:3010/api/init \
  -H "Origin: http://malicious-site.com" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected**:
- No `Access-Control-Allow-Origin` header
- Server logs: `CORS: Rejected origin: http://malicious-site.com`

### Test 3: No Origin (Same-Origin)

```bash
curl -X GET http://localhost:3010/health -v
```

**Expected**: Request succeeds (same-origin requests are allowed)

### Test 4: Multiple Origins

```bash
# Set environment variable
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

# Test first origin
curl -X OPTIONS http://localhost:3010/api/init \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -v

# Test second origin
curl -X OPTIONS http://localhost:3010/api/init \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -v
```

**Expected**: Both origins should be accepted

## Verification Checklist

- [ ] Server logs display `CORS Configuration:` on startup
- [ ] Server logs show allowed origins
- [ ] Requests from `http://localhost:3001` succeed
- [ ] Requests from other origins are rejected
- [ ] Server logs warning for rejected origins
- [ ] Environment variable `ALLOWED_ORIGINS` works correctly
- [ ] Multiple origins can be configured (comma-separated)

## Security Notes

1. **Default is restrictive**: Only `http://localhost:3001` is allowed by default
2. **Explicit configuration required**: Production deployments must set `ALLOWED_ORIGINS`
3. **No wildcards**: The implementation does not support wildcard origins for security
4. **Logging**: Rejected origins are logged for security monitoring

## Production Deployment

For production, set `ALLOWED_ORIGINS` to your frontend domain(s):

```bash
# Single production domain
ALLOWED_ORIGINS=https://app.example.com

# Multiple domains (e.g., staging + production)
ALLOWED_ORIGINS=https://staging.example.com,https://app.example.com
```

## Troubleshooting

### Issue: Frontend can't connect to backend

**Check**:
1. Verify frontend origin matches allowed origins
2. Check server logs for CORS rejections
3. Ensure `ALLOWED_ORIGINS` environment variable is set correctly
4. Confirm frontend is running on `http://localhost:3001`

### Issue: CORS errors in browser console

**Solution**:
- Add frontend origin to `ALLOWED_ORIGINS`
- Restart backend server after changing environment variables
- Clear browser cache and reload

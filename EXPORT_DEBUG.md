# Export Downloads Debug Guide

## Quick Debugging Steps

### 1. Open Browser DevTools
- Press `F12` or `Ctrl+Shift+I` in your browser
- Navigate to the **Console** tab
- Look for any red ❌ errors

### 2. Reproduce the Issue
- Go to **Payroll** page
- Click the **Export button**
- Select **PDF** (or CSV/Excel)
- **Watch the Console** - look for logs starting with `[Export]`

### 3. Expected Log Output (if working)
You should see logs like:
```
[Export] handleExport called - type: pdf, moduleName: payroll
[Export] Data validation: 10 rows found
[Export] Calling apiService.exportModule with: { moduleName: "payroll", type: "pdf" }
[Export] API Response received - blob size: xxxxxx bytes
```

### 4. What to Check

#### If logs DON'T appear:
- ❌ **Problem**: Export button click not triggering
- ✅ **Solution**: Check if ExportButton component is mounted (browser DevTools → Elements → search "export")

#### If first log appears but then stops:
- ❌ **Problem**: Data validation failing
- ✅ **Solution**: Check the data in payroll table - should have rows

#### If logs go to API but stop there:
- ❌ **Problem**: API call failing or no response
- ✅ **Solution**: Check browser DevTools → Network tab → see /api/exports request:
  - Status code: Should be 200, if 403 it's a permission issue, if 500 it's server error
  - Response: Should show binary data (blob)

#### If blob is created but no download:
- ❌ **Problem**: Browser download mechanism failing
- ✅ **Solution**: Check browser settings - might be blocking downloads

### 5. Backend Logs
Watch your backend terminal while clicking Export. You should see:
```
[EXPORT] Module name: payroll
[EXPORT] Export type: pdf
[EXPORT] Fetching rows for payroll...
[EXPORT] Total rows: 10
```

## Permission Check
- Your role: **Admin** ✅ (has access to "reports" module)
- Required permission: `reports` 
- Admin users get: `super_admin || admin || hr_manager` checks (you have admin ✅)

## Files Modified with Logging
1. `frontend/src/components/common/ExportButton.tsx` - Added Console logging
2. `frontend/src/services/api.ts` - Added API call logging  
3. `backend/src/controllers/exportController.js` - Added backend logging

---

**Next Step**: Run through steps 1-3 and **share the console output** to identify where the flow stops.

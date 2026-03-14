# Semantic Types

Semantic types provide **meaning and validation beyond base types**. They are universal patterns commonly needed across domains that reduce complexity for solutions built on WIP.

## Overview

A semantic type is an optional property on a field definition that adds:
- **Validation rules** specific to that semantic meaning
- **PostgreSQL column optimizations** for efficient queries
- **UI hints** for better data entry

```json
{
  "name": "email",
  "type": "string",
  "semantic_type": "email"
}
```

## Available Semantic Types

| Semantic Type | Base Type | Validation | PostgreSQL Columns |
|--------------|-----------|------------|-------------------|
| `email` | string | RFC 5322 pattern | TEXT |
| `url` | string | Valid HTTP(S) URL | TEXT |
| `latitude` | number | -90 to 90 | NUMERIC(9,6) |
| `longitude` | number | -180 to 180 | NUMERIC(10,6) |
| `percentage` | number | 0 to 100 | NUMERIC(6,3) |
| `duration` | object | {value, unit} structure | JSONB + _seconds + _unit_term_id |
| `geo_point` | object | {latitude, longitude} | JSONB + _latitude + _longitude |

## Simple Semantic Types

### Email

Validates RFC 5322 email format.

**Template:**
```json
{
  "name": "contact_email",
  "label": "Contact Email",
  "type": "string",
  "semantic_type": "email"
}
```

**Document:**
```json
{
  "contact_email": "user@example.com"
}
```

### URL

Validates HTTP or HTTPS URLs.

**Template:**
```json
{
  "name": "website",
  "label": "Website",
  "type": "string",
  "semantic_type": "url"
}
```

**Document:**
```json
{
  "website": "https://example.com"
}
```

### Latitude

Geographic latitude with range -90 to 90.

**Template:**
```json
{
  "name": "office_lat",
  "label": "Office Latitude",
  "type": "number",
  "semantic_type": "latitude"
}
```

**PostgreSQL:** Uses `NUMERIC(9,6)` for 6 decimal places precision.

### Longitude

Geographic longitude with range -180 to 180.

**Template:**
```json
{
  "name": "office_lon",
  "label": "Office Longitude",
  "type": "number",
  "semantic_type": "longitude"
}
```

**PostgreSQL:** Uses `NUMERIC(10,6)` for 6 decimal places precision.

### Percentage

Value from 0 to 100.

**Template:**
```json
{
  "name": "completion",
  "label": "Completion %",
  "type": "number",
  "semantic_type": "percentage"
}
```

## Complex Semantic Types

### Duration

Time duration with value and unit. Supports negative values for relative offsets (e.g., "7 days before").

**Template:**
```json
{
  "name": "reminder_offset",
  "label": "Reminder Offset",
  "type": "object",
  "semantic_type": "duration"
}
```

**Document:**
```json
{
  "reminder_offset": {
    "value": -7,
    "unit": "days"
  }
}
```

**Unit Validation:**
- Units are validated against the `_TIME_UNITS` system terminology
- Aliases are supported: "7 mins", "5 d", "2 hr" all work
- Valid units: seconds, minutes, hours, days, weeks

**PostgreSQL Columns:**
```sql
reminder_offset JSONB,           -- Original {value, unit}
reminder_offset_seconds NUMERIC, -- Normalized: -604800
reminder_offset_unit_term_id TEXT -- Reference to unit term
```

**Querying by Normalized Seconds:**
```sql
-- Find reminders more than 1 hour before
SELECT * FROM doc_task
WHERE reminder_offset_seconds < -3600;

-- Find durations less than 1 day
SELECT * FROM doc_project
WHERE duration_seconds < 86400;
```

### Geo Point

Geographic location with latitude and longitude.

**Template:**
```json
{
  "name": "location",
  "label": "Location",
  "type": "object",
  "semantic_type": "geo_point"
}
```

**Document:**
```json
{
  "location": {
    "latitude": 52.52,
    "longitude": 13.405
  }
}
```

**PostgreSQL Columns:**
```sql
location JSONB,               -- Original object
location_latitude NUMERIC(9,6),  -- For spatial queries
location_longitude NUMERIC(10,6) -- For spatial queries
```

**Spatial Queries:**
```sql
-- Find locations in Berlin area
SELECT * FROM doc_office
WHERE location_latitude BETWEEN 52.3 AND 52.7
  AND location_longitude BETWEEN 13.1 AND 13.8;
```

## System Terminology: _TIME_UNITS

The `_TIME_UNITS` terminology is automatically created by WIP at startup. It contains:

| Code | Value | Aliases | Factor (seconds) |
|------|-------|---------|-----------------|
| SECONDS | seconds | sec, s, second | 1 |
| MINUTES | minutes | min, m, minute | 60 |
| HOURS | hours | hr, h, hour | 3600 |
| DAYS | days | d, day | 86400 |
| WEEKS | weeks | wk, w, week | 604800 |

The `_` prefix indicates a system-managed terminology. You can:
- Add new terms (e.g., months, years)
- Add aliases to existing terms
- NOT delete built-in terms

## Backward Compatibility

- `semantic_type` is **optional** - all existing templates and documents work unchanged
- Validation only runs if `semantic_type` is present
- No database migrations required for existing data

## Future Extensibility

The semantic type system is designed to be extensible. While only the built-in types are currently supported, the architecture allows for:

1. **Custom semantic types via terminology** - Define validation patterns in Def-Store
2. **Domain-specific types** - Add types like `currency`, `phone_number`, etc.
3. **Composite types** - Types that combine multiple fields

These future extensions would follow the same pattern:
- Define in Template Store field model
- Implement validation in Document Store
- Add PostgreSQL column generation in Reporting Sync
- Add UI support in WIP Console

## Best Practices

1. **Choose the right base type first** - Semantic types enhance, not replace
2. **Use duration for time-based offsets** - Enables unified querying
3. **Use geo_point for locations** - Gets optimized spatial columns
4. **Leverage normalized columns** - Query `_seconds` instead of parsing JSON
5. **Consider PostgreSQL column overhead** - Complex types add 2-3 columns each

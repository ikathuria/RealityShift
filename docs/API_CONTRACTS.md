# RealityShift - API Contracts

This document defines the first browser API contracts for RealityShift. The core rule is simple: the API returns structured data, not executable game logic.

## General rules

- All request and response bodies use JSON except file upload endpoints.
- The client must treat responses as data only.
- The server validates or normalizes all AI output before returning it.
- Failed or invalid AI responses must not leave the run in a broken state.

## GET /api/health

### Purpose

Simple health check for deployment and local verification.

### Response

```json
{
  "ok": true,
  "version": "0.1.0"
}
```

## POST /api/architect/shift

### Purpose

Translate player intent into a legal loadout shift for the current trial.

### Request

```json
{
  "trialId": "trial_01_no_jump",
  "userText": "Give me a fast grounded build that can clear gaps",
  "currentLoadout": {
    "version": 1,
    "movement": null,
    "weapon": null,
    "passive": null
  },
  "runId": "local-run-001"
}
```

### Request fields

- `trialId`: required string matching an authored trial ID
- `userText`: required player prompt
- `currentLoadout`: required object representing the active build
- `runId`: optional client-side session identifier

### Success response

```json
{
  "ok": true,
  "dialogue": "You do not need height. You need momentum.",
  "loadout": {
    "version": 1,
    "movement": {
      "tag": "ground_dash",
      "groundSpeedMul": 1.5,
      "airControlMul": 0.8
    },
    "weapon": {
      "tag": "arc_burst",
      "element": "kinetic",
      "damage": 6,
      "cooldownMs": 450
    },
    "passive": {
      "tag": "impact_guard",
      "hazardResistMul": 0.85
    }
  },
  "chargesDelta": -1,
  "validationWarnings": [],
  "fallbackUsed": false
}
```

### Response fields

- `ok`: boolean
- `dialogue`: short Architect response line
- `loadout`: validated loadout object
- `chargesDelta`: integer, normally `-1` for a successful shift
- `validationWarnings`: array of readable warnings when values were adjusted
- `fallbackUsed`: boolean indicating whether the server used a deterministic fallback path

### Failure response

```json
{
  "ok": false,
  "errorCode": "INVALID_MODEL_OUTPUT",
  "message": "The Architect could not stabilize that request.",
  "chargesDelta": 0
}
```

### Failure rules

- Validation failure returns a safe error payload
- Charges are not consumed on invalid or failed responses
- The current client loadout remains unchanged

## Optional POST /api/transcribe

This route is out of scope for the first text-first release, but reserved for later voice support.

### Purpose

Convert browser-recorded audio into text that can be submitted to `/api/architect/shift`.

### Request

- `multipart/form-data`
- field name `audio`

### Success response

```json
{
  "ok": true,
  "text": "Give me something that lets me cross the gap without jumping"
}
```

### Failure response

```json
{
  "ok": false,
  "errorCode": "TRANSCRIPTION_FAILED",
  "message": "Audio could not be transcribed."
}
```

## Loadout schema direction

### Loadout

```json
{
  "version": 1,
  "movement": {
    "tag": "ground_dash",
    "groundSpeedMul": 1.5,
    "airControlMul": 0.8
  },
  "weapon": {
    "tag": "arc_burst",
    "element": "kinetic",
    "damage": 6,
    "cooldownMs": 450
  },
  "passive": {
    "tag": "impact_guard",
    "hazardResistMul": 0.85
  }
}
```

### Validation rules

- Unknown tags are rejected or mapped deterministically only if the design explicitly allows it
- Numeric values are clamped to the current trial allowlist
- Missing sections may be `null` or omitted if the schema allows it
- Dialogue text is flavor only and has no authority over gameplay state

## Error codes

- `BAD_REQUEST`
- `UNKNOWN_TRIAL`
- `INVALID_MODEL_OUTPUT`
- `RATE_LIMITED`
- `UPSTREAM_TIMEOUT`
- `UPSTREAM_ERROR`
- `TRANSCRIPTION_FAILED`

## Versioning rule

The loadout payload includes a `version` field so the client and Worker can evolve without hidden contract drift.


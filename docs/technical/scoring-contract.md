# Scoring Contract

Evidence-first, deterministic where possible, LLM as tie-breaker.

## Requirement types

| Type         | Deterministic check                                | LLM fallback                              |
| ------------ | -------------------------------------------------- | ----------------------------------------- |
| skill        | keyword + variants match in CV text                | validate context (avoid negations)        |
| years_of_exp | date arithmetic on parsed experience               | none                                      |
| education    | degree parser + institution list                   | equivalency judgment                      |
| location     | geo parse of CV `location` vs position `location`  | remote allowances                         |
| language     | explicit mention or region inference               | proficiency level                         |

## Score shape

```json
{
  "score": 82,
  "requirements": [
    {
      "requirement_id": "req_1",
      "verdict": "met",       // met | partial | unmet
      "points": 100,          // 0 | 50 | 100
      "evidence": {
        "excerpt": "Senior Python engineer at Acme, 2019–2024",
        "source": "cv_text",
        "byte_offset_start": 4832,
        "byte_offset_end": 4885
      }
    }
  ],
  "evidence_hash": "sha256:..."
}
```

## Rules

- **No score without evidence.** A requirement with `verdict != 'unmet'` must have an evidence object.
- **Publication threshold** default 60; overridable per position.
- **Rescore** requires `evidence_hash` change OR explicit reason + platform_admin (see runbook 05).
- **PII** in the LLM prompt is redacted (name/email/phone → `[REDACTED]`) per `docs/governance/provider-register.md`.

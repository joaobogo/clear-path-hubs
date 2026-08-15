# Plan - Seeded Data Cleanup

Clean up typos and placeholder values in seeded records to ensure professional presentation.

## User Review Required

> [!IMPORTANT]
> - James Cameron persona split: I will reassign the SFE position to a new staff persona while keeping the original as the Northwind client lead.
> - Location for Front Office Manager: I will use "London, UK" as a realistic location instead of "string".

## Proposed Changes

### Database Cleanup (Migrations)

- **Typos in Titles**: Update `positions` table to fix "Structual Engineer" and "Structural Enginer" to "Structural Engineer".
- **Placeholder Locations**: 
    - Fix `Front Office Manager` (Rehearsal Hotels 489631) location from "string" to "London, UK".
    - Fix `Customer Success` (Bob law) location from "TBD" to NULL (empty).
- **James Cameron Persona Split**:
    - Create a new staff user "James Cameron (Staff)" for platform operations.
    - Keep "james cameron" (kasprzakjoao@protonmail.com) as the Northwind client lead.
    - Reassign Northwind's "Senior Full-Stack Engineer" ownership to the new staff persona if it was intended to be staff-managed.
- **Domain Update**: Change `Flow Group Ventures` domain from "taasflow.com" to "flowgroup.ventures".

### Code & Config Cleanup

- **`src/start.ts`**: Update canonical host check if it was referring to the FGV domain specifically (though usually it refers to the platform apex).
- **`STABILIZATION.md`**: Update check-list items to reflect corrected titles.
- **`scripts/demo-seed/candidates.py`**: Update any internal references if necessary.

## Verification Plan

### Automated Tests
- Run SQL queries to verify no records contain "Structual", "Enginer", "string" (in location), or "TBD" (in location).
- Verify "Flow Group Ventures" has the new domain.
- Verify two distinct "James Cameron" users exist in the system (if achievable via migrations).

### Manual Verification
- Check `/admin/positions` to see clean titles and locations.
- Check `/admin/clients` to see the updated FGV domain.

# TODO - ImportPage Excel real import

- [ ] Update `src/pages/organization/ImportPage.jsx`:
  - [ ] Install/confirm usage of `xlsx` to parse `.xlsx` and `.xls`.
  - [ ] Replace mock preview with real parsed rows.
  - [ ] Map headers `ID, Name, Email, Role` (case-insensitive, trimmed).
  - [ ] Validate rows: invalid if email malformed OR ID/Name/Role missing.
  - [ ] Remove “File Preview” header from UI.
  - [ ] Add summary counts (Total/Valid/Invalid).
  - [ ] Render full Excel data table with CheckCircle/XCircle icons.
  - [ ] Update `handleUpload` to send ONLY valid rows as JSON: `{ users: [...] }`.
- [ ] Run `npm run dev` and manually test:
  - [ ] Upload valid/invalid Excel and verify counts + icons.
  - [ ] Verify API payload is `{ users: [...] }`.



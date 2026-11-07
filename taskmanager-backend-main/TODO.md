# TODO - Dual JSON + Excel Bulk Import

- [x] Update `src/controllers/UserController.js` bulkImport to support:
  - [x] `application/json` with `{ users: [{ id, name, email, role }] }`
  - [x] defensive normalization (lowercase keys + trim all string values)
  - [x] validation (id/name/role non-empty strings, email regex)
  - [x] Upsert by email within organization (update if exists; else create with `status: 'active'`)
  - [x] structured response: `{ success, imported, failed, message }`
  - [x] legacy multipart excel parsing using `xlsx` with real header variants mapped to contract
  - [x] correct 400/500 JSON error handling
- [x] Update `src/routes/user.js` so `/bulk-import` accepts JSON without requiring multipart upload middleware.
- [ ] Basic testing via Postman/curl:
  - [ ] JSON request payload works
  - [ ] Excel upload still works


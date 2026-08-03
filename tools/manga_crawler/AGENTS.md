# Manga crawler rules

- Never add a live publisher or aggregator source without an explicit rights
  record and domain/path allowlist.
- Keep raw downloads under ignored restricted storage; commit schemas, tiny
  self-created fixtures, and derived metadata only.
- Do not weaken redirect, private-network, response-size, image-size, robots, or
  rate-limit checks to make a source work.
- Treat `robots.txt` as access policy, not copyright permission.
- Keep layout, OCR, character grounding, and context normalization as separate
  specialist tasks. Do not add a general-purpose LLM fallback.
- Every model profile must record its model id, tuning task, license, and allowed
  purpose. Research-only models must stay disabled outside that purpose.
- Discovered images remain analysis-ineligible until reviewed scene metadata is
  imported.
- Tests must not contact live networks or download model weights.

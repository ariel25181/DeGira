# DeGira Firestore Security Specification

## Data Invariants
1. **Master Gate & Verified Auth**: Every read/write on shared collections requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Event & Slot Referential Integrity**: Every `slotBid`, `publicEventReservation`, and `review360` MUST reference an existing `eventProposals/{eventId}` document via `exists()`.
3. **Immutable Ownership & Identifiers**: `id`, `ownerUid`, `createdAt`, `createdAtTimestamp`, and parent IDs (`eventId`, `venueId`) cannot be reassigned after creation.
4. **Temporal Integrity**: `createdAtTimestamp == request.time` on creation and `updatedAtTimestamp == request.time` on updates.
5. **No PII Exposure**: Personal email addresses and phone numbers are never stored on shared `venues`, `eventProposals`, `slotBids`, `publicEventReservations`, or `reviews360` documents.
6. **Terminal State Locking**: Rejected (`rechazada`) or accepted (`aceptada`) bids and confirmed (`confirmada`) / expired (`expirada`) / cancelled (`cancelada`) reservations enforce strict action-based key allowlists and terminal protection.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating an `eventProposals` doc when `request.auth == null`.
2. **Email Spoof / Unverified Email**: Writing with `request.auth.token.email_verified == false`.
3. **UID Spoofing on Create**: Creating `slotBids/{bidId}` with `ownerUid != request.auth.uid`.
4. **Ghost / Shadow Field Injection**: Creating `eventProposals/{eventId}` with an extra undeclared field `isAdmin: true`.
5. **Orphaned Slot Bid**: Creating `slotBids/{bidId}` pointing to a non-existent `eventId`.
6. **Orphaned Review360**: Creating `reviews360/{reviewId}` pointing to a non-existent `eventId`.
7. **Path Poisoning**: Targeting `/eventProposals/../../etc/passwd` or a 200-char document ID failing `isValidId()`.
8. **Type / Size Poisoning (Denial of Wallet)**: Updating `title` or `comment` with a 50KB string or injecting a non-string `status`.
9. **Immutable Timestamp / Owner Tampering**: Updating `eventProposals/{eventId}` and changing `ownerUid` or `createdAtTimestamp`.
10. **Forged Server Timestamp**: Creating a doc with a backdated `createdAtTimestamp` (`!= request.time`).
11. **Accepted Bid Re-opening**: Attempting to revert an already `'aceptada'` or `'rechazada'` bid back to `'pendiente_bar'`.
12. **Blanket Unbounded Collection List**: Querying `publicEventReservations` as an unrelated spectator who is neither the reservation owner nor the venue host.

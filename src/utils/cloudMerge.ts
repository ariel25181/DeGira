import type { EventProposal, MusicianSlotBid } from '../types/index.ts';

function getBidStatusRank(bid: Pick<MusicianSlotBid, 'status' | 'retracted'>): number {
  if (bid.retracted || bid.status === 'rechazada') return 5;
  if (bid.status === 'aceptada') return 4;
  if (bid.status === 'contraoferta_musico') return 3;
  if (bid.status === 'contraoferta_bar') return 2;
  return 1; // pendiente_bar
}

function getTimestampSeconds(item: any): number {
  const ts = item?.updatedAtTimestamp;
  if (ts && typeof ts.seconds === 'number') return ts.seconds;
  if (ts && typeof ts.toMillis === 'function') return Math.floor(ts.toMillis() / 1000);
  return 0;
}

function chooseMostProgressedBid(localBid: MusicianSlotBid, cloudBid: MusicianSlotBid): MusicianSlotBid {
  const localRank = getBidStatusRank(localBid);
  const cloudRank = getBidStatusRank(cloudBid);
  const localTerminal = localRank >= 4;
  const cloudTerminal = cloudRank >= 4;

  // Never allow a stale non-terminal cloud snapshot to revert a terminal local decision (aceptada / rechazada / retracted)
  if (localTerminal && !cloudTerminal) {
    return localBid;
  }
  if (cloudTerminal && !localTerminal) {
    return cloudBid;
  }

  // Between aceptar vs retractar/rechazar, retractada/rechazada (rank 5) supersedes aceptada (rank 4)
  if (localRank >= 4 && cloudRank >= 4 && localRank !== cloudRank) {
    return cloudRank > localRank ? cloudBid : localBid;
  }

  // In active negotiation ping-pong, strictly longer history means newer round
  const localHistLen = Array.isArray(localBid.history) ? localBid.history.length : 0;
  const cloudHistLen = Array.isArray(cloudBid.history) ? cloudBid.history.length : 0;
  if (localHistLen !== cloudHistLen) {
    return cloudHistLen > localHistLen ? cloudBid : localBid;
  }

  const localTs = getTimestampSeconds(localBid);
  const cloudTs = getTimestampSeconds(cloudBid);
  if (localTs !== cloudTs) {
    return cloudTs > localTs ? cloudBid : localBid;
  }

  if (cloudRank !== localRank) {
    return cloudRank > localRank ? cloudBid : localBid;
  }

  return { ...localBid, ...cloudBid };
}

export function mergeSlotBidsMonotonic(
  localBids: MusicianSlotBid[],
  cloudBids: MusicianSlotBid[]
): MusicianSlotBid[] {
  if (cloudBids.length === 0) return localBids;
  const byId = new Map<string, MusicianSlotBid>();
  localBids.forEach((b) => byId.set(b.id, b));
  cloudBids.forEach((cloudBid) => {
    const existing = byId.get(cloudBid.id);
    if (!existing) {
      byId.set(cloudBid.id, cloudBid);
    } else {
      byId.set(cloudBid.id, chooseMostProgressedBid(existing, cloudBid));
    }
  });
  return Array.from(byId.values()).sort((a, b) => {
    const da = a.createdAt || '';
    const dbStr = b.createdAt || '';
    if (da && dbStr && da !== dbStr) return dbStr.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

function getEventStatusRank(status: EventProposal['status']): number {
  if (status === 'cancelada') return 5;
  if (status === 'agotada') return 4;
  if (status === 'publicada') return 3;
  if (status === 'para_publicar') return 2;
  return 1;
}

export function mergeEventProposalsMonotonic(
  localEvents: EventProposal[],
  cloudEvents: EventProposal[],
  mergedBids: MusicianSlotBid[] = []
): EventProposal[] {
  if (cloudEvents.length === 0) return localEvents;

  const byId = new Map<string, EventProposal>();
  localEvents.forEach((e) => byId.set(e.id, e));

  cloudEvents.forEach((cloudEv) => {
    const existing = byId.get(cloudEv.id);
    if (!existing && mergedBids.length === 0) {
      byId.set(cloudEv.id, cloudEv);
      return;
    }

    const baseMerged: EventProposal = existing ? { ...existing, ...cloudEv } : { ...cloudEv };
    const existingSlotsById = new Map((existing?.slots || []).map((s) => [s.id, s]));
    const localTs = existing ? getTimestampSeconds(existing) : 0;
    const cloudTs = getTimestampSeconds(cloudEv);
    let releasedAssignedSlot = false;

    // Reconcile each slot cleanly with local confirmed state & merged bids so stale cloud snapshots never revert accepted agreements
    const mergedSlots = (cloudEv.slots || existing?.slots || []).map((cloudSlot) => {
      const localSlot = existingSlotsById.get(cloudSlot.id);
      const acceptedBidForSlot = mergedBids.find(
        (b) => b.eventId === cloudEv.id && b.slotId === cloudSlot.id && !b.retracted && b.status === 'aceptada'
      );

      if (acceptedBidForSlot) {
        return {
          ...cloudSlot,
          status: 'confirmado' as const,
          assignedMusicianId: acceptedBidForSlot.musicianId,
          assignedMusicianName: acceptedBidForSlot.musicianName,
          agreedCachetARS:
            acceptedBidForSlot.cachetType === 'a_la_gorra' ? 0 : acceptedBidForSlot.proposedCachetARS,
          ...(acceptedBidForSlot.cachetType ? { agreedCachetType: acceptedBidForSlot.cachetType } : {}),
        };
      }

      const isBidClosedForMusician = (musicianId?: string): boolean => {
        if (!musicianId) return false;
        const bidsForMusician = mergedBids.filter(
          (b) =>
            b.eventId === cloudEv.id &&
            b.slotId === cloudSlot.id &&
            b.musicianId === musicianId
        );
        return (
          bidsForMusician.some((b) => b.retracted || b.status === 'rechazada') &&
          !bidsForMusician.some((b) => !b.retracted && b.status !== 'rechazada')
        );
      };

      const cloudAssignedClosed = isBidClosedForMusician(cloudSlot.assignedMusicianId);
      const localAssignedClosed = isBidClosedForMusician(localSlot?.assignedMusicianId);
      if (cloudAssignedClosed || localAssignedClosed) {
        releasedAssignedSlot = true;
      }

      const cloudConf =
        !cloudAssignedClosed &&
        (cloudSlot.status === 'confirmado' || Boolean(cloudSlot.assignedMusicianId));
      const localConf = Boolean(
        localSlot &&
          !localAssignedClosed &&
          (localSlot.status === 'confirmado' || Boolean(localSlot.assignedMusicianId))
      );

      if (cloudConf && localConf) {
        return cloudTs <= localTs && localSlot ? localSlot : cloudSlot;
      }

      if (cloudConf) {
        return {
          ...cloudSlot,
          status: 'confirmado' as const,
        };
      }

      if (localConf && localSlot && cloudTs <= localTs) {
        return localSlot;
      }

      const activeBidForSlot = mergedBids.find(
        (b) =>
          b.eventId === cloudEv.id &&
          b.slotId === cloudSlot.id &&
          !b.retracted &&
          b.status !== 'rechazada' &&
          b.status !== 'aceptada'
      );

      if (activeBidForSlot) {
        return {
          ...cloudSlot,
          status: 'negociando' as const,
          assignedMusicianId: undefined,
          assignedMusicianName: undefined,
          agreedCachetARS: undefined,
          agreedCachetType: undefined,
        };
      }

      if (cloudAssignedClosed) {
        return {
          ...cloudSlot,
          status: 'libre' as const,
          assignedMusicianId: undefined,
          assignedMusicianName: undefined,
          agreedCachetARS: undefined,
          agreedCachetType: undefined,
        };
      }

      return cloudSlot;
    });

    const hasConfirmed = mergedSlots.some((s) => s.status === 'confirmado' || Boolean(s.assignedMusicianId));
    const localRank = existing ? getEventStatusRank(existing.status) : 0;
    const cloudRank = getEventStatusRank(cloudEv.status);

    let finalStatus = cloudEv.status;
    if (existing && localRank >= cloudRank && cloudTs <= localTs) {
      finalStatus = existing.status;
    }
    if (hasConfirmed && finalStatus === 'propuesta') {
      finalStatus = 'para_publicar';
    }
    if (releasedAssignedSlot && !hasConfirmed && finalStatus === 'para_publicar') {
      finalStatus = 'propuesta';
    }

    byId.set(cloudEv.id, {
      ...baseMerged,
      slots: mergedSlots,
      status: finalStatus,
    });
  });

  return Array.from(byId.values()).sort((a, b) => {
    const da = a.createdAt || '';
    const dbStr = b.createdAt || '';
    if (da && dbStr && da !== dbStr) return dbStr.localeCompare(da);
    return b.id.localeCompare(a.id);
  });
}

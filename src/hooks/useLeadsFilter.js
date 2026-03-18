import { useMemo } from "react";
import { STALE_THRESHOLD_MS } from "../constants/outreach.js";

export function useLeadsFilter(leads, filters, showDead) {
  return useMemo(() => {
    let result = leads.filter((lead) => {
      // Always hide dead leads unless showDead is on
      if (lead.outreachStatus === "dead" && !showDead) return false;

      // Email status filter
      if (filters.emailStatus && filters.emailStatus !== "all") {
        if (lead.emailStatus !== filters.emailStatus) return false;
      }

      // Outreach status filter
      if (filters.outreachStatus && filters.outreachStatus !== "all") {
        if (filters.outreachStatus === "stale") {
          const isStale =
            lead.outreachStatus === "contacted" &&
            lead.contactedAt &&
            Date.now() - new Date(lead.contactedAt).getTime() > STALE_THRESHOLD_MS;
          if (!isStale) return false;
        } else {
          if (lead.outreachStatus !== filters.outreachStatus) return false;
        }
      }

      // Search filter
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${lead.name} ${lead.title} ${lead.company}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    // Dead leads always sort to bottom
    result.sort((a, b) => {
      if (a.outreachStatus === "dead" && b.outreachStatus !== "dead") return 1;
      if (b.outreachStatus === "dead" && a.outreachStatus !== "dead") return -1;
      return (b.fitScore || 0) - (a.fitScore || 0);
    });

    return result;
  }, [leads, filters, showDead]);
}

export function useLeadsSummary(leads) {
  return useMemo(() => {
    const now = Date.now();
    const summary = {
      total: leads.length,
      verified: 0,
      likely: 0,
      noEmail: 0,
      new: 0,
      contacted: 0,
      responded: 0,
      qualified: 0,
      dead: 0,
      staleContacted: 0,
    };

    for (const lead of leads) {
      // Email
      if (lead.emailStatus === "verified") summary.verified++;
      else if (lead.emailStatus === "likely") summary.likely++;
      else summary.noEmail++;

      // Outreach
      summary[lead.outreachStatus]++;

      if (
        lead.outreachStatus === "contacted" &&
        lead.contactedAt &&
        now - new Date(lead.contactedAt).getTime() > STALE_THRESHOLD_MS
      ) {
        summary.staleContacted++;
      }
    }

    return summary;
  }, [leads]);
}

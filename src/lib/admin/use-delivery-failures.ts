/**
 * One query key, one number. Every admin surface that shows a delivery-failure
 * count reads through this hook, so five surfaces can never disagree.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getDeliveryFailureMetric } from "@/lib/notification-failures.functions";

export const DELIVERY_FAILURES_QUERY_KEY = ["admin", "delivery-failures", "7d"] as const;

export function useDeliveryFailures() {
  const load = useServerFn(getDeliveryFailureMetric);
  return useQuery({
    queryKey: DELIVERY_FAILURES_QUERY_KEY,
    queryFn: () => load(),
    refetchOnWindowFocus: true,
    staleTime: 15_000,
  });
}

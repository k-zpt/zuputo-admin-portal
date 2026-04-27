import SubscriptionPlansClient from './SubscriptionPlansClient';

/** Avoid stale static shell so UI changes to the client bundle always apply after deploy/restart. */
export const dynamic = 'force-dynamic';

export default function SubscriptionPlansPage() {
  return <SubscriptionPlansClient />;
}

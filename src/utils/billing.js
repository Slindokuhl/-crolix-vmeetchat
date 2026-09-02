/**
 * src/utils/billing.js
 * Kicks off a real Stripe Checkout session for Premium via the
 * createCheckoutSession Cloud Function. isPremium is only ever granted
 * server-side by the stripeWebhook function once payment is confirmed —
 * this just gets the user to Stripe's checkout page.
 */
export async function startPremiumCheckout(userId, email) {
  if (!firebase.apps.length) throw new Error("Firebase not initialized");
  const fn = firebase.functions().httpsCallable("createCheckoutSession");
  const result = await fn({ userId, email });
  const url = result?.data?.url;
  if (!url) throw new Error("No checkout URL returned");
  window.location.href = url;
}

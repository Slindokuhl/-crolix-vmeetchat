/**
 * functions/index.js
 * Stripe billing for Premium — the only place isPremium is ever set to
 * true. Firestore rules block clients from writing that field directly;
 * these functions use the Admin SDK, which bypasses rules entirely.
 */
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");
const STRIPE_PRICE_ID = defineSecret("STRIPE_PRICE_ID");

// Matches PUBLIC_WEB_URL in src/config/config.js.
const PUBLIC_WEB_URL = "https://crolix-5a614.web.app";

exports.createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_PRICE_ID] },
  async (request) => {
    const { userId, email } = request.data || {};
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");

    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICE_ID.value(), quantity: 1 }],
      client_reference_id: userId,
      customer_email: email || undefined,
      success_url: `${PUBLIC_WEB_URL}/?upgrade=success`,
      cancel_url: `${PUBLIC_WEB_URL}/?upgrade=cancelled`,
    });

    return { url: session.url };
  }
);

exports.stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    const stripe = new Stripe(STRIPE_SECRET_KEY.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const userId = session.client_reference_id;
          if (userId) {
            await db.collection("users").doc(userId).set(
              {
                isPremium: true,
                stripeCustomerId: session.customer,
                stripeSubscriptionId: session.subscription,
              },
              { merge: true }
            );
          }
          break;
        }
        case "customer.subscription.deleted": {
          await revokeByCustomerId(event.data.object.customer);
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object;
          if (!["active", "trialing"].includes(sub.status)) {
            await revokeByCustomerId(sub.customer);
          }
          break;
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error("Webhook handler error:", err);
      res.status(500).send("Webhook handler error");
    }
  }
);

async function revokeByCustomerId(stripeCustomerId) {
  const snap = await db.collection("users")
    .where("stripeCustomerId", "==", stripeCustomerId).limit(1).get();
  if (snap.empty) return;
  await snap.docs[0].ref.set({ isPremium: false }, { merge: true });
}

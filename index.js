import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import Stripe from "stripe";
import mongoose from "mongoose";
import { Order } from "./models/Order.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

const app = express();
app.use(cors());



app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log("Received webhook:", event.type);
  } catch (err) {
    console.error("Webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    console.log("Checkout session completed:", session.id);

    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

      const order = new Order({
        sessionId: session.id,
        customerEmail: session.customer_details?.email,
        items: lineItems.data.map(item => ({
          name: item.description,
          quantity: item.quantity,
          price: item.price.unit_amount / 100,
        })),
        amountTotal: session.amount_total / 100,
        currency: session.currency,
      });

      await order.save();
      console.log("Order saved:", order);
    } catch (err) {
      console.error("Error saving order:", err.message);
    }
  }

  res.json({ received: true });
});

app.use(express.json());

//returns all orders from mongoDB
app.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.post("/checkout", async (req, res) => {
  try {
    const { items } = req.body;

    // Convert items into Stripe line items
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: { name: item.name },
        unit_amount: item.price * 100, // Stripe expects cents
      },
      quantity: 1,
    }));
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: "https://azshoppingcart.netlify.app//success",
      cancel_url: "https://azshoppingcart.netlify.app/cancel",
    });
    res.json({ url: session.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

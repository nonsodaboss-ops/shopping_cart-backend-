import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  sessionId: String,          // Stripe checkout session ID
  customerEmail: String,      // Customer email (if available)
  items: [                    // Purchased items
    {
      name: String,
      quantity: Number,
      price: Number,
    }
  ],
  amountTotal: Number,        // Total amount paid
  currency: String,           // Currency used
  createdAt: { type: Date, default: Date.now }
});

export const Order = mongoose.model('Order', orderSchema);
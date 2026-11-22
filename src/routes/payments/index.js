

import { Router } from "express";
import { ObjectId } from "mongodb";
import { equipment, bookingsCollection } from "../../../index.js";
import { stripe } from "../../config/stripe.js";

const router = Router();

router.post("/create-checkout-session", async (req, res) => {
    try {
        const { equipmentId, userEmail } = req.body;

        console.log("Booking payload:", req.body);

        if (!equipmentId || !ObjectId.isValid(equipmentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid equipment ID",
            });
        }

        if (!userEmail) {
            return res.status(400).json({
                success: false,
                message: "Customer email is required",
            });
        }

        // Step 1: Find equipment
        const validEquipment = await equipment.findOne({
            _id: new ObjectId(equipmentId),
        });

        if (!validEquipment) {
            return res.status(404).json({
                success: false,
                message: "Equipment not found",
            });
        }

        // Step 2: Create pending booking
        const booking = {
            equipmentId: new ObjectId(equipmentId),
            userEmail,
            status: "pending",
            createdAt: new Date(),
        };

        const bookingResult = await bookingsCollection.insertOne(booking);

        // Step 3: Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: validEquipment.equipmentName,
                        },
                        unit_amount: Math.round(
                            validEquipment.rentalPrice * 0.00804 * 100
                        ),
                    },
                    quantity: 1,
                },
            ],

           
            mode: "payment",

            customer_email: userEmail,

            success_url: `${process.env.CLIENT_URL}/AllEquipment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingResult.insertedId.toString()}`,
            cancel_url: `${process.env.CLIENT_URL}/AllEquipment/cancel`,

            metadata: {
                bookingId: bookingResult.insertedId.toString(),
                userEmail,
            },
        });

        return res.status(200).json({
            success: true,
            data: session.id,
            url: session.url,
        });

    } catch (error) {
        console.error("Checkout session error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create checkout session",
        });
    }
});

// Stripe Webhook: Update booking after successful payment
router.post("/webhook", async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    // 1. Verify Stripe signature
    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.error("Webhook signature verification failed:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    // 2. Handle successful payment
    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;

            console.log("Checkout completed:", session.id);
            console.log("Payment status:", session.payment_status);

            if (session.payment_status === "paid") {
                const bookingId = session.metadata?.bookingId;

                if (!bookingId || !ObjectId.isValid(bookingId)) {
                    console.error("Invalid booking ID:", bookingId);
                    return res.status(200).json({ received: true });
                }

                // 3. Update MongoDB booking status
                const result = await bookingsCollection.updateOne(
                    {
                        _id: new ObjectId(bookingId),
                        status: "pending",
                    },
                    {
                        $set: {
                            status: "paid",
                            paidAt: new Date(),
                            stripeSessionId: session.id,
                        },
                    }
                );

                console.log("Updated bookings:", result.modifiedCount);
            }
        }

        return res.status(200).json({ received: true });

    } catch (error) {
        console.error("Webhook processing error:", error);

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed",
        });
    }
});


export default router;

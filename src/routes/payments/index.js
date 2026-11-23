

// import { Router } from "express";
// import { ObjectId } from "mongodb";
// import { equipment, bookingsCollection } from "../../../index.js";
// import { stripe } from "../../config/stripe.js";

// const router = Router();

// router.post("/create-checkout-session", async (req, res) => {
//     try {
//         const { equipmentId, userEmail } = req.body;

//         console.log("Booking payload:", req.body);

//         if (!equipmentId || !ObjectId.isValid(equipmentId)) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Invalid equipment ID",
//             });
//         }

//         if (!userEmail) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Customer email is required",
//             });
//         }

//         // Step 1: Find equipment
//         const validEquipment = await equipment.findOne({
//             _id: new ObjectId(equipmentId),
//         });

//         if (!validEquipment) {
//             return res.status(404).json({
//                 success: false,
//                 message: "Equipment not found",
//             });
//         }

//         // Step 2: Create pending booking
//         const booking = {
//             equipmentId: new ObjectId(equipmentId),
//             userEmail,
//             status: "pending",
//             createdAt: new Date(),
//         };

//         const bookingResult = await bookingsCollection.insertOne(booking);

//         // Step 3: Create Stripe Checkout Session
//         const session = await stripe.checkout.sessions.create({
//             line_items: [
//                 {
//                     price_data: {
//                         currency: "usd",
//                         product_data: {
//                             name: validEquipment.equipmentName,
//                         },
//                         unit_amount: Math.round(
//                             validEquipment.rentalPrice * 0.00804 * 100
//                         ),
//                     },
//                     quantity: 1,
//                 },
//             ],


//             mode: "payment",

//             customer_email: userEmail,

//             success_url: `${process.env.CLIENT_URL}/AllEquipment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingResult.insertedId.toString()}`,
//             cancel_url: `${process.env.CLIENT_URL}/AllEquipment/cancel`,

//             metadata: {
//                 bookingId: bookingResult.insertedId.toString(),
//                 userEmail,
//             },
//         });

//         return res.status(200).json({
//             success: true,
//             data: session.id,
//             url: session.url,
//         });

//     } catch (error) {
//         console.error("Checkout session error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Failed to create checkout session",
//         });
//     }
// });

// // Stripe Webhook: Update booking after successful payment
// router.post("/webhook", async (req, res) => {
//     const signature = req.headers["stripe-signature"];

//     let event;

//     // 1. Verify Stripe signature
//     try {
//         event = stripe.webhooks.constructEvent(
//             req.body,
//             signature,
//             process.env.STRIPE_WEBHOOK_SECRET
//         );
//     } catch (error) {
//         console.error("Webhook signature verification failed:", error.message);
//         return res.status(400).send(`Webhook Error: ${error.message}`);
//     }

//     // 2. Handle successful payment
//     try {
//         if (event.type === "checkout.session.completed") {
//             const session = event.data.object;

//             console.log("Checkout completed:", session.id);
//             console.log("Payment status:", session.payment_status);

//             if (session.payment_status === "paid") {
//                 const bookingId = session.metadata?.bookingId;

//                 if (!bookingId || !ObjectId.isValid(bookingId)) {
//                     console.error("Invalid booking ID:", bookingId);
//                     return res.status(200).json({ received: true });
//                 }

//                 // 3. Update MongoDB booking status
//                 const result = await bookingsCollection.updateOne(
//                     {
//                         _id: new ObjectId(bookingId),
//                         paymentStatus: "pending",
//                     },
//                     {
//                         $set: {
//                             paymentStatus: "paid",
//                             bookingStatus: "Confirmed",
//                             paidAt: new Date(),
//                             stripeSessionId: session.id,
//                         }
//                     }
//                 );

//                 console.log("Updated bookings:", result.modifiedCount);
//             }
//         }

//         return res.status(200).json({ received: true });

//     } catch (error) {
//         console.error("Webhook processing error:", error);

//         return res.status(500).json({
//             success: false,
//             message: "Webhook processing failed",
//         });
//     }
// });


// export default router;






// // import { Router } from "express";
// // import { ObjectId } from "mongodb";
// // import { equipment, bookingsCollection } from "../../../index.js";
// // import { stripe } from "../../config/stripe.js";

// // const router = Router();

// // router.post("/create-checkout-session", async (req, res) => {
// //     try {
// //         const {
// //             equipmentId,
// //             equipmentName,
// //             startDate,
// //             endDate,
// //             rentalDuration,
// //             rentalPeriods,
// //             quantity,
// //             customerPhone,
// //             deliveryAddress,
// //             bookingNotes,
// //             userEmail,
// //         } = req.body;

// //         console.log("Booking payload:", req.body);

// //         // Step 1: Validate required fields
// //         if (!equipmentId || !ObjectId.isValid(equipmentId)) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid equipment ID",
// //             });
// //         }

// //         if (
// //             !userEmail ||
// //             !equipmentName ||
// //             !startDate ||
// //             !endDate ||
// //             !customerPhone ||
// //             !deliveryAddress
// //         ) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Please provide all required booking information",
// //             });
// //         }

// //         if (
// //             !Number.isFinite(rentalDuration) ||
// //             rentalDuration <= 0 ||
// //             !Number.isFinite(rentalPeriods) ||
// //             rentalPeriods <= 0 ||
// //             !Number.isInteger(quantity) ||
// //             quantity <= 0
// //         ) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid rental duration, periods, or quantity",
// //             });
// //         }

// //         const parsedStartDate = new Date(startDate);
// //         const parsedEndDate = new Date(endDate);

// //         if (
// //             Number.isNaN(parsedStartDate.getTime()) ||
// //             Number.isNaN(parsedEndDate.getTime()) ||
// //             parsedEndDate <= parsedStartDate
// //         ) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Please provide valid rental dates",
// //             });
// //         }

// //         // Step 2: Find equipment in MongoDB
// //         const validEquipment = await equipment.findOne({
// //             _id: new ObjectId(equipmentId),
// //         });

// //         if (!validEquipment) {
// //             return res.status(404).json({
// //                 success: false,
// //                 message: "Equipment not found",
// //             });
// //         }

// //         // Use the equipment name and price stored in MongoDB
// //         const actualEquipmentName = validEquipment.equipmentName;

// //         // Step 3: Calculate total rental amount
// //         // rentalPrice is converted from BDT to USD.
// //         const totalAmount =
// //             validEquipment.rentalPrice *
// //             0.00804 *
// //             rentalPeriods *
// //             quantity;

// //         // Stripe requires the amount in cents
// //         const stripeAmount = Math.round(totalAmount * 100);

// //         if (!Number.isFinite(stripeAmount) || stripeAmount <= 0) {
// //             return res.status(400).json({
// //                 success: false,
// //                 message: "Invalid booking amount",
// //             });
// //         }

// //         // Step 4: Create pending booking in MongoDB
// //         const booking = {
// //             // Equipment information
// //             equipmentId: new ObjectId(equipmentId),
// //             equipmentName: actualEquipmentName,

// //             // Customer information
// //             userEmail,
// //             customerPhone,
// //             deliveryAddress,

// //             // Rental information
// //             startDate: parsedStartDate,
// //             endDate: parsedEndDate,
// //             rentalDuration,
// //             rentalPeriods,
// //             quantity,
// //             bookingNotes: bookingNotes || "",

// //             // Payment information
// //             totalAmount: Number((stripeAmount / 100).toFixed(2)),
// //             currency: "USD",
// //             paymentStatus: "pending",

// //             // Booking information
// //             bookingStatus: "Pending",
// //             createdAt: new Date(),
// //             paidAt: null,
// //             stripeSessionId: null,
// //         };

// //         const bookingResult = await bookingsCollection.insertOne(booking);

// //         // Step 5: Create Stripe Checkout Session
// //         const session = await stripe.checkout.sessions.create({
// //             line_items: [
// //                 {
// //                     price_data: {
// //                         currency: "usd",
// //                         product_data: {
// //                             name: actualEquipmentName,
// //                         },
// //                         unit_amount: stripeAmount,
// //                     },
// //                     quantity: 1,
// //                 },
// //             ],

// //             mode: "payment",

// //             customer_email: userEmail,

// //             success_url: `${process.env.CLIENT_URL}/AllEquipment/success?session_id={CHECKOUT_SESSION_ID}&bookingId=${bookingResult.insertedId.toString()}`,

// //             cancel_url: `${process.env.CLIENT_URL}/AllEquipment/cancel`,

// //             metadata: {
// //                 bookingId: bookingResult.insertedId.toString(),
// //                 userEmail,
// //             },
// //         });

// //         // Save Stripe session ID in MongoDB
// //         await bookingsCollection.updateOne(
// //             { _id: bookingResult.insertedId },
// //             {
// //                 $set: {
// //                     stripeSessionId: session.id,
// //                 },
// //             }
// //         );

// //         return res.status(200).json({
// //             success: true,
// //             data: session.id,
// //             url: session.url,
// //         });

// //     } catch (error) {
// //         console.error("Checkout session error:", error);

// //         return res.status(500).json({
// //             success: false,
// //             message: "Failed to create checkout session",
// //         });
// //     }
// // });


// // // Stripe Webhook: Update booking after successful payment
// // router.post("/webhook", async (req, res) => {
// //     const signature = req.headers["stripe-signature"];

// //     let event;

// //     // Step 1: Verify Stripe signature
// //     try {
// //         event = stripe.webhooks.constructEvent(
// //             req.body,
// //             signature,
// //             process.env.STRIPE_WEBHOOK_SECRET
// //         );
// //     } catch (error) {
// //         console.error(
// //             "Webhook signature verification failed:",
// //             error.message
// //         );

// //         return res.status(400).send(`Webhook Error: ${error.message}`);
// //     }

// //     // Step 2: Handle successful payment
// //     try {
// //         if (event.type === "checkout.session.completed") {
// //             const session = event.data.object;

// //             console.log("Checkout completed:", session.id);
// //             console.log("Payment status:", session.payment_status);

// //             if (session.payment_status === "paid") {
// //                 const bookingId = session.metadata?.bookingId;

// //                 if (!bookingId || !ObjectId.isValid(bookingId)) {
// //                     console.error("Invalid booking ID:", bookingId);
// //                     return res.status(200).json({ received: true });
// //                 }

// //                 // Step 3: Update both payment and booking status
// //                 const result = await bookingsCollection.updateOne(
// //                     {
// //                         _id: new ObjectId(bookingId),
// //                         paymentStatus: "pending",
// //                     },
// //                     {
// //                         $set: {
// //                             paymentStatus: "paid",
// //                             bookingStatus: "Confirmed",
// //                             paidAt: new Date(),
// //                             stripeSessionId: session.id,
// //                         },
// //                     }
// //                 );

// //                 console.log("Updated bookings:", result.modifiedCount);
// //             }
// //         }

// //         return res.status(200).json({ received: true });

// //     } catch (error) {
// //         console.error("Webhook processing error:", error);

// //         return res.status(500).json({
// //             success: false,
// //             message: "Webhook processing failed",
// //         });
// //     }
// // });

// // export default router;

import { Router } from "express";
import { ObjectId } from "mongodb";
import { equipment, bookingsCollection } from "../../../index.js";
import { stripe } from "../../config/stripe.js";

const router = Router();

// ======================================
// 1. Create Booking + Stripe Checkout
// ======================================

router.post("/create-checkout-session", async (req, res) => {
    try {
        const {
            equipmentId,
            startDate,
            endDate,
            rentalDuration,
            rentalPeriods,
            quantity,
            customerPhone,
            deliveryAddress,
            bookingNotes,
            userEmail,
        } = req.body;

        console.log("Booking payload:", req.body);

        // Validate equipment ID
        if (!equipmentId || !ObjectId.isValid(equipmentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid equipment ID",
            });
        }

        // Validate customer information
        if (!userEmail || !customerPhone?.trim() || !deliveryAddress?.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required customer information",
            });
        }

        // Validate rental information
        const duration = Number(rentalDuration);
        const periods = Number(rentalPeriods);
        const bookingQuantity = Number(quantity);

        if (
            !Number.isFinite(duration) ||
            duration <= 0 ||
            !Number.isFinite(periods) ||
            periods <= 0 ||
            !Number.isInteger(bookingQuantity) ||
            bookingQuantity <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid rental duration, periods, or quantity",
            });
        }

        // Validate rental dates
        const parsedStartDate = new Date(startDate);
        const parsedEndDate = new Date(endDate);

        if (
            Number.isNaN(parsedStartDate.getTime()) ||
            Number.isNaN(parsedEndDate.getTime()) ||
            parsedEndDate <= parsedStartDate
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide valid rental dates",
            });
        }

        // Find equipment
        const validEquipment = await equipment.findOne({
            _id: new ObjectId(equipmentId),
        });

        if (!validEquipment) {
            return res.status(404).json({
                success: false,
                message: "Equipment not found",
            });
        }

        // Calculate total amount (BDT to USD)
        const totalAmount =
            Number(validEquipment.rentalPrice) *
            0.00804 *
            periods *
            bookingQuantity;

        const stripeAmount = Math.round(totalAmount * 100);

        if (!Number.isFinite(stripeAmount) || stripeAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount",
            });
        }

        // Create booking using the older status structure
        const booking = {
            // Equipment information
            equipmentId: new ObjectId(equipmentId),
            equipmentName: validEquipment.equipmentName,

            // Owner information
            owner: validEquipment.owner || null,

            // Customer information
            customer: {
                email: userEmail,
                phone: customerPhone,
                deliveryAddress,
            },

            // Keep email at the root for existing queries
            userEmail,

            // Rental information
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            rentalDuration: duration,
            rentalPeriods: periods,
            quantity: bookingQuantity,
            bookingNotes: bookingNotes || "",

            // Payment information
            totalAmount: Number((stripeAmount / 100).toFixed(2)),
            currency: "USD",

            // Older payment status field
            status: "pending",

            // Separate booking status
            bookingStatus: "Pending",

            createdAt: new Date(),
            paidAt: null,
            stripeSessionId: null,
        };

        // Save booking in MongoDB
        const bookingResult = await bookingsCollection.insertOne(booking);

        // Create Stripe Checkout Session
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: validEquipment.equipmentName,
                        },
                        unit_amount: stripeAmount,
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

        // Save Stripe session ID
        await bookingsCollection.updateOne(
            { _id: bookingResult.insertedId },
            {
                $set: {
                    stripeSessionId: session.id,
                },
            }
        );

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


// ======================================
// 2. Stripe Webhook
// ======================================

router.post("/webhook", async (req, res) => {
    const signature = req.headers["stripe-signature"];

    let event;

    // Verify Stripe webhook signature
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

    try {
        console.log("Received Stripe event:", event.type);

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

                // Update the older status field
                const result = await bookingsCollection.updateOne(
                    {
                        _id: new ObjectId(bookingId),
                        status: "pending",
                    },
                    {
                        $set: {
                            status: "paid",
                            bookingStatus: "Confirmed",
                            paidAt: new Date(),
                            stripeSessionId: session.id,
                        },
                    }
                );

                console.log("Updated bookings:", {
                    matchedCount: result.matchedCount,
                    modifiedCount: result.modifiedCount,
                    bookingId,
                });
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

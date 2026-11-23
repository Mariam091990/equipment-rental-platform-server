import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { ObjectId } from 'mongodb';
import 'dotenv/config';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import paymentRoutes from "./src/routes/payments/index.js";
// import { stripe } from './src/config/stripe.js';


const app = express();
const port = process.env.PORT || 5000;

// app.post("/api/webhooks/stripe", (req,res)=>{
//     // after payment step-1
// const stripeEvent= req.body;
// console.log('event from webhooks :', event);

// const signature =req.headers["stripe-signature"]

// let event =stripe.webhooks.constructEvent(
//     stripeEvent,
//     signature,
//     process.env.STRIPE_WEBHOOK_SECRET
// )
//     console.log("EVENT:", event);

// })

// middleware

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));


// Stripe webhook must receive the raw request body
app.use(
    "/payments/webhook",
    express.raw({ type: "application/json" })
);

// Parse JSON before registering routes
app.use(express.json());


app.use("/payments", paymentRoutes);

const client = new MongoClient(`mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster09.ceody5c.mongodb.net`);

export async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to database');
        return client;
    }
    catch (err) {
        console.log('Error connecting to database', err);
        throw err;

    }
}
// 1. Connect to MongoDB
const connectedClient = await connectToDatabase();

// 2. Select the database
const db = connectedClient.db(`${process.env.DB_NAME}`);

// 3. Select the collection of registered users
 const users = db.collection("user");
export const equipment = db.collection("equipment");
 const favoritesCollection = db.collection("favorites");
export const bookingsCollection = db.collection("bookings");

// ----------------------------*****-----------------------
// Better Auth JWT configuration
const AUTH_URL = process.env.BETTER_AUTH_URL;

const JWKS = createRemoteJWKSet(
    new URL(`${AUTH_URL}/api/auth/jwks`)
);

// Verify JWT token
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).send({
                message: "Unauthorized! Token required."
            });
        }

        const token = authHeader.split(" ")[1];

        const { payload } = await jwtVerify(token, JWKS, {
            issuer: AUTH_URL,
            audience: AUTH_URL,
        });

        req.user = payload;

        next();

    } catch (error) {
        console.error("JWT verification error:", error.message);

        return res.status(401).send({
            message: "Invalid or expired token."
        });
    }
};

// Verify owner role
const verifyOwner = (req, res, next) => {
    if (req.user?.role !== "owner") {
        return res.status(403).send({
            message: "Access denied! Only owners are allowed."
        });
    }

    next();
};

// Verify customer role
const verifyCustomer = (req, res, next) => {
    if (req.user?.role !== "customer") {
        return res.status(403).send({
            success: false,
            message: "Only customers can add favorites.",
        });
    }

    next();
};

// Verify admin role
const verifyAdmin = (req, res, next) => {
    if (req.user?.role !== "admin") {
        return res.status(403).send({
            success: false,
            message: "Access denied! Only admins are allowed.",
        });
    }

    next();
};


// 4. Fetch all documents form mongodb and send them to the server side
// Get all registered users (Admin only)
app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await users
            .find(
                {},
                {
                    projection: {
                        name: 1,
                        email: 1,
                        role: 1,
                        createdAt: 1,
                        image: 1,
                    },
                }
            )
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).send({
            success: true,
            count: result.length,
            users: result,
        });

    } catch (error) {
        console.error("Fetch all users error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch users.",
        });
    }
});

// Update user information and role (Admin only)
app.put("/admin/users/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, image, phone, address, role } = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid user ID.",
            });
        }

        const validRoles = ["customer", "owner", "admin"];

        if (role && !validRoles.includes(role.toLowerCase())) {
            return res.status(400).send({
                success: false,
                message: "Invalid user role.",
            });
        }

        if (name !== undefined && (typeof name !== "string" || !name.trim())) {
            return res.status(400).send({
                success: false,
                message: "Please provide a valid name.",
            });
        }

        const updatedData = {
            updatedAt: new Date(),
        };

        if (name !== undefined) updatedData.name = name.trim();
        if (image !== undefined) updatedData.image = image.trim();
        if (phone !== undefined) updatedData.phone = phone.trim();
        if (address !== undefined) updatedData.address = address.trim();
        if (role !== undefined) updatedData.role = role.toLowerCase();

        // Prevent an admin from accidentally removing their own admin role
        if (id === req.user.sub && role && role.toLowerCase() !== "admin") {
            return res.status(400).send({
                success: false,
                message: "You cannot remove your own admin role.",
            });
        }

        const result = await users.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "User not found.",
            });
        }

        res.status(200).send({
            success: true,
            message: "User information updated successfully.",
        });

    } catch (error) {
        console.error("Update user error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to update user information.",
        });
    }
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.get('/owner-check', verifyToken, verifyOwner, (req, res) => {
    res.send({
        message: "Owner authentication successful!",
        owner: {
            id: req.user.sub,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// app.get('/equipment', async (req, res) => {
//     try {
//         const result = await equipment.find({}).toArray();
//         res.send(result);
//     } catch (error) {
//         console.error("Error fetching equipment:", error);
//         res.status(500).send({

//             message: "Failed to fetch equipment."
//         });
//     }
// }
// );

app.get('/bookings', async (req, res) => {

    const result = await bookingsCollection.find({}).toArray();
    res.send(result);
});


// Get rentals belonging to the currently logged-in customer
app.get("/customer/my-rentals",verifyToken, verifyCustomer, async (req, res) => {
        try {
            // Validate customer ID from JWT
            if (!ObjectId.isValid(req.user.sub)) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid customer ID.",
                });
            }

            // Find the authenticated customer
            const customer = await users.findOne(
                { _id: new ObjectId(req.user.sub) },
                { projection: { email: 1 } }
            );

            if (!customer?.email) {
                return res.status(404).send({
                    success: false,
                    message: "Customer not found.",
                });
            }

            // Fetch only this customer's bookings
            const result = await bookingsCollection
                .find({ userEmail: customer.email })
                .sort({ createdAt: -1 })
                .toArray();

            res.status(200).send({
                success: true,
                count: result.length,
                rentals: result,
            });

        } catch (error) {
            console.error("Fetch customer rentals error:", error);

            res.status(500).send({
                success: false,
                message: "Failed to fetch your rentals.",
            });
        }
    }
);


// Get favorites of the currently logged-in customer
app.get("/favorites", verifyToken, verifyCustomer, async (req, res) => {
    try {
        const result = await favoritesCollection
            .find({ userId: req.user.sub })
            .sort({ favoritedAt: -1 })
            .toArray();

        res.status(200).send({
            success: true,
            count: result.length,
            favorites: result,
        });

    } catch (error) {
        console.error("Fetch favorites error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch favorites.",
        });
    }
});

// Remove a favorite belonging to the logged-in customer
app.delete("/favorites/:id", verifyToken, verifyCustomer, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid favorite ID.",
            });
        }

        const result = await favoritesCollection.deleteOne({
            _id: new ObjectId(id),
            userId: req.user.sub,
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "Favorite not found.",
            });
        }

        res.status(200).send({
            success: true,
            message: "Favorite removed successfully.",
        });

    } catch (error) {
        console.error("Remove favorite error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to remove favorite.",
        });
    }
});

app.post('/equipment', verifyToken, verifyOwner, async (req, res) => {
    try {
        const {
            equipmentName,
            description,
            category,
            location,
            rentalPrice,
            rentalType,
            availableQuantity,
            equipmentCondition,
            brand,
            model,
            equipmentImage,
            rentalTerms
        } = req.body;

        // 1. Validate required fields
        const requiredFields = {
            equipmentName,
            description,
            category,
            location,
            rentalType,
            equipmentCondition,
            brand,
            model,
            equipmentImage,
            rentalTerms
        };

        for (const [field, value] of Object.entries(requiredFields)) {
            if (typeof value !== "string" || !value.trim()) {
                return res.status(400).send({
                    success: false,
                    message: `${field} is required.`
                });
            }
        }

        // 2. Validate rental type
        const validRentalTypes = ["Daily", "Weekly", "Monthly"];

        if (!validRentalTypes.includes(rentalType)) {
            return res.status(400).send({
                success: false,
                message: "Rental type must be Daily, Weekly, or Monthly."
            });
        }

        // 3. Validate rental price
        const price = Number(rentalPrice);

        if (!Number.isFinite(price) || price <= 0) {
            return res.status(400).send({
                success: false,
                message: "Please provide a valid rental price."
            });
        }

        // 4. Validate available quantity
        const quantity = Number(availableQuantity);

        if (!Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).send({
                success: false,
                message: "Available quantity must be a positive whole number."
            });
        }

        // 5. Validate owner information from JWT
        if (!req.user?.sub || !req.user?.email) {
            return res.status(401).send({
                success: false,
                message: "Owner authentication information is missing."
            });
        }

        // 6. Prepare equipment document
        const newEquipment = {
            equipmentName: equipmentName.trim(),
            description: description.trim(),
            category: category.trim(),
            location: location.trim(),

            rentalPrice: price,
            rentalType,
            availableQuantity: quantity,

            equipmentCondition: equipmentCondition.trim(),
            brand: brand.trim(),
            model: model.trim(),

            equipmentImage: equipmentImage.trim(),
            rentalTerms: rentalTerms.trim(),

            // Default approval status
            status: "Pending",

            // Owner information comes from verified JWT
            owner: {
                userId: req.user.sub,
                email: req.user.email,
                name: req.user.name || ""
            },

            createdAt: new Date()
        };

        // 7. Insert equipment into MongoDB
        const result = await equipment.insertOne(newEquipment);

        // 8. Send successful response
        res.status(201).send({
            success: true,
            message: "Equipment added successfully!",
            insertedId: result.insertedId
        });

    } catch (error) {
        console.error("Equipment insertion error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to add equipment."
        });
    }
});

//....... Get equipment added by the currently logged-in owner
app.get('/owner/equipment', verifyToken, verifyOwner, async (req, res) => {
    try {
        const result = await equipment
            .find({ "owner.userId": req.user.sub })
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).send({
            success: true,
            count: result.length,
            equipment: result
        });

    } catch (error) {
        console.error("Fetch owner equipment error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch your equipment."
        });
    }
});

// ........update equipment by owner--------
app.put("/owner/equipment/:id", verifyToken, verifyOwner, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid equipment ID.",
            });
        }

        const {
            equipmentName,
            description,
            category,
            location,
            rentalPrice,
            rentalType,
            availableQuantity,
            equipmentCondition,
            brand,
            model,
            equipmentImage,
            rentalTerms,
        } = req.body;

        const updatedData = {
            equipmentName: equipmentName?.trim(),
            description: description?.trim(),
            category: category?.trim(),
            location: location?.trim(),
            rentalPrice: Number(rentalPrice),
            rentalType,
            availableQuantity: Number(availableQuantity),
            equipmentCondition: equipmentCondition?.trim(),
            brand: brand?.trim(),
            model: model?.trim(),
            equipmentImage: equipmentImage?.trim(),
            rentalTerms: rentalTerms?.trim(),
            updatedAt: new Date(),
        };

        if (
            !updatedData.equipmentName ||
            !updatedData.description ||
            !updatedData.category ||
            !updatedData.location ||
            !updatedData.equipmentCondition ||
            !updatedData.brand ||
            !updatedData.model ||
            !updatedData.equipmentImage ||
            !updatedData.rentalTerms ||
            !["Daily", "Weekly", "Monthly"].includes(rentalType) ||
            !Number.isFinite(updatedData.rentalPrice) ||
            updatedData.rentalPrice <= 0 ||
            !Number.isInteger(updatedData.availableQuantity) ||
            updatedData.availableQuantity <= 0
        ) {
            return res.status(400).send({
                success: false,
                message: "Please provide valid equipment information.",
            });
        }

        const result = await equipment.updateOne(
            {
                _id: new ObjectId(id),
                "owner.userId": req.user.sub,
            },
            {
                $set: updatedData,
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "Equipment not found or you are not authorized.",
            });
        }

        res.status(200).send({
            success: true,
            message: "Equipment updated successfully!",
        });
    } catch (error) {
        console.error("Update equipment error:", error);
        res.status(500).send({
            success: false,
            message: "Failed to update equipment.",
        });
    }
});

// .........Delete equipment by owner for the currently logged-in owner
app.delete("/owner/equipment/:id", verifyToken, verifyOwner, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid equipment ID.",
            });
        }

        const result = await equipment.deleteOne({
            _id: new ObjectId(id),
            "owner.userId": req.user.sub,
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "Equipment not found or you are not authorized.",
            });
        }

        res.status(200).send({
            success: true,
            message: "Equipment deleted successfully!",
        });
    } catch (error) {
        console.error("Delete equipment error:", error);
        res.status(500).send({
            success: false,
            message: "Failed to delete equipment.",
        });
    }
});

// GET owner profile
app.get("/owner/profile", verifyToken, verifyOwner, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.user.sub)) {
            return res.status(400).send({
                success: false,
                message: "Invalid user ID.",
            });
        }

        const owner = await users.findOne(
            { _id: new ObjectId(req.user.sub) },
            {
                projection: {
                    name: 1,
                    email: 1,
                    image: 1,
                    phone: 1,
                    address: 1,
                    createdAt: 1,
                    role: 1,
                },
            }
        );

        if (!owner) {
            return res.status(404).send({
                success: false,
                message: "Owner profile not found.",
            });
        }

        res.status(200).send({
            success: true,
            profile: {
                name: owner.name || "",
                email: owner.email || req.user.email || "",
                image: owner.image || "",
                phone: owner.phone || "",
                address: owner.address || "",
                createdAt: owner.createdAt || null,
                role: owner.role || "owner",
            },
        });
    } catch (error) {
        console.error("Get owner profile error:", error);
        res.status(500).send({
            success: false,
            message: "Failed to load owner profile.",
        });
    }
});

// ........ owner profile update
app.put("/owner/profile", verifyToken, verifyOwner, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.user.sub)) {
            return res.status(400).send({
                success: false,
                message: "Invalid user ID.",
            });
        }

        const { name, image, phone, address } = req.body;

        if (
            typeof name !== "string" ||
            !name.trim() ||
            typeof phone !== "string" ||
            typeof address !== "string" ||
            typeof image !== "string"
        ) {
            return res.status(400).send({
                success: false,
                message: "Please provide valid profile information.",
            });
        }

        const updatedProfile = {
            name: name.trim(),
            image: image.trim(),
            phone: phone.trim(),
            address: address.trim(),
        };

        const result = await users.updateOne(
            { _id: new ObjectId(req.user.sub) },
            { $set: updatedProfile }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "Owner profile not found.",
            });
        }

        res.status(200).send({
            success: true,
            message: "Profile updated successfully!",
        });
    } catch (error) {
        console.error("Update owner profile error:", error);
        res.status(500).send({
            success: false,
            message: "Failed to update owner profile.",
        });
    }
});

// Get all equipment (Admin only)
app.get("/admin/equipment", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const result = await equipment
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        res.status(200).send({
            success: true,
            count: result.length,
            equipment: result,
        });
    } catch (error) {
        console.error("Fetch all equipment error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch equipment.",
        });
    }
});

// Update equipment approval status (Admin only)
app.patch(
    "/admin/equipment/:id/status",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid equipment ID.",
                });
            }

            const validStatuses = ["Pending", "Approved", "Rejected"];

            if (!validStatuses.includes(status)) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid equipment status.",
                });
            }

            const result = await equipment.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status,
                        updatedAt: new Date(),
                    },
                }
            );

            if (result.matchedCount === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Equipment not found.",
                });
            }

            res.status(200).send({
                success: true,
                message: `Equipment ${status.toLowerCase()} successfully.`,
            });
        } catch (error) {
            console.error("Update equipment status error:", error);

            res.status(500).send({
                success: false,
                message: "Failed to update equipment status.",
            });
        }
    }
);

// Update any equipment (Admin only)
app.put("/admin/equipment/:id", verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({
                success: false,
                message: "Invalid equipment ID.",
            });
        }

        const {
            equipmentName,
            description,
            category,
            location,
            rentalPrice,
            rentalType,
            availableQuantity,
            equipmentCondition,
            brand,
            model,
            equipmentImage,
            rentalTerms,
        } = req.body;

        const updatedData = {
            equipmentName: equipmentName?.trim(),
            description: description?.trim(),
            category: category?.trim(),
            location: location?.trim(),
            rentalPrice: Number(rentalPrice),
            rentalType,
            availableQuantity: Number(availableQuantity),
            equipmentCondition: equipmentCondition?.trim(),
            brand: brand?.trim(),
            model: model?.trim(),
            equipmentImage: equipmentImage?.trim(),
            rentalTerms: rentalTerms?.trim(),
            updatedAt: new Date(),
        };

        if (
            !updatedData.equipmentName ||
            !updatedData.description ||
            !updatedData.category ||
            !updatedData.location ||
            !updatedData.equipmentCondition ||
            !updatedData.brand ||
            !updatedData.model ||
            !updatedData.equipmentImage ||
            !updatedData.rentalTerms ||
            !["Daily", "Weekly", "Monthly"].includes(rentalType) ||
            !Number.isFinite(updatedData.rentalPrice) ||
            updatedData.rentalPrice <= 0 ||
            !Number.isInteger(updatedData.availableQuantity) ||
            updatedData.availableQuantity <= 0
        ) {
            return res.status(400).send({
                success: false,
                message: "Please provide valid equipment information.",
            });
        }

        const result = await equipment.updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedData }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({
                success: false,
                message: "Equipment not found.",
            });
        }

        res.status(200).send({
            success: true,
            message: "Equipment updated successfully.",
        });
    } catch (error) {
        console.error("Admin update equipment error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to update equipment.",
        });
    }
});

// Delete any equipment (Admin only)
app.delete(
    "/admin/equipment/:id",
    verifyToken,
    verifyAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            if (!ObjectId.isValid(id)) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid equipment ID.",
                });
            }

            const result = await equipment.deleteOne({
                _id: new ObjectId(id),
            });

            if (result.deletedCount === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Equipment not found.",
                });
            }

            res.status(200).send({
                success: true,
                message: "Equipment deleted successfully.",
            });
        } catch (error) {
            console.error("Admin delete equipment error:", error);

            res.status(500).send({
                success: false,
                message: "Failed to delete equipment.",
            });
        }
    }
);






// *****Get all approved equipment with search,filtering and sorting************

app.get("/equipment", async (req, res) => {
    try {
        const {
            search,
            category,
            rentalType,
            minPrice,
            maxPrice,
            availableOnly,
            sortBy,
        } = req.query;

        // Only show approved equipment
        const filter = {
            status: "Approved",
        };

        // Search by equipment name or location
        if (search && typeof search === "string" && search.trim()) {
            const searchRegex = new RegExp(
                search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );

            filter.$or = [
                { equipmentName: searchRegex },
                { location: searchRegex },
            ];
        }

        // Filter by category
        if (category && category !== "all") {
            filter.category = category;
        }

        // Filter by rental type
        if (rentalType && rentalType !== "all") {
            filter.rentalType = rentalType;
        }

        // Filter by minimum price
        if (minPrice !== undefined && minPrice !== "") {
            const minimum = Number(minPrice);

            if (!Number.isFinite(minimum) || minimum < 0) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid minimum price.",
                });
            }

            filter.rentalPrice = {
                ...filter.rentalPrice,
                $gte: minimum,
            };
        }

        // Filter by maximum price
        if (maxPrice !== undefined && maxPrice !== "") {
            const maximum = Number(maxPrice);

            if (!Number.isFinite(maximum) || maximum < 0) {
                return res.status(400).send({
                    success: false,
                    message: "Invalid maximum price.",
                });
            }

            filter.rentalPrice = {
                ...filter.rentalPrice,
                $lte: maximum,
            };
        }

        // Validate price range
        if (
            filter.rentalPrice?.$gte !== undefined &&
            filter.rentalPrice?.$lte !== undefined &&
            filter.rentalPrice.$gte > filter.rentalPrice.$lte
        ) {
            return res.status(400).send({
                success: false,
                message: "Minimum price cannot exceed maximum price.",
            });
        }

        // Show only equipment with available quantity
        if (availableOnly === "true") {
            filter.availableQuantity = { $gt: 0 };
        }

        // Sorting options
        let sortOptions = { createdAt: -1 };

        if (sortBy === "price-low") {
            sortOptions = { rentalPrice: 1 };
        } else if (sortBy === "price-high") {
            sortOptions = { rentalPrice: -1 };
        }

        // Fetch filtered and sorted equipment
        const result = await equipment
            .find(filter)
            .sort(sortOptions)
            .toArray();

        res.status(200).send({
            success: true,
            count: result.length,
            equipment: result,
        });

    } catch (error) {
        console.error("Fetch equipment error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to fetch equipment.",
        });
    }
});


// ######  make a post request to add equipment to favorites


app.post("/favorites", verifyToken, verifyCustomer, async (req, res) => {
    try {
        const {
            equipmentId,
            equipmentName,
            description,
            category,
            location,
            rentalPrice,
            rentalType,
            availableQuantity,
            equipmentImage,
            brand,
            model,
            status,
            createdAt,
        } = req.body;

        if (!equipmentId) {
            return res.status(400).send({
                success: false,
                message: "Equipment ID is required.",
            });
        }

        const favoriteData = {
            userId: req.user.sub,
            userEmail: req.user.email,

            equipmentId,
            equipmentName,
            description,
            category,
            location,
            rentalPrice,
            rentalType,
            availableQuantity,
            equipmentImage,
            brand: brand || "",
            model: model || "",
            status,
            equipmentCreatedAt: createdAt,

            favoritedAt: new Date(),
        };

        const existingFavorite = await favoritesCollection.findOne({
            userId: req.user.sub,
            equipmentId: equipmentId,
        });

        if (existingFavorite) {
            return res.status(409).send({
                success: false,
                message: "This equipment is already in your favorites.",
            });
        }

        const result = await favoritesCollection.insertOne(favoriteData);

        res.status(201).send({
            success: true,
            message: "Equipment added to favorites successfully.",
            insertedId: result.insertedId,
        });

    } catch (error) {
        console.error("Add favorite error:", error);

        res.status(500).send({
            success: false,
            message: "Failed to add favorite.",
        });
    }
});


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

export default app;
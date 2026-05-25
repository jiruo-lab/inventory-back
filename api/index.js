// import the installed modules
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import serverless from "serverless-http";
import cors from "cors";
import mongoose from "mongoose";

const app = express();
app.use(express.json());
const port = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/Inventory-Management";

// Trigger connection to mongoDB thru mongoose
// mongoose.connect("mongodb://localhost:27017/");
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connection is successful."))
    .catch(err => console.log(err));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicPath = path.join(__dirname, "..", "front");
app.use(express.static(publicPath));
app.get("/", (req, res) => {
    res.json({ message: "Welcome to the Inventory Management System API!" });
});

export default serverless(app);
export default app;

const db = mongoose.connection;

// Check if connection has error
db.on("error", (err) => console.error("MongoDB connection error:", err));

// Check if connection is okay
db.once("open", () => console.log("MongoDB connection opened."));

//Schema -> blueprint

const inventorySchema = new mongoose.Schema({
    name: String,
    productName: String,
    sku: String,
    category: String,
    quantity: Number,
    price: Number,
    supplier: String,
    reorderLevel: Number,
    brand: String,
    stocks: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    dateAdded: {
        type: Date,
        default: Date.now
    }
})

//Model
const InventoryItem = mongoose.model("InventoryItem", inventorySchema);

const itemCategorySchema = new mongoose.Schema({
    categoryName: String,
    description: String,
    dateAdded: {
        type: Date,
        default: Date.now
    }
})

const ItemCategory = mongoose.model("ItemCategory", itemCategorySchema);

const supplierSchema = new mongoose.Schema({
    supplier: String,
    contact: String,
    address: String,
    dateAdded: {
        type: Date,
        default: Date.now
    }
});

const Supplier = mongoose.model("Supplier", supplierSchema);



// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

// Routes
app.get("/home", (req, res) => {
    res.send("Hello from the home endpoint!");
});
// Error handling for undefined routes
app.get("/error", (req, res) => {
    res.status(404).send({
        code: 404,
        message: "Sorry the page cannot be found."
    })
})

// Add new inventory item
app.post("/inventory/add", async (req, res) => {
    try {
        const duplicate = await InventoryItem.findOne({
            productName: req.body.productName,
            category: req.body.category,
            brand: req.body.brand,
            supplier: req.body.supplier
        });

        if (duplicate) {
            return res.status(409).send({
                code: 409,
                message: "Duplicate found. This inventory item cannot be added!"
            });
        }

        const newInventoryItem = new InventoryItem({
            name: req.body.name,
            productName: req.body.productName,
            sku: req.body.sku,
            category: req.body.category,
            quantity: req.body.quantity,
            price: req.body.price,
            supplier: req.body.supplier,
            reorderLevel: req.body.reorderLevel,
            brand: req.body.brand,
            stocks: req.body.stocks
        });

        const savedItem = await newInventoryItem.save();
        res.status(201).send({
            code: 201,
            message: "Inventory item is now added!",
            data: savedItem
        });
    } catch (err) {
        console.error("Error adding inventory item:", err);
        res.status(500).send({
            code: 500,
            message: "There is an error saving the inventory item.",
            error: err.message
        });
    }
})
// Get all inventory items
app.get("/inventory/get-all-item", async (req, res) => {
    try {
        const items = await InventoryItem.find({});
        res.status(200).send({
            code: 200,
            message: "Inventory items retrieved successfully!",
            data: items
        });
    } catch (err) {
        console.error("Error retrieving inventory items:", err);
        res.status(500).send({
            code: 500,
            message: "Error retrieving inventory items.",
            error: err.message
        });
    }
})


// Get inventory item by itemName
app.get("/inventory/get-item", (req, res) => {
    const itemName = req.query.itemName;

    if(!itemName){
        res.send("Item name is required.");
        return;
    }

    const escapedItemName = itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`^${escapedItemName}$`, "i");

    InventoryItem.findOne({name: nameRegex}).then((item) => {
        if(item == null){
            res.send("Inventory item not found. Cannot retrieve!");
        }else{
            res.status(200).send({
                code: 200,
                message: "Inventory item retrieved successfully!",
                data: item
            });
        }
    }).catch((err) => {
        console.error("Error retrieving inventory item:", err);
        res.status(500).send({
            code: 500,
            message: "Error retrieving inventory item.",
            error: err.message
        });
    })
})

// Unified search endpoint for the front-end and results page
app.get("/api/search", async (req, res) => {
    const schema = (req.query.schema || "all").toLowerCase();
    const searchText = (req.query.q || "").trim();
    const allSchemas = req.query.all === "1" || schema === "all";
    const escapedSearch = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchRegex = searchText ? new RegExp(escapedSearch, "i") : /.*/;
    const response = {};

    try {
        if (allSchemas || schema === "inventory") {
            response.inventory = await InventoryItem.find(
                searchText ? {
                    $or: [
                        { name: searchRegex },
                        { productName: searchRegex },
                        { sku: searchRegex },
                        { category: searchRegex },
                        { brand: searchRegex },
                        { supplier: searchRegex }
                    ]
                } : {}
            ).sort({ category: 1, name: 1 }).lean();
        }

        if (allSchemas || schema === "category") {
            response.category = await ItemCategory.find(
                searchText ? {
                    $or: [
                        { categoryName: searchRegex },
                        { description: searchRegex }
                    ]
                } : {}
            ).sort({ categoryName: 1 }).lean();
        }

        if (allSchemas || schema === "supplier") {
            response.supplier = await Supplier.find(
                searchText ? {
                    $or: [
                        { supplier: searchRegex },
                        { contact: searchRegex },
                        { address: searchRegex }
                    ]
                } : {}
            ).sort({ supplier: 1 }).lean();
        }

        res.status(200).send({ code: 200, items: response });
    } catch (error) {
        console.error("Search error:", error);
        res.status(500).send({
            code: 500,
            message: "Error performing search.",
            error: error.message
        });
    }
});

// Delete inventory item by itemId
app.delete("/inventory/delete/:itemId", async (req, res) => {
    if(!mongoose.isValidObjectId(req.params.itemId)){
        res.status(400).send({ code: 400, message: "Invalid itemId provided." });
        return;
    }

    try {
        const deletedItem = await InventoryItem.findByIdAndDelete(req.params.itemId);
        if (deletedItem == null) {
            return res.status(404).send({ code: 404, message: "Inventory item not found. Cannot delete!" });
        }
        res.status(200).send({
            code: 200,
            message: "Inventory item is now deleted!",
            data: deletedItem
        });
    } catch (err) {
        console.error("Error deleting inventory item:", err);
        res.status(500).send({ code: 500, message: "There is an error deleting the inventory item.", error: err.message });
    }
})

// Update stocks for inventory item
app.patch("/inventory/update-stocks/:itemId", (req, res) => {
    if(!mongoose.isValidObjectId(req.params.itemId)){
        res.status(400).send({ code: 400, message: "Invalid itemId provided." });
        return;
    }

    const stocks = Number(req.body.stocks);
    if(Number.isNaN(stocks)){
        res.status(400).send({ code: 400, message: "A valid stocks value is required." });
        return;
    }

    InventoryItem.findByIdAndUpdate(
        req.params.itemId,
        { stocks },
        { new: true }
    ).then((updatedItem) => {
        if(!updatedItem){
            res.status(404).send({ code: 404, message: "Inventory item not found. Cannot update stocks!" });
        }else{
            res.status(200).send({ code: 200, message: "Item stocks updated successfully!", data: updatedItem });
        }
    }).catch((err) => {
        console.error("Error updating stocks:", err);
        res.status(500).send({ code: 500, message: "There is an error updating stocks.", error: err.message });
    });
});

// Edit inventory item by itemId
app.patch("/inventory/edit/:itemId", async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.itemId)) {
        return res.status(400).send({
            code: 400,
            message: "Invalid itemId provided."
        });
    }

    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send({
            code: 400,
            message: "Request body is empty. Please provide data to update."
        });
    }

    try {
        const result = await InventoryItem.findById(req.params.itemId);
        if (result == null) {
            return res.status(404).send({
                code: 404,
                message: "Inventory item not found. Cannot edit!"
            });
        }

        if (req.body.name != null) result.name = req.body.name;
        if (req.body.productName != null) result.productName = req.body.productName;
        if (req.body.sku != null) result.sku = req.body.sku;
        if (req.body.category != null) result.category = req.body.category;
        if (req.body.quantity != null) result.quantity = req.body.quantity;
        if (req.body.price != null) result.price = req.body.price;
        if (req.body.supplier != null) result.supplier = req.body.supplier;
        if (req.body.reorderLevel != null) result.reorderLevel = req.body.reorderLevel;
        if (req.body.brand != null) result.brand = req.body.brand;
        if (req.body.stocks != null) result.stocks = req.body.stocks;

        const updatedItem = await result.save();
        res.status(200).send({
            code: 200,
            message: "Inventory item is now updated!",
            data: updatedItem
        });
    } catch (err) {
        console.error("Error updating inventory item:", err);
        res.status(500).send({
            code: 500,
            message: "There is an error updating the inventory item.",
            error: err.message
        });
    }
})
// Delete all inventory items
app.delete("/inventory/delete-all", async (req, res) => {
    try {
        const result = await InventoryItem.deleteMany({});
        res.status(200).send({
            code: 200,
            message: "All inventory items are now deleted!",
            data: result
        });
    } catch (err) {
        console.error("Error deleting all inventory items:", err);
        res.status(500).send({
            code: 500,
            message: "There is an error deleting all inventory items.",
            error: err.message
        });
    }
})




// Add new item category
app.post("/inventory/category", async (req, res) => {
    try {
        const existingCategory = await ItemCategory.findOne({ categoryName: req.body.categoryName });
        if (existingCategory) {
            return res.status(409).send({
                code: 409,
                message: "Category already exists. Cannot add duplicate category!"
            });
        }

        const newItemCategory = new ItemCategory({
            categoryName: req.body.categoryName,
            description: req.body.description
        });

        const savedCategory = await newItemCategory.save();
        res.status(201).send({
            code: 201,
            message: "Item category is now added!",
            data: savedCategory
        });
    } catch (err) {
        console.error("Error adding item category:", err);
        res.status(500).send({
            code: 500,
            message: "There is an error saving the item category.",
            error: err.message
        });
    }
})

// List inventory items by category name
app.get("/inventory/list-item-category", async (req, res) => {
    const categoryName = req.query.categoryName;

    if (!categoryName) {
        return res.status(400).send({ code: 400, message: "Category name is required." });
    }

    const escapedCategoryName = categoryName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const categoryRegex = new RegExp(`^${escapedCategoryName}$`, 'i');

    try {
        const category = await ItemCategory.findOne({ categoryName: categoryRegex });
        if (!category) {
            return res.status(404).send({ code: 404, message: "Category not found. Cannot list items!" });
        }

        const items = await InventoryItem.find({ category: categoryRegex });
        if (!items.length) {
            return res.status(200).send({ code: 200, message: "No items found for this category.", data: [] });
        }

        res.status(200).send({
            code: 200,
            message: `Inventory items for category ${categoryName} retrieved successfully!`,
            data: items
        });
    } catch (err) {
        console.error("Error listing items by category:", err);
        res.status(500).send({ code: 500, message: "Error retrieving inventory items for the category.", error: err.message });
    }
})
// List of all categories
app.get("/inventory/all-category", async (req, res) => {
    try {
        const categories = await ItemCategory.find({});
        res.status(200).send({
            code: 200,
            message: "All item categories retrieved successfully!",
            data: categories
        });
    } catch (err) {
        console.error("Error retrieving categories:", err);
        res.status(500).send({
            code: 500,
            message: "Error retrieving categories.",
            error: err.message
        });
    }
})


//Supplier routes

// Add new supplier
app.post("/inventory/supplier", async (req, res) => {
    if (!req.body || !req.body.supplier || !req.body.contact || !req.body.address) {
        return res.status(400).send({
            code: 400,
            message: "Supplier name, contact, and address are required."
        });
    }

    try {
        const existingSupplier = await Supplier.findOne({ supplier: req.body.supplier });
        if (existingSupplier) {
            return res.status(409).send({
                code: 409,
                message: "Supplier already exists. Cannot add duplicate supplier!"
            });
        }

        const newSupplier = new Supplier({
            supplier: req.body.supplier,
            contact: req.body.contact,
            address: req.body.address
        });

        const savedSupplier = await newSupplier.save();
        res.status(201).send({
            code: 201,
            message: "Supplier is now added!",
            data: savedSupplier
        });
    } catch (err) {
        console.error("Error saving supplier:", err);
        res.status(500).send({
            code: 500,
            message: "There is an error saving the supplier.",
            error: err.message
        });
    }
})
// List of supplier name
app.get("/inventory/list_of_supplier", async (req, res) => {
    try {
        const suppliers = await Supplier.find({});
        res.status(200).send({
            code: 200,
            message: "Supplier list retrieved successfully!",
            data: suppliers
        });
    } catch (err) {
        console.error("Error retrieving supplier list:", err);
        res.status(500).send({
            code: 500,
            message: "Error retrieving supplier list.",
            error: err.message
        });
    }
})

// List of inventory items by supplier name
app.get("/inventory/items_from_supplier", async (req, res) => {
    let supplierName = req.query.supplierName;

    if (!supplierName) {
        return res.status(400).send({ code: 400, message: "Supplier name is required." });
    }

    supplierName = supplierName.trim();
    const escaped = supplierName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const supplierRegex = new RegExp('^' + escaped + '$', 'i');

    try {
        const supplier = await Supplier.findOne({ supplier: supplierRegex });
        if (!supplier) {
            return res.status(404).send({ code: 404, message: "Supplier not found. Cannot list items!" });
        }

        const items = await InventoryItem.find({ supplier: supplierRegex });
        if (!items.length) {
            return res.status(200).send({ code: 200, message: "No items found for this supplier.", data: [] });
        }

        res.status(200).send({
            code: 200,
            message: `Inventory items for supplier ${supplierName} retrieved successfully!`,
            data: items
        });
    } catch (err) {
        console.error("Error listing items by supplier:", err);
        res.status(500).send({
            code: 500,
            message: "Error searching for supplier or retrieving items.",
            error: err.message
        });
    }
})


app.use((req, res) => {
    res.status(404).send({ code: 404, message: "Not found. Check the requested route." });
});

app.use((err, req, res, next) => {
    console.error("Unexpected server error:", err);
    res.status(500).send({ code: 500, message: "Internal server error.", error: err.message });
});

export default app;
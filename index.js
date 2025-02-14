require("dotenv").config();
const config = require("./config.json");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const User = require("./models/user.model");
const TravelStory = require("./models/travelStory.model");

const upload = require("./multer");
const fs = require("fs");
const path = require("path");

const { authenticateToken } = require("./utilities");
//const { AsyncLocalStorage } = require("async_hooks");
const { error } = require("console");

mongoose.connect(config.connectionString);

const app = express();
app.use(express.json());
app.use(cors({ origin: "*" }));

//Creat Account
app.post("/create-account", async (req, res) => {
    const { fullName, email, password } = req.body;
    if (!fullName || !email || !password) {
        return res
            .status(400)
            .json({ error: true, message: "All fields are required" });
    }

    const isUser = await User.findOne({ email });

    if (isUser) {
        return res
            .status(400)
            .json({ error: true, message: "User already exits" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
        fullName,
        email,
        password: hashedPassword,
    });

    await user.save();
    const accsessToken = jwt.sign(

        { userId: user._id },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: "72h",
        }
    );

    return res.status(201).json({
        error: false,
        user: { fullName: user.fullName, email: user.email },
        accsessToken,
        message: "Registration Successful",
    });


});

//Login
app.post("/login", async (req, res) => {

    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and Password are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(400).json({ message: "User not found" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(400).json({ message: "Inalid Credentials" });
    }
    const accsessToken = jwt.sign(
        { userId: user.id },

        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: "72h",
        }
    );
    return res.json({
        error: false,
        message: "Login Successful",
        user: { fullName: user.fullName, email: user.email },
        accsessToken,
    });

});

//Get User
app.get("/get-user", authenticateToken, async (req, res) => {
    const { userId } = req.user
    const isUser = await User.findOne({ _id: userId });
    //console.log(userId, "\n");
    if (!isUser) {
        return res.sendStatus(401);
    }
    return res.json({
        user: isUser,
        message: "",
    });
});

//console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);

// Travel Story

app.post("/add-travel-story", authenticateToken, async (req, res) => {
    //const {title, story, visitedLocation, imageUrl, visitedDate} = req.body;
    const { userId } = req.user;
    req.body.userId = userId;

    console.log(req.user);

    function removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }

    req.body.titleNoDiacritics = removeAccents(req.body.title);
    req.body.storyNoDiacritics = removeAccents(req.body.story);

    if (!req.body.title || !req.body.story || !req.body.visitedLocation || !req.body.imageUrl || !req.body.visitedDate) {
        return res.status(400).json({ error: true, message: "All fields are required" });
    }

    const parsedVisitedDate = new Date(parseInt(req.body.visitedDate));
    req.body.visitedDate = parsedVisitedDate;
    try {
        const travelStory = new TravelStory(req.body);

        await travelStory.save();
        res.status(201).json({ story: travelStory, message: "Added Successfully" });
    } catch (error) {
        res.status(400).json({ error: true, message: error.message });
    }

});

//Get All Travel Story

app.get("/get-all-stories", authenticateToken, async (req, res) => {
    const { userId } = req.user;

    try {
        const travelStories = await TravelStory.find({ userId: userId }).sort({
            isFavourite: -1
        });
        res.status(200).json({ stories: travelStories });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

//Route to hanlde image upload
app.post("/image-upload", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.
                status(400)
                .json({ error: true, message: "No image uploaded" });
        }

        const imageUrl = `http://localhost:8000/uploads/${req.file.filename}`;
        res.status(201).json({ imageUrl });

    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

//Delete image from uploads folder
app.delete("/delete-image", async (req, res) => {
    const { imageUrl } = req.query;
    if (!imageUrl) {
        return res
            .status(400)
            .json({ error: true, message: "imageUrl is required" });
    }
    try {
        const filename = path.basename(imageUrl);
        const filePath = path.join(__dirname, 'uploads', filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return res.status(200).json({ message: "Image delete successfully" });
        } else {
            return res.status(200).json({ message: "Image not found" });
        }
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

//Serve static files from uploads and assets directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

app.put("/edit-story/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, story, visitedLocation, imageUrl, visitedDate } = req.body;
    const { userId } = req.user;

    if (!title || !story || !visitedLocation || !imageUrl || !visitedDate) {
        return res.status(400).json({ error: true, message: "All fields are required" });
    }

    const parsedVisitedDate = new Date(parseInt(visitedDate));
    try {
        const travelStory = await TravelStory.findOne({ _id: id, userId: userId });

        if (!travelStory) {
            return res.status(400).json({ error: true, message: "Travel Story not found" });
        }
        const placeholderImgUrl = `http://localhost:8000/assets/placeholder.jpg`;

        travelStory.title = title;
        travelStory.story = story;
        travelStory.visitedLocation = visitedLocation;
        travelStory.imageUrl = imageUrl || placeholderImgUrl;
        travelStory.visitedDate = parsedVisitedDate;

        await travelStory.save();
        res.status(200).json({ story: travelStory, message: 'Update successful' });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }

});

//Delete Story
app.delete("/delete-story/:id", authenticateToken, async (req, res) => {
    const { userId } = req.user;
    const { id } = req.params;

    try {
        const travelStory = await TravelStory.findOne({ _id: id, userId: userId });

        if (!travelStory) {
            return res.status(404).json({ error: true, message: "Travel Story not found" });
        }
        await travelStory.deleteOne({ _id: id, userId: userId });

        const imageUrl = travelStory.imageUrl;
        const filename = path.basename(imageUrl);

        const filePath = path.join(__dirname, 'uploads', filename);

        fs.unlink(filePath, (err) => {
            if (err) {
                console.error("Failed to delete image file:", err);
            }
        });
        res.status(200).json({ message: "Travel Story delete successfully" });

    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

//Search Story

app.get("/search", authenticateToken, async (req, res) => {
    const { query } = req.query;
    const { userId } = req.user;

    if (!query) {
        return res.status(404).json({ error: true, message: "query is required" });
    }
    // Hàm loại bỏ dấu
    function removeAccents(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    removeAccents(req.query.query);
    const regex = new RegExp(req.query.query, "i");

    try {
        const searchResults = await TravelStory.find({
            userId: userId,
            $or: [
                { title: regex },
                { titleNoDiacritics: regex },
                { story: regex },
                { storyNoDiacritics: regex },
            ],
        }).sort({ isFavourite: -1 });



        res.status(200).json({ stories: searchResults });
    } catch (error) {
        res.status(500).json({ error: true, message: error.message });
    }
});

console.log("HiepPotato");

app.listen(8000);
module.exports = app;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

function removeAccents(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const travelStorySchema = new Schema({
    title: { type:String, required: true},
    titleNoDiacritics: { type: String, required: true },
    story: { type:String, required: true},
    storyNoDiacritics: { type:String, required: true},
    visitedLocation: { type:[String], default: []},
    isFavourite: { type: Boolean, default: false},
    userId: { type:Schema.Types.ObjectId, ref:"User", required: true},
    createdOn: { type: Date, default: Date.now},
    imageUrl: { type:String, required: true},
    visitedDate: { type:Date, required: true},
});

travelStorySchema.pre("save", function (next) {
    this.titleNoDiacritics = removeAccents(this.title);
    this.storyNoDiacritics = removeAccents(this.story);
    next();
});

module.exports = mongoose.model("TravelStory", travelStorySchema);
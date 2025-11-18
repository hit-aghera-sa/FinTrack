const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
    name:{
        type: String,
        required: [true, "name is required"]
    },
    type:{
        type: String,
        enum: {
           values: ["income", "expense"],
           message: "category type must be income or expense"
        },
        required: [true, "type is required"]
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "userId is required"]
    }
},
{
    timestamps: true
})

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
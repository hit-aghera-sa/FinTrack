const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
    type:{
        type: String,
        enum: {
            values: ["income", "expense"],
            message: "type must be income or expense"
        },
        required: [true, "transaction type is required"]
    },
    amount:{
        type: Number,
        required: [true, "transaction ammount is required"]
    },
    categoryId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: [true, "categoryId is required"]
    },
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "userId is required"]
    },
    description:{
        type: String
    },
    date:{
        type: Date,
        default: Date.now
    },
    attachments:{
        type: [String],
        default: []
    },
    active:{
        type: Boolean,
        default: true,
        select: false
    },
    isRecurring:{
        type: Boolean,
        default: false
    },
    isSubscription:{
        type: Boolean,
        default: false
    }
},
{
    timestamps: true
})

transactionSchema.pre(/^find/, async function(next){
    this.find({active: {$ne: false}});
    next()
})

const Transaction = mongoose.model("Transaction", transactionSchema);
module.exports = Transaction;
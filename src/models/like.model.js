import mongoose, {Schema} from "mongoose";

const likeSchema = new Schema(
     {
          Comment : {
               type: Schema.Types.ObjectId, //like on comment
               ref:"Comment",
          },
          video : {
               type: Schema.Types.ObjectId, //like on vodeo
               ref:"Video"
          },
          likedBy : {
               type:Schema.Types.ObjectId, //which user is liked 
               ref:"User"
          },
          tweet : {
               type:Schema.Types.ObjectId, //community like
               ref:"Tweet"
          },

},{
     timestamps: true
})

export const Like = mongoose.model("Like",likeSchema)
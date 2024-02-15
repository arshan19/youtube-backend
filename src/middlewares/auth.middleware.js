//verify user exists or not

import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";


/*when we login our user , we give accesstoken and refresh token, 
 in the basis of these accessToken and refreshToken , we verify our user whether it is correct or not = This is to check our true login */

//My straegy : we add new object in req (like req.body ,req.cookie)
// = req.user (named should be whatever you want like req.arshan)

//code comments
//1.we use to check cookies for browser here and req.header for mobile , because they don't have cookies in them 
//2.we use plain JS , and use method replace which replace the Bearer with a empty String without space and we get our token , because in Authorization we have Bearer tokenxyz , and we extract this here 
//3.here we use inbuild feature of jwt which is jwt.verify , to verify the token using token from cookie or header and ACCESS_TOKEN_SECRET and store this in decodedToken variable
//4.then find the User by findById(id of user) which is in decoded token ,which we give at this time , when we generating a user
// return jwt.sign(
//     {
//         _id: this._id,
//         email: this.email,
//         username: this.username,
//         fullName: this.fullName
//     },
//and remove password and refreshToken field which are not required and store it newly creted variable user

//5. we create a new object here using req.user(whatever name you want to give) = user(from this user created above)
//6.then use middleware next(), which move the code further to next middleware or method to execute in routes file like example:
// router.route("/logout").post(verifyJWT, logOutUser)


export const verifyJWT = asyncHandler (async(req, _,next) => 
{
    try {
        const token =  req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ","")
        
        if(!token){
            throw new ApiError(401,"UnAuthorized request")
        }
    
        const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
    
        if(!user){
            throw new ApiError(401,"Invalid Access Token")
        }
        
        //here we create a new object with whatever name
        req.user = user;
        next()

    } catch (error) {
        throw new ApiError(401,error?.message || "invalid access token")
    }

})
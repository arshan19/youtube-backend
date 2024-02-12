import { asyncHandler } from "../utils/asyncHandler.js";

import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"

const registerUser  = asyncHandler( async (req,res)=>{
    
    //get user details from frontend
    //validation - not empty
    //check if user already exists:username,email
    //check for images,check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return res


    //get user details from frontend
    const { fullName,email,username,password } = req.body;
    console.log("email:" ,email); //check email or other entries are present or not

    //validation - not empty , check for field are they empty or not
    //if empty , code is not going any further
    if(
        [ fullName, email, username, password].some((field)=> field?.trim() === "")
        ){
            throw new ApiError(400,"All field are required")
    }

    //check if user already exists:username,email
    const existedUser = User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    //check for images,check for avatar specially , avatar is required so it should be available,otherwise code is not going forward. and also add functionality to add coverImage , but we don't check for coverImage because it is not Required.

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required")
    }

    //create user object - create entry in db

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    //remove password and refresh token field from response

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    //check for user creation

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registring the user")
    }

    //return res

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully!!")
    )

}) 

export { 
    registerUser,
}
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"
import  jwt  from "jsonwebtoken";

const generateAccessAndRefreshTokens = async(userId) =>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave: false})
        
        return {accessToken,refreshToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access Token")
    }
}

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
    //console.log("email:" ,email); //check email or other entries are present or not

    //validation - not empty , check for field are they empty or not
    //if empty , code is not going any further
    if(
        [ fullName, email, username, password].some((field)=> field?.trim() === "")
    ) {
            throw new ApiError(400,"All field are required")
    }

    //check if user already exists:username,email
    const existedUser = await User.findOne({
        $or: [{ username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username already exists")
    }

    /* check for images,check for avatar specially , avatar is required so it should be available,
    otherwise code is not going forward. and also add functionality to add coverImage , 
    but we don't check for coverImage because coverImage is not Required. */

    //console.log(req.files);
    
    //const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let avatarLocalPath;
    if(req.files && Array.isArray(req.files.avatar) && req.files.avatar.length > 0){
        avatarLocalPath = req.files.avatar[0].path;
    }

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

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

const loginUser = asyncHandler( async(req,res)=>{
    
    //req body -> data (get data from User)
    //validate username or email
    //find the user
    //check password
    //generate access and refresh token
    //send cookie

    //req body -> data (get data from User)
    const {email,username,password} = req.body
    //console.log(email);

    //validate username or email
    if(!(username || email)){
        throw new ApiError(400,"Username or email is required")
    }

    // if (!username && !email) {
    //     throw new ApiError(400, "username or email is required")}
    // Here is an alternative of above code based on logic where we require both username and email

    //find the user
    const user = await User.findOne({
        $or : [{username},{email}]
    })

    //user not find 
    if(!user){
        throw new ApiError(404,"User does not Exist")
    }

    //check for password
    const isPasswordValidate = await user.isPasswordCorrect(password)

    if(!isPasswordValidate){
        throw new ApiError(401,"invalid user credentials")
    }

    //generate access and refresh token
    const {accessToken , refreshToken } = await generateAccessAndRefreshTokens(user._id)

    //either you update the user object or making another database query
    //it upto you , you have to decide is this a expensive operation or not to call the database one more time
    //optional field , whether you do or not 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    //send this response to cookie and set it 

    /*when we sendcookies we need setup some options for the cookies 
    because everything is accessiable to cookie, but when you define options you setup them to do by the server side only, not by the client or frontend side, it shows to everyone but no one can modified it  */

    const options = {
        httpOnly: true,
        secure: true
    }
    
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser,accessToken,refreshToken
            },
            "User logged in Successfully!"
        )
    )

})

const logOutUser = asyncHandler (async(req,res)=>{

    //main task: how we logout the user 
    //1.reset the refreshToken 
    //2.clear the cookies

    /* main problem: we logoutUser , we need to find the user but how we find the user , throught (User.findById), but where are the use , how do we take the id here ? because this method doesn't have access to User 
    because in above login user we have email, username ,password where we put query req.body , and find the user by User.findById
    but at logout , we don't give user the form like enter the username or email to logout , that's not cool , because than it can logout anyone by putting the email of anyone  */

    //so here we use middleware 
    //here we design our own middleware for verify

    /*
    SO HERE FINALLY when we use
    router.route("/logout").post(verifyJWT, logOutUser) 
    and here in verifyJWT we have req.user ? 
    yes , we solve our problem 
    = req.user._id
    */

    //console.log(req.user);

    //1.reset the refreshToken or remove from database
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: "" // or undefined
            }
        },
        {
            new: true
        } // here in response we get new updated value 
        
    )
    
    
    //2.clear the cookies
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{}, "User logged out"))
})

const refreshAccessToken = asyncHandler ( async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorized request")
    }
    
    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user =await User.findById(decodedToken?._id)
    
        if(!user){
            throw new ApiError(401,"InValid refresh token")
        }
    
        if ( incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used ")
        }
    
        const options = {
            httpOnly : true,
            secure : true
        }
    
        const {newRefreshToken , accessToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken , options)
        .cookie("refreshToken", newRefreshToken , options)
        .json(
            new ApiResponse(200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token Refreshed"
                )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
        
    }

})

export { 
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken

}
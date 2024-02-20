import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { User } from "../models/user.model.js"
import  jwt  from "jsonwebtoken";
import mongoose from "mongoose";

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

const changeCurrentPassword = asyncHandler ( async ( req,res )=>{

    /*Code comments: 1.Taking input from frontend in req.body
    2.check for new password is similiar to confirm password
    3.find the user using _id because we use auth.middleware in our endpoints, that's why we get our user here , and then write a Query using
    User.findById from database (that's why we use await here)
    4.now check for password is correct using the method isPasswordCorrect() which give value in true or false and we write this in our user.model where we use pre hooks
    5.if password is correct,then we update the user object password to newPassword, then this triggred and go into user model, and just before save , our pre hook is running where we use isModified() method , and password will hash and use the bcrypt there 
    6.then we save the user details and also add validateBeforeSave to false , so that whole database is not validate once again
    7.At last we return the response
      */
    const {oldPassword, newPassword, confirmPassword} = req.body;

    if(!(newPassword === confirmPassword)){
        throw new ApiError(400, "Password Not Matched");
    }

    const user =  await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(400,"oldPassword is invalid")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json (new ApiResponse(200,{},"Password Changed Successfully"))
})

const getCurrentUser = asyncHandler( async (req,res) =>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Current User Fetched Successfully"))
    /* code comments: when we hit the endpoints at authMiddleware,we have auth middleware,where we have details of the user , so if we have loggedIn user , then we can give the current details in seconds, and in the return the response */
})

const updateAccountDetails = asyncHandler (async(req,res)=>{
    const {fullName, email} = req.body

    if(!fullName || !email){
        throw new ApiError (400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email: email
            }
        },
        {new: true}
        ).select("-password")

        return res
        .status(200)
        .json(new ApiResponse(200,user,"Account Details updated Successfully"))
})

const updateUserAvatar = asyncHandler (async (req,res)=>{
    /*code comments
    1.take req.file from multer middleware like we use in register user
      but we take req.file here not req.files because only work on one file not on array of files.
    2.we take avatar local file here from req.file?.path
    3.now, upload avatar file on cloudinary 
    4.check for avatar url , if missing write an error
    5.now we update our avatar using findByIdAndUpdate AND Insert $set in this where we do avatar = avatar.url , we put the url of avatar in database , not the object of avatar, as we set type: string in our User Model for avatar
    note: $set only update what we value we insert on this, and it takes an object */

   const avatarLocalPath =  req.file?.path

   if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    // Retrieve the user's current avatar URL from the database
    const currentUser = await User.findById(req.user?._id).select("avatar");
    const oldAvatarUrl = currentUser.avatar;


    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on Avatar url")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")

    
    // // If the user had an old avatar, delete it from Cloudinary
    // if (oldAvatarUrl) {
    //     const publicId = extractPublicIdFromUrl(oldAvatarUrl);
    //     await deleteFromCloudinary(publicId);
    // }

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar is updated Successfully"))
})

const updateUserCoverImage = asyncHandler (async (req,res)=>{

    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"CoverImage file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(400,"Error while Uploading the cover image")
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage : coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Cover Image is updated Successfully"))

})

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400,"Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match : {
                username  : username?.toLowerCase() //check for all username , match is like filter (take out all user using username )
            }
        },
        {
            $lookup : {
                from: "subscriptions", // from where,which model you want lookup
                localField:"_id", // from which we connected two models all together
                foreignField: "channel", //from where we want to look
                as: "subscribers" //name of the newly created field
            }
        },
        {
            $lookup:{
                from: "subscriptions",
                localField:"_id",
                foreignField: "subscriber", // like,where we want to select value and insert into our document
                as: "subscribedTo"
            }
        },
        {
            //another operator: which will do addition of newly created field into our yser model, and it doesn't effect the former field we have in our model , all the previous field remain the same , and also add the newly created field into our model
            $addFields:{     
                subscribersCount: {
                    $size: "$subscribers", // to add(count) all the document subscriber have we use $size
                },                         
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"  //we add dollor sign here, because it is field subscribedTo now
                },
                isSubscribed: { //use to check if we are subscribed to a channel or not , we use flag to indicate to frontend that we are subscribed to a channel or not.
                    $cond: {
                        if:{$in: [req.user?._id,"$subscribers.subscriber"]}, //$in is used to check in array[] if we are subscribed to a channel or not and we have to check req.user?._id which check for field value of $subscribers.subscriber is present in this or not. 
                        then:true,
                        else:false
                    }
                }
            }
        },
        {
            $project:{ // project is used for projection of values , means that we only show values that are we need to display,not all values. and use flags for projection like 0 and 1.
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount : 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])
    console.log(channel);
    

    if(!channel?.length){
        throw new ApiError(404,"Channel Does not exist")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"user channel fetched successfully"))

})

const getWatchHistory = asyncHandler (async(req,res)=>{
    
    //so here we can't fetch req.user._id directly because aggregate pipeline work on mongoDB not on mongoose , so we can't find _id directly so use 
    //new mongoose.Types.ObjectId(req.user._id) for fetch the _id directly from mongoDB database

    const user = await User.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            /* Here we use pipeline inside pipeline , nested pipelines,because in our model 
            we have watch history connected to video model and also in our video model we have owner field,which contains information of owner, which is also a user, 
            so then in our first lookup pipeleine insert another pipeline to fetch the owner details from users 
            and using $project we only project needed field , not all unneccesary field */
            
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[
                    {
                        $lookup:{
                            from:"users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[
                                {
                                $project: {
                                    fullName: 1,
                                    username: 1,
                                    avatar: 1,
                                    }
                                }
                            ]
                        }   
                    },
                    //we get an array now,and what we want take from that array is first value[0] ,so we also get the value from there, but we use some easier way to get the value,
                    //for the frontend developer, we can take the first value from the array using $addFields, and insert it into the owner and find the element of array using $first from the field owner
                    {
                        $addFields:{
                            owner:{
                                 $first: "$owner"
                            }
                        }
                    },
                ]
            }
        },
        
    ])

    return res
    .status(200)
    .json(ApiResponse(
        200,
        user[0].watchHistory,
        "watch history fetched successfully"
        )
    )
})

export { 
    registerUser,
    loginUser,
    logOutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory

}
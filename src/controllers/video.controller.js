import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination

})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description} = req.body
    // TODO: get video, upload to cloudinary, create video

    if(!(title || description)){
        throw new ApiError(400,"Please provide All fields")
    }

    //get video
    //upload to cloudinary
    console.log(req.body)

    // let videoLocalPath;
    // if(req.files && req.files.videoFile && Array.isArray(req.files.videoFile) && req.files.videoFile.length > 0){
    // videoLocalPath = req.files.videoFile[0].path }
    
    /* ++explanation of above code 
        first check for req.files , then check for req.files.videoFile has any array elements using Array.isArray (using vanilla js here) and if we have array in videoFile then we can check for values are there or not using req.files.videoFile.length>0 
        if we find then we just take out path from videoFile and store them in videoLocalPath. */

    // let thumbnailLocalPath;
    // if(req.files && req.files.thumbnail && Array.isArray(req.files.thumbnail) && req.files.thumbnail.length > 0){
    // thumbnailLocalPath = req.files.thumbnail[0].path;
    // }


    /* we use optional chaining here */
    const videoLocalPath = req.files?.videoFile[0].path; //req.files comes from multer it give access from middleware we implement on video.routes for publish a video 
    const thumbnailLocalPath = req.files?.thumbnail[0].path;
    
    //console.log(req.files);


    if(!videoLocalPath){
        throw new ApiError(400,"Video file path is required")
    }

    if(!thumbnailLocalPath){
        throw new ApiError(400,"thumbnail path is required")
    }

    //can change this name to Video if any error occur
    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if(!videoFile){
        throw new ApiError(400,"Video file not found")
    }

    if (!thumbnail) {
        throw new ApiError(400, "Thumbnail not found");
    }

    //create video

    const newVideo = await Video.create({
        title,
        description,
        videoFile: videoFile.url,
        thumbnail: thumbnail.url,
        duration: videoFile.duration,
        owner: req.user?._id,
    })

    //for optimizing the code , we can't do this database call now , it's tottally upto your application.
    // const videoUploaded = await Video.findById(newVideo._id)

    if(!videoUploaded){
        throw new ApiError(500, "failed to upload video, please try again")
    }

    return res
    .status(201)
    .json(new 
        ApiResponse(201, newVideo ,"Video Uploaded Succesfully"))

});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: get video by id

    if(!isValidObjectId(videoId)){
        throw new ApiError(400,"Invalid videoId")
    }

    
    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(401,"Video Not found")
    }

    return res
    .status(200)
    .json(new ApiResponse(
        200,video,"Video is find successfully"
    ))

})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: update video details like title, description, thumbnail

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    //TODO: delete video
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
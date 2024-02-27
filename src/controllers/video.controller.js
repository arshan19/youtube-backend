import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  const pageNumber = parseInt(page);
  const pageSize = parseInt(limit);
  const skip = (pageNumber - 1) * pageSize;

  // console.log("page :", page)
  // console.log("limit :", limit)
  // console.log("query :", query)
  // console.log("sortBy :", sortBy)
  // console.log("sortType :", sortType)
  // console.log("userId :", userId)

  if (!query) {
    throw new ApiError(400, "Please give query to retrieve video.");
  }

  if (!sortBy) {
    throw new ApiError(400, "Please give sortBy value to sort the videos.");
  }

  if (!sortType) {
    throw new ApiError(400, "Please give sortType value of video.");
  }

  if (!userId) {
    throw new ApiError(400, "Please give user Id.");
  }

  try {
    // Add query logic based on the 'query' parameter
    // Create aggregation pipeline

    const videos = await Video.aggregate([
      
        /* Here's a breakdown of the provided code:
            1. **$match Stage**:
                - It's an aggregation pipeline stage used to filter documents based on specified criteria.
                - In this case, it filters documents based on two conditions:
                - The title or description fields match the given query string using a case-insensitive regex match (`$regex`).
                - The isPublished field is true.

            2. **$or Operator**:
                - Allows for logical OR operations between multiple conditions.
                - If either the title or the description matches the query string, the document is considered a match.

            3. **$regex Operator**:
                - Performs a regular expression match to find documents where either the title or description fields contain the specified query string.
                - The `$options: "i"` option ensures a case-insensitive match.

            So, this stage effectively filters videos based on whether their titles or descriptions contain the provided query string, and only includes videos that are published (`isPublished: true`). */
        {
            $match: {
                $or: [
                { title: { $regex: query, $options: "i" } },
                { description: { $regex: query, $options: "i" } },
            ],
                isPublished: true,
            },
        },
        {
            $lookup: {
                // Perform a lookup in the "likes" collection
                from: "likes",
                // Match documents where the "_id" field matches the video ID
                localField: "_id",
                // Match documents in the "likes" collection where the "video" field matches the video ID
                foreignField: "video",
                // Store the fetched likes in an array field named "likes"
                as: "likes",
                // Nested pipeline to further process the joined documents
                    pipeline: [{
                            //The count stage counts the number of documents in the "likes" array (which represent likes for each video).The count is then assigned to a new field named "totalLikes" in the output documents.
                            $count: "totalLikes",
                        },
                    ],
            },
            /* So, in summary, this aggregation pipeline stage first fetches 
            related likes for each video, and then within the nested pipeline, 
            it counts the total number of likes for each video and 
            adds that count as a field in the output documents. */
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                    pipeline: [{
                        $project: {
                            username: 1,
                        },
                     },
                ],
            },
            /*So, in summary, this stage retrieves user details from the "users" collection
            based on the "owner" field in the current collection (videos). It then stores the 
            fetched user details in an array field named "owner" in the output documents. 
            Within the nested pipeline,only the "username" field is projected from the joined user documents. */
        },
        {
            $addFields: {
            // Add a new field named 'owner' to each document
                owner: {
                // Select the first element of the 'owner' array and extract its 'username' field
                    $first: "$owner.username",
                },
                // Add a new field named 'likes' to each document
                likes: {
                // Conditionally project either the total count of likes or 0 based on the size of the 'likes.totalLikes' array
                    $cond: {
                        // Check if the 'totalLikes' array is empty
                        if: { 
                            $eq: [{ $size: "$likes.totalLikes" }, 0] //This operator is used to compare two values for equality. It returns true if the values are equal and false otherwise. 
                        },
                        // If the 'totalLikes' array is empty, project 0, // If the 'totalLikes' array is not empty, project the total count of likes
                        then: 0,
                        else: { $first: "$likes.totalLikes" },
                    },
                },
            },
        },
        {
            $project: {
                _id: 1,
                videoFile: 1,
                thumbnail: 1,
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                likes: 1,
            },
        }, 
        { 
            // Sort the results based on the specified sortBy field and sortType (ascending or descending)
            $sort: { [sortBy]: sortType === "asc" ? 1 : -1 } 
        },
        { 
            // Skip the specified number of documents based on pagination
            $skip: skip 
        },
        { 
            // Limit the number of documents returned based on pagination
            $limit: pageSize 
        },

    ]);

    // console.log("videos :", videos)
    /*It checks if any videos are retrieved from the database. If the videos array is empty,
    it returns a JSON response indicating that no videos are available.
    If videos are found,it fetched videos wrapped in an object under the key videos. 
    Additionally, it provides a success message indicating that the videos were fetched successfully. 
    */

    if (videos.length === 0) {
      return res.status(200).json(new ApiResponse(200, "No video available."));
    } else {
      return res
        .status(200)
        .json(new ApiResponse(200, { videos }, "Video fetched successfully."));
    }
  } catch (error) {
    throw new ApiError(
      500,
      `"Getting error in fetching the videos from database. error is ${error}"`
    );
  }
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  /*
       Step1: First we have to take title and description and check it.
       Step2: Get the videoFile and thumbnail from middleware.
       Step3: Fetch the local path of videoFile and thumbnail, then update it on cloudinary.
       Step4: Create the mongoDB document for the new video.
    */

  try {
    // Step1: First we have to take title and description and check it.
    if ([title, description].some((field) => field.trim() === "")) {
      throw new ApiError(400, "Please provide title and description");
    }

    if (!(title || description)) {
      throw new ApiError(400, "Please provide All fields");
    }

    //get video
    //upload to cloudinary
    console.log(req.body);

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

    // Step2: Get the videoFile and thumbnail from middleware.
    /* we use optional chaining here */
    const videoLocalPath = req.files?.videoFile[0].path; //req.files comes from multer it give access from middleware we implement on video.routes for publish a video
    const thumbnailLocalPath = req.files?.thumbnail[0].path;

    //console.log(req.files);

    if (!videoLocalPath) {
      throw new ApiError(400, "Error in fetching the video file local path");
    }

    if (!thumbnailLocalPath) {
      throw new ApiError(
        400,
        "Error in fetching the thumbnail file local path"
      );
    }

    // Step3: Fetch the local path of videoFile and thumbnail, then update it on cloudinary.
    //can change this name to Video if any error occur
    const videoFile = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
      throw new ApiError(400, "Error in updating the video file in cloudinary");
    }

    if (!thumbnail) {
      throw new ApiError(400, "Error in updating the thumbnail in cloudinary");
    }

    // console.log("videoFileCloudinaryPath.secure_url :", videoFileCloudinaryPath.secure_url)
    // console.log("videoFileCloudinaryPath.duration :", videoFileCloudinaryPath.duration)
    // console.log("thumbnailPathCloudinaryPath.secure_url :", thumbnailPathCloudinaryPath.secure_url)
    // console.log("title :", title)
    // console.log("description :", description)

    // Step4: Create the mongoDB document for the new video.
    const newVideo = await Video.create({
      title,
      description,
      videoFile: videoFile.url,
      thumbnail: thumbnail.url,
      duration: videoFile.duration,
      views: 0,
      owner: req.user?._id,
    });

    //for optimizing the code , we can't do this database call now , it's tottally upto your application.
    // const videoUploaded = await Video.findById(newVideo._id)

    if (!videoUploaded) {
      throw new ApiError(500, "failed to upload video, please try again");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, newVideo, "Video Uploaded Succesfully"));
  } catch (error) {
    throw new ApiError(
      500,
      `"Getting error while uploading the video. Error is ${error}"`
    );
  }
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  try {
    const video2 = await Video.findById(videoId);

    console.log("video :", video2);

    if (!video2) {
      throw new ApiError(400, "There is no video available with this video ID");
    }

    const video = await Video.aggregate([
      {
        $match: {
          _id: mongoose.Types.ObjectId(videoId),
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "video",
          as: "likes",
        },
      },
      {
        $addFields: {
          likes: {
            $size: "$likes",
          },
          isliked: {
            $cond: {
              if: {
                $in: [req.user?._id, "$likes.likedBy"],
              },
              then: true,
              else: false,
            },
          },
        },
          /*isLiked: This field determines whether the current user has liked the video or not.
            It uses the $cond (conditional) operator to check if the user's ID (req.user?._id) 
            exists in the likedBy array within the likes array. 
            If the user's ID is found in the likedBy array,it returns true; otherwise, it returns false. */
      },
      {
        $project: {
          "videoFile.url": 1,
          title: 1,
          description: 1,
          views: 1,
          createdAt: 1,
          duration: 1,
          comments: 1,
          likes: 1,
          isLiked: 1,
        },
      },
    ]);

    console.log("video :", video);

    return res
      .status(200)
      .json(new ApiResponse(200, video, "Video Fetched successfully"));

  } 
  catch (error) {
    throw new ApiError(500, "Getting error while getting the video");
  }
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};

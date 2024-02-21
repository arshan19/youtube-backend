//main work of middleware done here 
//here we implement middleware just before method of post or anything going to run

import { Router } from "express";
import { 
            logOutUser,
            loginUser, 
            registerUser,
            refreshAccessToken, 
            changeCurrentPassword, 
            getCurrentUser, 
            updateAccountDetails, 
            updateUserAvatar, 
            updateUserCoverImage, 
            getUserChannelProfile, 
            getWatchHistory 
        } from "../controllers/user.controller.js";
        
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";


const router = Router()

router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        }, 
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
    )
router.route("/login").post(loginUser)

//SECURED ROUTES 
router.route("/logout").post(verifyJWT, logOutUser)
router.route("/refresh-token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT,changeCurrentPassword)
router.route("/current-user").get(verifyJWT,getCurrentUser)
router.route("/update-Account").patch(verifyJWT,updateAccountDetails)

router.route("/avatar").patch(verifyJWT,upload.single("avatar"),updateUserAvatar)
router.route("/coverImage").patch(verifyJWT,upload.single("coverImage"),updateUserCoverImage)

router.route("/c/:username").get(verifyJWT,getUserChannelProfile)
router.route("/history").get(verifyJWT,getWatchHistory)

export default router
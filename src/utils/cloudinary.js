import {v2 as cloudinary} from "cloudinary"
import fs from "fs";

          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath,{
            resource_type: "auto"
        })
        //file has been succesfully uploaded
        //same as error remove the locally saved temporary file as the uploaded option get succesfull 
        //(use fs.unlink to remove file from local stoarage as they are saved in cloudinary storage and we get an url for that image)
        
        //console.log("file is uploaded on cloudinary",response.url);
        fs.unlinkSync(localFilePath)
        return response;

    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the uploaded option get failed
        return null;
    }
}

export { uploadOnCloudinary }
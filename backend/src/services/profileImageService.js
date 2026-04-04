import { Admin } from "../models/Admin.js";
import { Candidate } from "../models/Candidate.js";
import { Employee } from "../models/Employee.js";
import { User } from "../models/User.js";
import { deleteFileByPublicUrl } from "../utils/fileStorage.js";

const syncRelatedProfileImage = async ({ user, imageUrl }) => {
  if (!user) return;

  if (user.role === "employee") {
    await Employee.updateOne(
      { userId: user._id },
      { $set: { profileImage: imageUrl || "" } }
    );
  }

  if (user.role === "candidate") {
    await Candidate.updateOne(
      {
        $or: [{ userId: user._id }, { email: user.email }],
      },
      { $set: { profileImage: imageUrl || "" } }
    );
  }

  if (user.role === "admin") {
    await Admin.updateOne(
      { email: user.email },
      { $set: { profileImage: imageUrl || "" } }
    );
  }
};

export const setUserProfileImage = async ({ userId, imageUrl }) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const previousPhotoUrl = user.profilePhotoUrl || user.profileImage || "";
  user.profilePhotoUrl = imageUrl || "";
  user.profileImage = imageUrl || "";
  await user.save();
  await syncRelatedProfileImage({ user, imageUrl });

  if (previousPhotoUrl && previousPhotoUrl !== imageUrl) {
    await deleteFileByPublicUrl(previousPhotoUrl);
  }

  return user;
};

export const clearUserProfileImage = async ({ userId }) => {
  const user = await User.findById(userId);
  if (!user) return null;

  const previousPhotoUrl = user.profilePhotoUrl || user.profileImage || "";
  user.profilePhotoUrl = "";
  user.profileImage = "";
  await user.save();
  await syncRelatedProfileImage({ user, imageUrl: "" });
  await deleteFileByPublicUrl(previousPhotoUrl);

  return user;
};

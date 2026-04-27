import React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { resolveProfileImageUrl } from "@/lib/images";

type ProfileAvatarProps = {
  name?: string;
  imageUrl?: string;
  className?: string;
  fallbackClassName?: string;
  allowTemporary?: boolean;
};

const getInitials = (name?: string) =>
  String(name || "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  name,
  imageUrl,
  className,
  fallbackClassName,
  allowTemporary = false,
}) => {
  const resolvedImageUrl = resolveProfileImageUrl(imageUrl, { allowTemporary });
  const cacheBustedImageUrl = React.useMemo(() => {
    if (!resolvedImageUrl || resolvedImageUrl.startsWith("blob:") || resolvedImageUrl.startsWith("data:image/")) {
      return resolvedImageUrl;
    }

    try {
      const parsedUrl = new URL(resolvedImageUrl, window.location.origin);
      parsedUrl.searchParams.set("t", String(Date.now()));
      return parsedUrl.toString();
    } catch {
      return resolvedImageUrl;
    }
  }, [resolvedImageUrl]);

  return (
    <Avatar className={cn("rounded-full", className)}>
      <AvatarImage key={cacheBustedImageUrl} src={cacheBustedImageUrl} alt={name || "Profile"} className="object-cover" />
      <AvatarFallback className={cn("bg-primary/10 font-semibold text-primary", fallbackClassName)}>
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
};

export default ProfileAvatar;

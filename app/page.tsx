"use client";

import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";

export default function Home() {
  const router = useRouter();

  const handleSearch = (username: string) => {
    router.push(`/profile/${username}`);
  };

  return (
    <div className="flex flex-1 items-center justify-center bg-white dark:bg-black px-4">
      <SearchBar onSearch={handleSearch} />
    </div>
  );
}
